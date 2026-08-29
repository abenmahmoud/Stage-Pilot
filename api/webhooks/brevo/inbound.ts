import { randomUUID } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../../../db/index.js";
import {
  supportContacts,
  supportEvents,
  supportMessages,
  supportRequests,
  supportWebhookReceipts,
} from "../../../db/schema.js";
import { HttpError, secretMatches } from "../../_shared/auth.js";
import { handleApi, methodNotAllowed } from "../../_shared/response.js";
import { assertNoForbiddenSupportSecret, sha256 } from "../../_shared/support.js";

type Mailbox = { Address?: string; Name?: string };
type InboundAttachment = {
  Name?: string;
  ContentType?: string;
  ContentLength?: number;
  DownloadToken?: string;
};
type InboundItem = {
  MessageId?: string;
  From?: Mailbox;
  To?: Mailbox[];
  Recipients?: Array<Mailbox | string>;
  Subject?: string;
  ExtractedMarkdownMessage?: string;
  RawTextBody?: string;
  Attachments?: InboundAttachment[];
};

function authorizeWebhook(req: VercelRequest): void {
  const expected = process.env.BREVO_WEBHOOK_SECRET;
  const provided = req.headers["x-brevo-webhook-secret"];
  const value = Array.isArray(provided) ? provided[0] : provided;
  if (!secretMatches(expected, value)) throw new HttpError(401, "Webhook refusé");
}

function recipientAddresses(item: InboundItem): string[] {
  const to = (item.To ?? []).flatMap((mailbox) => mailbox.Address ?? []);
  const recipients = (item.Recipients ?? []).flatMap((mailbox) =>
    typeof mailbox === "string" ? mailbox : mailbox.Address ?? []
  );
  return [...to, ...recipients].map((address) => address.toLowerCase());
}

function requestCode(item: InboundItem): string | null {
  for (const address of recipientAddresses(item)) {
    const localPart = address.split("@")[0]?.split("+")[0]?.toUpperCase();
    if (localPart && /^BC-\d{4}-\d{6}$/.test(localPart)) return localPart;
  }
  return null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);

  return handleApi(res, async () => {
    authorizeWebhook(req);
    const items = (req.body as { items?: InboundItem[] } | undefined)?.items;
    if (!Array.isArray(items) || items.length === 0 || items.length > 50) {
      throw new HttpError(400, "Webhook invalide");
    }

    let processed = 0;
    let rejected = 0;
    for (const item of items) {
      const externalId = typeof item.MessageId === "string" ? item.MessageId.slice(0, 500) : "";
      const code = requestCode(item);
      const sender = item.From?.Address?.trim().toLowerCase() ?? "";
      const text = (item.ExtractedMarkdownMessage ?? item.RawTextBody ?? "").trim().slice(0, 20000);
      if (!externalId || !code || !sender || !text) {
        rejected += 1;
        continue;
      }

      const payloadHash = sha256(JSON.stringify(item));
      const [request] = await db
        .select({ id: supportRequests.id, status: supportRequests.status })
        .from(supportRequests)
        .where(eq(supportRequests.publicCode, code))
        .limit(1);
      if (!request) {
        await db
          .insert(supportWebhookReceipts)
          .values({
            provider: "brevo-inbound",
            externalId,
            payloadHash,
            status: "rejected",
            errorCode: "request_not_found",
            processedAt: new Date(),
          })
          .onConflictDoNothing();
        rejected += 1;
        continue;
      }

      const [knownSender] = await db
        .select({ id: supportContacts.id })
        .from(supportContacts)
        .where(
          and(
            eq(supportContacts.requestId, request.id),
            eq(supportContacts.channel, "email"),
            eq(supportContacts.value, sender)
          )
        )
        .limit(1);
      if (!knownSender) {
        await db
          .insert(supportWebhookReceipts)
          .values({
            provider: "brevo-inbound",
            externalId,
            payloadHash,
            status: "rejected",
            errorCode: "sender_mismatch",
            processedAt: new Date(),
          })
          .onConflictDoNothing();
        rejected += 1;
        continue;
      }

      try {
        assertNoForbiddenSupportSecret(text);
        for (const attachment of (item.Attachments ?? []).slice(0, 5)) {
          if (attachment.Name) assertNoForbiddenSupportSecret(attachment.Name);
        }
      } catch (error) {
        if (!(error instanceof HttpError) || error.status !== 422) throw error;
        await db
          .insert(supportWebhookReceipts)
          .values({
            provider: "brevo-inbound",
            externalId,
            payloadHash,
            status: "rejected",
            errorCode: "forbidden_secret",
            processedAt: new Date(),
          })
          .onConflictDoNothing();
        rejected += 1;
        continue;
      }

      const correlationId = randomUUID();
      const notificationJobId = randomUUID();
      const outcome = await db.transaction(async (tx) => {
        const claimed = await tx.execute(sql<{ id: string }>`
          insert into public.support_webhook_receipts (
            provider, external_id, payload_hash, status
          ) values (
            'brevo-inbound', ${externalId}, ${payloadHash}, 'processing'
          )
          on conflict (provider, external_id, payload_hash) do update
          set status = 'processing', error_code = null, processed_at = null
          where public.support_webhook_receipts.status in ('received', 'error')
          returning id
        `);
        const receipt = Array.from(claimed as unknown as Array<{ id: string }>)[0];
        if (!receipt) return "duplicate" as const;

        const [message] = await tx
          .insert(supportMessages)
          .values({
            requestId: request.id,
            direction: "inbound",
            channel: "email",
            authorLabel: item.From?.Name?.slice(0, 180) || "Demandeur",
            bodyText: text,
            provider: "brevo",
            providerMessageId: externalId,
            deliveryStatus: "received",
          })
          .onConflictDoNothing()
          .returning({ id: supportMessages.id });
        if (!message) {
          await tx.update(supportWebhookReceipts).set({ status: "duplicate", processedAt: new Date() }).where(eq(supportWebhookReceipts.id, receipt.id));
          return "duplicate" as const;
        }

        await tx
          .update(supportRequests)
          .set({ status: request.status === "attente_demandeur" ? "en_cours" : request.status })
          .where(eq(supportRequests.id, request.id));
        await tx.insert(supportEvents).values({
          requestId: request.id,
          eventType: "message.received",
          actorType: "requester",
          actorId: knownSender.id,
          toValue: { messageId: message.id, channel: "email" },
          correlationId,
        });
        await tx.execute(sql`
          select pgmq.send(
            'support_jobs',
            jsonb_build_object(
              'job_id', ${notificationJobId}::uuid,
              'job_type', 'notify_agent_message_received',
              'request_id', ${request.id}::uuid,
              'message_id', ${message.id}::uuid,
              'attempt', 0
            )
          )
        `);

        for (const attachment of (item.Attachments ?? []).slice(0, 5)) {
          if (!attachment.DownloadToken || !attachment.Name || !attachment.ContentType || !attachment.ContentLength) continue;
          await tx.execute(sql`
            select pgmq.send(
              'support_file_scan',
              jsonb_build_object(
                'job_id', ${randomUUID()}::uuid,
                'job_type', 'import_brevo_attachment',
                'request_id', ${request.id}::uuid,
                'message_id', ${message.id}::uuid,
                'download_token', ${attachment.DownloadToken}::text,
                'file_name', ${attachment.Name.slice(0, 180)}::text,
                'mime_type', ${attachment.ContentType.slice(0, 150)}::text,
                'size_bytes', ${Math.min(attachment.ContentLength, 10485760)}::bigint,
                'attempt', 0
              )
            )
          `);
        }
        await tx.update(supportWebhookReceipts).set({ status: "processed", processedAt: new Date() }).where(eq(supportWebhookReceipts.id, receipt.id));
        return "processed" as const;
      });
      if (outcome === "processed") processed += 1;
    }

    return { received: items.length, processed, rejected };
  });
}

export const config = { api: { bodyParser: { sizeLimit: "1mb" } } };
