import { createHash } from "node:crypto";

export async function assertSupportEmailAccess(database, job) {
  const tokenHash = createHash("sha256").update(job.access_token ?? "").digest("hex");
  const [token] = await database`
    select t.id from public.support_magic_tokens t
    join public.support_requests r on r.id = t.request_id
    where r.institution_id = ${job.institution_id} and t.request_id = ${job.request_id}
      and t.contact_id = ${job.contact_id} and t.token_hash = ${tokenHash}
      and t.purpose = 'support_access' and t.used_at is null and t.expires_at > now()
    limit 1
  `;
  if (!token) throw new Error("support_access_expired");
}

export function supportEmailEventKey(job) {
  const event = job.job_type === "send_requester_access_link" ? job.job_id
    : job.job_type.endsWith("request_created") ? job.request_id : job.message_id;
  if (!event) throw new Error("email_event_missing");
  return createHash("sha256").update(JSON.stringify([
    job.institution_id, job.request_id, job.job_type, event, job.contact_id ?? null,
  ])).digest("hex");
}

// The callback starts only after a committed reservation. A crash or unknown
// provider result must never release that reservation for an automatic resend.
export async function dispatchSupportEmail(database, job, send) {
  const eventKey = supportEmailEventKey(job);
  const [reserved] = await database`
    insert into public.support_email_dispatches
      (institution_id, event_key, request_id, job_id, state)
    values (${job.institution_id}, ${eventKey}, ${job.request_id}, ${job.job_id}, 'dispatching')
    on conflict (institution_id, event_key) do update
      set state = 'dispatching', job_id = excluded.job_id, updated_at = now()
      where support_email_dispatches.state = 'rejected'
    returning job_id
  `;
  if (!reserved) {
    const [previous] = await database`
      select state, provider_reference from public.support_email_dispatches
      where institution_id = ${job.institution_id} and event_key = ${eventKey}
    `;
    if (previous?.state === "sent" && previous.provider_reference) return previous.provider_reference;
    throw new Error("email_delivery_uncertain");
  }
  let reference;
  try {
    reference = await send(reserved.job_id);
  } catch (error) {
    const rejected = error?.name === "BrevoRejectedError";
    await database`
      update public.support_email_dispatches
      set state = ${rejected ? "rejected" : "uncertain"}, updated_at = now()
      where institution_id = ${job.institution_id} and event_key = ${eventKey}
        and job_id = ${job.job_id} and state = 'dispatching'
    `;
    if (rejected) throw error;
    throw new Error("email_delivery_uncertain");
  }
  if (typeof reference !== "string" || !reference || reference.length > 512) {
    throw new Error("email_delivery_uncertain");
  }
  // If this write fails, the committed 'dispatching' row still prevents resend.
  await database`
    update public.support_email_dispatches
    set state = 'sent', provider_reference = ${reference}, updated_at = now()
    where institution_id = ${job.institution_id} and event_key = ${eventKey}
      and job_id = ${job.job_id} and state = 'dispatching'
  `;
  return reference;
}

export function supportEmailErrorCode(error) {
  const message = error instanceof Error ? error.message : "email_worker_failed";
  return /^[a-z][a-z0-9_]{0,119}$/.test(message) ? message : "email_worker_failed";
}
