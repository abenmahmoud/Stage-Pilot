import { randomUUID } from "node:crypto";
import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;
const brevoApiKey = process.env.BREVO_API_KEY;
const senderEmail = process.env.SUPPORT_FROM_EMAIL;
if (!databaseUrl || !brevoApiKey || !senderEmail) {
  throw new Error("DATABASE_URL, BREVO_API_KEY and SUPPORT_FROM_EMAIL are required");
}

const sql = postgres(databaseUrl, { prepare: false, max: 2, idle_timeout: 20 });
const brevoEndpoint = "https://api.brevo.com/v3/smtp/email";
const senderName = process.env.SUPPORT_FROM_NAME ?? "Lycee Blaise Cendrars";
const agentEmail = process.env.SUPPORT_AGENT_EMAIL;
const publicUrl = (process.env.SUPPORT_PUBLIC_URL ?? "").replace(/\/$/, "");
const agentUrl = (process.env.SUPPORT_AGENT_URL ?? publicUrl).replace(/\/$/, "");
const institutionSlug = process.env.SUPPORT_INSTITUTION_SLUG ?? "blaise-cendrars-sevran";

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function paragraphs(value) {
  return escapeHtml(value).replace(/\r?\n/g, "<br>");
}

function isTestAddress(value) {
  return typeof value === "string" && /@(example\.com|example\.org|example\.net|test\.invalid)$/i.test(value);
}

function trackingUrl(accessToken) {
  if (!publicUrl || !accessToken) throw new Error("tracking_url_unavailable");
  return `${publicUrl}?support_token=${encodeURIComponent(accessToken)}`;
}

function requesterReplyAddress(publicCode) {
  const inboundDomain = process.env.SUPPORT_INBOUND_DOMAIN;
  if (inboundDomain) return `${publicCode.toLowerCase()}@${inboundDomain}`;
  return process.env.SUPPORT_REPLY_TO_EMAIL ?? senderEmail;
}

async function sendEmail({ to, subject, textContent, htmlContent, idempotencyKey, replyTo, tags }) {
  const response = await fetch(brevoEndpoint, {
    method: "POST",
    headers: {
      accept: "application/json",
      "api-key": brevoApiKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      sender: { email: senderEmail, name: senderName },
      to: [to],
      replyTo: replyTo ?? { email: senderEmail, name: senderName },
      subject,
      textContent,
      htmlContent,
      tags,
      headers: { idempotencyKey },
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (response.ok && payload.messageId) return payload.messageId;
  if (payload.code === "duplicate_parameter") return `duplicate:${idempotencyKey}`;
  throw new Error(payload.code || `brevo_http_${response.status}`);
}

async function requireConfiguredInstitution() {
  const [institution] = await sql`
    select id
    from public.institutions
    where slug = ${institutionSlug} and status in ('pilot', 'active')
    limit 1
  `;
  if (!institution) throw new Error("support_institution_unavailable");
  const [{ count }] = await sql`
    select count(*)::integer as count
    from public.institutions
    where status in ('pilot', 'active')
  `;
  if (count !== 1) throw new Error("shared_support_queue_requires_one_active_institution");
  return institution.id;
}

async function loadContext(institutionId, requestId, contactId) {
  const [request] = await sql`
    select id, public_code, requester_type, requester_first_name,
           requester_last_name, category, subject
    from public.support_requests
    where id = ${requestId} and institution_id = ${institutionId}
    limit 1
  `;
  if (!request) throw new Error("request_not_found");
  const [contact] = await sql`
    select value
    from public.support_contacts
    where request_id = ${requestId}
      and channel = 'email'
      and (${contactId ?? null}::uuid is null or id = ${contactId ?? null}::uuid)
    order by is_primary desc, created_at asc
    limit 1
  `;
  return { request, email: contact?.value ?? null };
}

async function deliver(job, institutionId) {
  if (job.institution_id !== institutionId) throw new Error("institution_mismatch");
  const context = await loadContext(institutionId, job.request_id, job.contact_id);
  const request = context.request;
  const requesterName = `${request.requester_first_name} ${request.requester_last_name}`;
  if (isTestAddress(context.email)) return "skipped:test_address";

  if (job.job_type === "notify_requester_request_created") {
    if (!context.email) return "skipped:no_email";
    const link = trackingUrl(job.access_token);
    return sendEmail({
      to: { email: context.email, name: requesterName },
      subject: `${request.public_code} - Votre demande a ete recue`,
      textContent: `Bonjour ${requesterName},\n\nVotre demande "${request.subject}" a bien ete recue.\nNumero : ${request.public_code}\nSuivi securise : ${link}\n\nAucun mot de passe ne vous sera demande.`,
      htmlContent: `<p>Bonjour ${escapeHtml(requesterName)},</p><p>Votre demande <strong>${escapeHtml(request.subject)}</strong> a bien ete recue.</p><p>Numero : <strong>${escapeHtml(request.public_code)}</strong></p><p><a href="${escapeHtml(link)}">Suivre ma demande</a></p><p><small>Aucun mot de passe ne vous sera demande.</small></p>`,
      idempotencyKey: job.job_id,
      replyTo: { email: requesterReplyAddress(request.public_code), name: senderName },
      tags: ["lyceegest-support", "demande-recue"],
    });
  }

  if (job.job_type === "notify_agent_request_created" || job.job_type === "notify_agent_message_received") {
    if (!agentEmail) throw new Error("support_agent_email_missing");
    const isMessage = job.job_type === "notify_agent_message_received";
    return sendEmail({
      to: { email: agentEmail, name: "Equipe support du lycee" },
      subject: `${isMessage ? "Nouveau message" : "Nouvelle demande"} ${request.public_code} - ${request.subject}`,
      textContent: `${isMessage ? "Un nouveau message est arrive" : "Une nouvelle demande a ete creee"}.\nDossier : ${request.public_code}\nDemandeur : ${requesterName} (${request.requester_type})\nCategorie : ${request.category}\nObjet : ${request.subject}\n\nOuvrir : ${agentUrl}?view=agent`,
      htmlContent: `<p><strong>${isMessage ? "Un nouveau message est arrive" : "Une nouvelle demande a ete creee"}.</strong></p><p>Dossier : ${escapeHtml(request.public_code)}<br>Demandeur : ${escapeHtml(requesterName)} (${escapeHtml(request.requester_type)})<br>Categorie : ${escapeHtml(request.category)}<br>Objet : ${escapeHtml(request.subject)}</p><p><a href="${escapeHtml(`${agentUrl}?view=agent`)}">Ouvrir les demandes</a></p>`,
      idempotencyKey: job.job_id,
      tags: ["lyceegest-support", isMessage ? "message-agent" : "nouvelle-demande"],
    });
  }

  if (job.job_type === "send_requester_reply") {
    if (!context.email || !job.message_id) throw new Error("reply_destination_missing");
    const [message] = await sql`
      select body_text, delivery_status
      from public.support_messages
      where id = ${job.message_id} and request_id = ${job.request_id}
      limit 1
    `;
    if (!message) throw new Error("reply_message_not_found");
    if (["sent", "delivered"].includes(message.delivery_status)) return "skipped:already_sent";
    const link = trackingUrl(job.access_token);
    const messageId = await sendEmail({
      to: { email: context.email, name: requesterName },
      subject: `${request.public_code} - Reponse du lycee`,
      textContent: `Bonjour ${requesterName},\n\n${message.body_text}\n\nRepondre et suivre : ${link}`,
      htmlContent: `<p>Bonjour ${escapeHtml(requesterName)},</p><p>${paragraphs(message.body_text)}</p><p><a href="${escapeHtml(link)}">Repondre et suivre la demande</a></p>`,
      idempotencyKey: job.job_id,
      replyTo: { email: requesterReplyAddress(request.public_code), name: senderName },
      tags: ["lyceegest-support", "reponse-agent"],
    });
    await sql`
      update public.support_messages
      set provider = 'brevo', provider_message_id = ${messageId}, delivery_status = 'sent'
      where id = ${job.message_id} and request_id = ${job.request_id}
    `;
    return messageId;
  }

  throw new Error("unsupported_job_type");
}

async function processRow(row, institutionId) {
  const job = typeof row.message === "string" ? JSON.parse(row.message) : row.message;
  if (!job?.job_id || !job?.job_type || !job?.institution_id || !job?.request_id) {
    throw new Error("invalid_queue_payload");
  }
  if (job.institution_id !== institutionId) throw new Error("institution_mismatch");
  const [done] = await sql`
    select id from public.support_job_runs
    where institution_id = ${institutionId}
      and job_id = ${job.job_id}
      and status = 'success'
    limit 1
  `;
  if (done) {
    await sql`select pgmq.delete('support_jobs', ${row.msg_id}::bigint)`;
    return "processed";
  }

  const startedAt = Date.now();
  try {
    const providerReference = await deliver(job, institutionId);
    await sql.begin(async (transaction) => {
      await transaction`
        insert into public.support_job_runs (
          institution_id, job_id, job_type, request_id, attempt, status,
          provider_reference, duration_ms
        ) values (
          ${institutionId}, ${job.job_id}, ${job.job_type}, ${job.request_id}, ${row.read_ct},
          'success', ${providerReference}, ${Date.now() - startedAt}
        ) on conflict (institution_id, job_id, attempt) do nothing
      `;
      await transaction`select pgmq.delete('support_jobs', ${row.msg_id}::bigint)`;
    });
    return "processed";
  } catch (error) {
    const errorCode = error instanceof Error ? error.message.slice(0, 120) : "unknown_error";
    await sql`
      insert into public.support_job_runs (
        institution_id, job_id, job_type, request_id, attempt, status,
        error_code, duration_ms
      ) values (
        ${institutionId}, ${job.job_id}, ${job.job_type}, ${job.request_id}, ${row.read_ct},
        'failure', ${errorCode}, ${Date.now() - startedAt}
      ) on conflict (institution_id, job_id, attempt) do nothing
    `;
    if (row.read_ct >= 5) {
      await sql.begin(async (transaction) => {
        await transaction`
          insert into public.support_failed_jobs (
            institution_id, job_id, request_id, job_type, payload_redacted, attempts,
            last_error_code, last_error_summary
          ) values (
            ${institutionId}, ${job.job_id}, ${job.request_id}, ${job.job_type},
            ${transaction.json({ messageId: job.message_id ?? null })}, ${row.read_ct},
            ${errorCode}, 'Echec apres plusieurs tentatives'
          ) on conflict (institution_id, job_id) do nothing
        `;
        await transaction`select pgmq.archive('support_jobs', ${row.msg_id}::bigint)`;
      });
      return "failed";
    }
    return "retrying";
  }
}

async function main() {
  const institutionId = await requireConfiguredInstitution();
  const rows = await sql`
    select msg_id, read_ct, message
    from pgmq.read('support_jobs', 120, 25)
  `;
  const outcomes = [];
  for (const row of rows) outcomes.push(await processRow(row, institutionId));
  console.log(JSON.stringify({ claimed: rows.length, outcomes }));
  await sql.end();
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : "email_worker_failed");
  await sql.end({ timeout: 1 });
  process.exitCode = 1;
});
