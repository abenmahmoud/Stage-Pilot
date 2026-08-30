import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import {
  supportContacts,
  supportFailedJobs,
  supportJobRuns,
  supportMessages,
  supportRequests,
} from "../../db/schema.js";
import { escapeHtml, sendTransactionalEmail } from "../_shared/brevo.js";
import { HttpError, secretMatches } from "../_shared/auth.js";
import { handleApi, methodNotAllowed } from "../_shared/response.js";
import { resolveSupportNotificationTarget } from "../../shared/support-notification-routing.js";
import { isReservedTestEmail } from "../../shared/support-test-address.js";
import {
  parseSupportEmailQueueJob,
  supportEmailFailureDisposition,
  type SupportEmailQueueJob,
} from "../../shared/support-email-job-policy.js";
import {
  assertLegacySingleInstitutionMode,
  requireConfiguredInstitution,
} from "../_shared/institution-context.js";

type QueueRow = {
  msg_id: number;
  read_ct: number;
  message: unknown;
};

type EmailContext = {
  request: {
    id: string;
    publicCode: string;
    requesterType: string;
    requesterFirstName: string;
    requesterLastName: string;
    category: string;
    subject: string;
    assignedTeam: string | null;
  };
  email: string | null;
};

async function loadEmailContext(
  institutionId: string,
  requestId: string,
  contactId?: string
): Promise<EmailContext> {
  const [request] = await db
    .select({
      id: supportRequests.id,
      publicCode: supportRequests.publicCode,
      requesterType: supportRequests.requesterType,
      requesterFirstName: supportRequests.requesterFirstName,
      requesterLastName: supportRequests.requesterLastName,
      category: supportRequests.category,
      subject: supportRequests.subject,
      assignedTeam: supportRequests.assignedTeam,
    })
    .from(supportRequests)
    .where(and(
      eq(supportRequests.institutionId, institutionId),
      eq(supportRequests.id, requestId)
    ))
    .limit(1);
  if (!request) throw new Error("request_not_found");
  const [emailContact] = await db
    .select({ value: supportContacts.value })
    .from(supportContacts)
    .where(and(
      eq(supportContacts.requestId, requestId),
      eq(supportContacts.channel, "email"),
      ...(contactId ? [eq(supportContacts.id, contactId)] : [])
    ))
    .limit(1);
  return { request, email: emailContact?.value ?? null };
}

function trackingUrl(accessToken: string | undefined): string {
  if (!accessToken) throw new Error("access_token_missing");
  const base = (process.env.SUPPORT_PUBLIC_URL ?? "https://app.lycee-blaise-cendrars-sevran.fr/prototype").replace(/\/$/, "");
  return `${base}?support_token=${encodeURIComponent(accessToken)}`;
}

function paragraphs(value: string): string {
  return escapeHtml(value).replace(/\r?\n/g, "<br>");
}

function requesterReplyAddress(publicCode: string): string {
  const inboundDomain = process.env.SUPPORT_INBOUND_DOMAIN;
  if (inboundDomain) return `${publicCode.toLowerCase()}@${inboundDomain}`;
  const fallback = process.env.SUPPORT_REPLY_TO_EMAIL ?? process.env.SUPPORT_FROM_EMAIL;
  if (!fallback) throw new Error("support_reply_to_email_missing");
  return fallback;
}

async function deliver(job: SupportEmailQueueJob, institutionId: string): Promise<string> {
  const context = await loadEmailContext(institutionId, job.request_id, job.contact_id);
  if (isReservedTestEmail(context.email)) return "skipped:test_address";
  const requesterName = `${context.request.requesterFirstName} ${context.request.requesterLastName}`;
  const senderEmail = process.env.SUPPORT_FROM_EMAIL;
  if (!senderEmail) throw new Error("support_from_email_missing");
  const senderName = process.env.SUPPORT_FROM_NAME ?? "Lycée Blaise Cendrars";

  if (job.job_type === "notify_requester_request_created") {
    if (!context.email) return "skipped:no_email";
    const link = trackingUrl(job.access_token);
    const result = await sendTransactionalEmail({
      to: { email: context.email, name: requesterName },
      subject: `${context.request.publicCode} - Votre demande a été reçue`,
      textContent: `Bonjour ${requesterName},\n\nVotre demande « ${context.request.subject} » a bien été reçue.\nNuméro : ${context.request.publicCode}\nSuivi sécurisé : ${link}\n\nAucun mot de passe ne vous sera demandé.`,
      htmlContent: `<p>Bonjour ${escapeHtml(requesterName)},</p><p>Votre demande <strong>${escapeHtml(context.request.subject)}</strong> a bien été reçue.</p><p>Numéro : <strong>${escapeHtml(context.request.publicCode)}</strong></p><p><a href="${escapeHtml(link)}">Suivre ma demande</a></p><p><small>Aucun mot de passe ne vous sera demandé.</small></p>`,
      idempotencyKey: job.job_id,
      replyTo: { email: requesterReplyAddress(context.request.publicCode), name: senderName },
      tags: ["lyceegest-support", "demande-recue"],
    });
    return result.messageId;
  }

  if (job.job_type === "notify_agent_request_created" || job.job_type === "notify_agent_message_received") {
    const target = resolveSupportNotificationTarget(context.request.assignedTeam, process.env);
    if (!target) throw new Error("support_agent_email_missing");
    const isMessage = job.job_type === "notify_agent_message_received";
    const agentUrl = (process.env.SUPPORT_AGENT_URL ?? process.env.SUPPORT_PUBLIC_URL ?? "https://app.lycee-blaise-cendrars-sevran.fr/prototype").replace(/\/$/, "");
    const result = await sendTransactionalEmail({
      to: { email: target.email, name: target.name },
      subject: `${isMessage ? "Nouveau message" : "Nouvelle demande"} ${context.request.publicCode} - ${context.request.subject}`,
      textContent: `${isMessage ? "Un nouveau message est arrivé" : "Une nouvelle demande a été créée"}.\nDossier : ${context.request.publicCode}\nDemandeur : ${requesterName} (${context.request.requesterType})\nCatégorie : ${context.request.category}\nObjet : ${context.request.subject}\n\nOuvrir : ${agentUrl}?agent_request=${context.request.publicCode}`,
      htmlContent: `<p><strong>${isMessage ? "Un nouveau message est arrivé" : "Une nouvelle demande a été créée"}.</strong></p><p>Dossier : ${escapeHtml(context.request.publicCode)}<br>Demandeur : ${escapeHtml(requesterName)} (${escapeHtml(context.request.requesterType)})<br>Catégorie : ${escapeHtml(context.request.category)}<br>Objet : ${escapeHtml(context.request.subject)}</p><p><a href="${escapeHtml(`${agentUrl}?agent_request=${context.request.publicCode}`)}">Ouvrir le dossier</a></p>`,
      idempotencyKey: job.job_id,
      tags: ["lyceegest-support", isMessage ? "message-agent" : "nouvelle-demande"],
    });
    return result.messageId;
  }

  if (job.job_type === "send_requester_reply") {
    if (!context.email || !job.message_id) throw new Error("reply_destination_missing");
    const [message] = await db
      .select({ bodyText: supportMessages.bodyText, deliveryStatus: supportMessages.deliveryStatus })
      .from(supportMessages)
      .where(eq(supportMessages.id, job.message_id))
      .limit(1);
    if (!message) throw new Error("reply_message_not_found");
    if (message.deliveryStatus === "sent" || message.deliveryStatus === "delivered") {
      return "skipped:already_sent";
    }
    const link = trackingUrl(job.access_token);
    const result = await sendTransactionalEmail({
      to: { email: context.email, name: requesterName },
      subject: `${context.request.publicCode} - Réponse du lycée`,
      textContent: `Bonjour ${requesterName},\n\n${message.bodyText}\n\nRépondre et suivre : ${link}`,
      htmlContent: `<p>Bonjour ${escapeHtml(requesterName)},</p><p>${paragraphs(message.bodyText)}</p><p><a href="${escapeHtml(link)}">Répondre et suivre la demande</a></p>`,
      idempotencyKey: job.job_id,
      replyTo: { email: requesterReplyAddress(context.request.publicCode), name: senderName },
      tags: ["lyceegest-support", "reponse-agent"],
    });
    await db
      .update(supportMessages)
      .set({ provider: "brevo", providerMessageId: result.messageId, deliveryStatus: "sent" })
      .where(eq(supportMessages.id, job.message_id));
    return result.messageId;
  }

  throw new Error("unsupported_job_type");
}

async function processRow(
  row: QueueRow,
  institutionId: string
): Promise<"processed" | "retried" | "failed"> {
  let job: SupportEmailQueueJob;
  try {
    job = parseSupportEmailQueueJob(row.message, institutionId);
  } catch {
    await db.execute(sql`select pgmq.archive('support_jobs', ${row.msg_id}::bigint)`);
    return "failed";
  }

  const [alreadyDone] = await db
    .select({ id: supportJobRuns.id })
    .from(supportJobRuns)
    .where(and(
      eq(supportJobRuns.institutionId, institutionId),
      eq(supportJobRuns.jobId, job.job_id),
      eq(supportJobRuns.status, "success")
    ))
    .limit(1);
  if (alreadyDone) {
    await db.execute(sql`select pgmq.delete('support_jobs', ${row.msg_id}::bigint)`);
    return "processed";
  }

  const startedAt = Date.now();
  try {
    const providerReference = await deliver(job, institutionId);
    await db.transaction(async (tx) => {
      await tx
        .insert(supportJobRuns)
        .values({
          institutionId,
          jobId: job.job_id,
          jobType: job.job_type,
          requestId: job.request_id,
          attempt: row.read_ct,
          status: "success",
          providerReference,
          durationMs: Date.now() - startedAt,
        })
        .onConflictDoNothing();
      await tx.execute(sql`select pgmq.delete('support_jobs', ${row.msg_id}::bigint)`);
    });
    return "processed";
  } catch (error) {
    const errorCode = error instanceof Error ? error.message.slice(0, 120) : "unknown_error";
    await db
      .insert(supportJobRuns)
      .values({
        institutionId,
        jobId: job.job_id,
        jobType: job.job_type,
        requestId: job.request_id,
        attempt: row.read_ct,
        status: "failure",
        errorCode,
        durationMs: Date.now() - startedAt,
      })
      .onConflictDoNothing();

    if (supportEmailFailureDisposition(row.read_ct) === "dead_letter") {
      await db.transaction(async (tx) => {
        await tx
          .insert(supportFailedJobs)
          .values({
            institutionId,
            jobId: job.job_id,
            requestId: job.request_id,
            jobType: job.job_type,
            payloadRedacted: {
              messageId: job.message_id ?? null,
              contactId: job.contact_id ?? null,
            },
            attempts: row.read_ct,
            lastErrorCode: errorCode,
            lastErrorSummary: "Échec après plusieurs tentatives",
          })
          .onConflictDoNothing();
        await tx.execute(sql`select pgmq.archive('support_jobs', ${row.msg_id}::bigint)`);
      });
      return "failed";
    }
    return "retried";
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST" && req.method !== "GET") return methodNotAllowed(res, ["GET", "POST"]);

  return handleApi(res, async () => {
    const secret = process.env.CRON_SECRET;
    const authorization = req.headers.authorization;
    const provided = authorization?.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length)
      : undefined;
    if (!secretMatches(secret, provided)) {
      throw new HttpError(401, "Accès refusé");
    }
    const institution = await requireConfiguredInstitution();
    await assertLegacySingleInstitutionMode(institution.id);
    const result = await db.execute(sql<QueueRow>`
      select msg_id, read_ct, message
      from pgmq.read('support_jobs', 120, 25)
    `);
    const rows = Array.from(result as unknown as QueueRow[]);
    const outcomes: Array<"processed" | "retried" | "failed"> = [];
    let cursor = 0;
    await Promise.all(
      Array.from({ length: Math.min(5, rows.length) }, async () => {
        while (cursor < rows.length) {
          const row = rows[cursor++];
          outcomes.push(await processRow(row, institution.id));
        }
      })
    );
    return {
      claimed: rows.length,
      processed: outcomes.filter((outcome) => outcome === "processed").length,
      retrying: outcomes.filter((outcome) => outcome === "retried").length,
      failed: outcomes.filter((outcome) => outcome === "failed").length,
    };
  });
}

export const config = { maxDuration: 60, api: { bodyParser: false } };
