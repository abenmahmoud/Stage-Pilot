import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db, client } from "../../db/index.js";
import {
  supportAttachments,
  supportContacts,
  supportFailedJobs,
  supportJobRuns,
  supportMessages,
  supportRequests,
} from "../../db/schema.js";
import { sendTransactionalEmail, type TransactionalEmail } from "../_shared/brevo.js";
import { dispatchSupportEmail, supportEmailErrorCode, assertSupportEmailAccess } from "../../shared/support-email-dispatch.mjs";
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
import { supportAccessCodeFromToken } from "../../shared/support-access-code.mjs";
import { buildSupportAccessRecoveryEmail } from "../../shared/support-access-recovery-email.mjs";
import { buildSupportRequesterEmail, buildSupportAgentEmail, schoolEmailSenderName, schoolEmailUrl, SCHOOL_PUBLIC_URL } from "../../shared/school-email-templates.mjs";

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
      eq(supportContacts.usageScope, "support"),
      isNull(supportContacts.disabledAt),
      ...(contactId ? [eq(supportContacts.id, contactId)] : [])
    ))
    .limit(1);
  return { request, email: emailContact?.value ?? null };
}

function trackingUrl(accessToken: string | undefined): string {
  if (!accessToken) throw new Error("access_token_missing");
  return schoolEmailUrl(process.env.SUPPORT_PUBLIC_URL, { support_token: accessToken });
}

function requesterAccessCode(job: SupportEmailQueueJob): string | null {
  const secret = process.env.SUPPORT_ACCESS_CODE_SECRET;
  if (!secret || !job.contact_id) throw new Error("support_access_code_unavailable");
  if (!job.access_token) throw new Error("access_token_missing");
  return supportAccessCodeFromToken({ token: job.access_token, secret });
}

function requesterReplyAddress(publicCode: string): string {
  const inboundDomain = process.env.SUPPORT_INBOUND_DOMAIN;
  if (inboundDomain) return `${publicCode.toLowerCase()}@${inboundDomain}`;
  const fallback = process.env.SUPPORT_REPLY_TO_EMAIL ?? process.env.SUPPORT_FROM_EMAIL;
  if (!fallback) throw new Error("support_reply_to_email_missing");
  return fallback;
}

async function deliver(job: SupportEmailQueueJob, institutionId: string): Promise<string> {
  const sendEmail = async (email: TransactionalEmail) => ({
    messageId: await dispatchSupportEmail(client, job, async (key) =>
      (await sendTransactionalEmail({ ...email, idempotencyKey: key })).messageId),
  });
  const requesterJob = ["notify_requester_request_created", "send_requester_reply", "send_requester_access_link"].includes(job.job_type);
  if (requesterJob && !job.contact_id) throw new Error("requester_contact_unavailable");
  const context = await loadEmailContext(institutionId, job.request_id, job.contact_id);
  if (isReservedTestEmail(context.email)) return "skipped:test_address";
  if (requesterJob && !context.email) {
    throw new Error("requester_contact_unavailable");
  }
  if (requesterJob) await assertSupportEmailAccess(client, job);
  const requesterName = `${context.request.requesterFirstName} ${context.request.requesterLastName}`;
  const senderEmail = process.env.SUPPORT_FROM_EMAIL;
  if (!senderEmail) throw new Error("support_from_email_missing");
  const senderName = schoolEmailSenderName(process.env.SUPPORT_FROM_NAME);

  if (job.job_type === "send_requester_access_link") {
    if (!context.email) throw new Error("requester_contact_unavailable");
    const result = await sendEmail({
      to: { email: context.email },
      ...buildSupportAccessRecoveryEmail({
        requesterName,
        publicCode: context.request.publicCode,
        trackingUrl: trackingUrl(job.access_token),
        accessCode: requesterAccessCode(job),
      }),
      idempotencyKey: job.job_id,
      tags: ["lyceegest-support", "reprise-suivi"],
      replyTo: { email: requesterReplyAddress(context.request.publicCode), name: senderName },
    });
    return result.messageId;
  }

  if (job.job_type === "notify_requester_request_created") {
    if (!context.email) return "skipped:no_email";
    const link = trackingUrl(job.access_token);
    const accessCode = requesterAccessCode(job);
    const result = await sendEmail({
      to: { email: context.email, name: requesterName },
      ...buildSupportRequesterEmail({ kind: "created", publicCode: context.request.publicCode, requesterName,
        requestSubject: context.request.subject, trackingUrl: link, accessCode }),
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
    const agentUrl = process.env.SUPPORT_AGENT_URL || process.env.SUPPORT_PUBLIC_URL || SCHOOL_PUBLIC_URL;
    const result = await sendEmail({
      to: { email: target.email, name: target.name },
      ...buildSupportAgentEmail({ publicCode: context.request.publicCode, requesterName, requestSubject: context.request.subject,
        serviceName: target.name, agentUrl, isMessage }),
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
      .where(and(
        eq(supportMessages.id, job.message_id),
        eq(supportMessages.requestId, job.request_id),
        eq(supportMessages.direction, "outbound"),
        eq(supportMessages.channel, "email")
      ))
      .limit(1);
    if (!message) throw new Error("reply_message_not_found");
    if (message.deliveryStatus === "sent" || message.deliveryStatus === "delivered") {
      return "skipped:already_sent";
    }
    const [attachmentSummary] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(supportAttachments)
      .where(and(
        eq(supportAttachments.messageId, job.message_id),
        eq(supportAttachments.requestId, job.request_id),
        eq(supportAttachments.direction, "agent"),
        eq(supportAttachments.scanStatus, "clean")
      ));
    const attachmentCount = Number(attachmentSummary?.count ?? 0);
    const link = trackingUrl(job.access_token);
    const accessCode = requesterAccessCode(job);
    const result = await sendEmail({
      to: { email: context.email, name: requesterName },
      ...buildSupportRequesterEmail({ kind: "reply", publicCode: context.request.publicCode, requesterName,
        bodyText: message.bodyText, trackingUrl: link, accessCode, attachmentCount }),
      idempotencyKey: job.job_id,
      replyTo: { email: requesterReplyAddress(context.request.publicCode), name: senderName },
      tags: ["lyceegest-support", "reponse-agent"],
    });
    await db
      .update(supportMessages)
      .set({ provider: "brevo", providerMessageId: result.messageId, deliveryStatus: "sent" })
      .where(and(
        eq(supportMessages.id, job.message_id),
        eq(supportMessages.requestId, job.request_id)
      ));
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
    if (row.read_ct > 5) throw new Error("email_retry_limit_reached");
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
    const errorCode = supportEmailErrorCode(error);
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

    if (["email_delivery_uncertain", "support_access_expired"].includes(errorCode) || supportEmailFailureDisposition(row.read_ct) === "dead_letter") {
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
      from pgmq.read('support_jobs', 120, 5)
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
