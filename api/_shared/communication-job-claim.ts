import { sql } from "drizzle-orm";
import { db } from "../../db/index.js";

type CommunicationTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ClaimedCommunicationWebmailJob = {
  jobId: string;
  institutionId: string;
  communicationId: string;
  versionId: string;
  version: number;
  deliveryId: string;
  jobType: "send_delivery" | "retry_delivery";
  attemptCount: number;
  lockedAt: string;
};

export type RecoveredCommunicationWebmailJob = {
  jobId: string;
  status: "retry" | "dead";
  attemptCount: number;
  runAfter: string | null;
};

type ClaimedRow = {
  job_id: string;
  institution_id: string;
  communication_id: string;
  version_id: string;
  version: number;
  delivery_id: string;
  job_type: "send_delivery" | "retry_delivery";
  attempt_count: number;
  locked_at: Date | string;
};

type RecoveredRow = {
  job_id: string;
  status: "retry" | "dead";
  attempt_count: number;
  run_after: Date | string | null;
};

function boundedInteger(value: number, min: number, max: number, reason: string): number {
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(reason);
  return value;
}

function validDate(value: Date, reason: string): Date {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) throw new Error(reason);
  return value;
}

function validInstitutionId(value: string): string {
  if (!UUID_PATTERN.test(value)) throw new Error("institution_scope_invalid");
  return value;
}

function toIso(value: Date | string, reason: string): string {
  const parsed = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(parsed.getTime())) throw new Error(reason);
  return parsed.toISOString();
}

export async function claimCommunicationWebmailJobs(input: {
  tx: CommunicationTransaction;
  institutionId: string;
  limit?: number;
  now?: Date;
}): Promise<ClaimedCommunicationWebmailJob[]> {
  const limit = boundedInteger(input.limit ?? 10, 1, 20, "claim_limit_invalid");
  const now = validDate(input.now ?? new Date(), "claim_time_invalid");
  validInstitutionId(input.institutionId);
  const result = await input.tx.execute(sql<ClaimedRow>`
    with candidates as (
      select id
      from public.communication_jobs
      where institution_id = ${input.institutionId}::uuid
        and status in ('pending', 'retry')
        and job_type in ('send_delivery', 'retry_delivery')
        and version_id is not null
        and version is not null
        and delivery_id is not null
        and run_after <= ${now}
      order by run_after asc, created_at asc, id asc
      for update skip locked
      limit ${limit}
    )
    update public.communication_jobs as job
    set status = 'running',
        locked_at = ${now},
        updated_at = ${now}
    from candidates
    where job.id = candidates.id
      and job.institution_id = ${input.institutionId}::uuid
      and job.status in ('pending', 'retry')
    returning
      job.id as job_id,
      job.institution_id,
      job.communication_id,
      job.version_id,
      job.version,
      job.delivery_id,
      job.job_type,
      job.attempt_count,
      job.locked_at
  `);
  return Array.from(result as unknown as ClaimedRow[]).map((row) => ({
    jobId: row.job_id,
    institutionId: row.institution_id,
    communicationId: row.communication_id,
    versionId: row.version_id,
    version: row.version,
    deliveryId: row.delivery_id,
    jobType: row.job_type,
    attemptCount: row.attempt_count,
    lockedAt: toIso(row.locked_at, "claimed_lock_time_invalid"),
  }));
}

export async function recoverStaleCommunicationWebmailJobs(input: {
  tx: CommunicationTransaction;
  institutionId: string;
  staleAfterMs?: number;
  limit?: number;
  now?: Date;
}): Promise<RecoveredCommunicationWebmailJob[]> {
  const staleAfterMs = boundedInteger(
    input.staleAfterMs ?? 5 * 60 * 1000,
    2 * 60 * 1000,
    30 * 60 * 1000,
    "stale_delay_invalid"
  );
  const limit = boundedInteger(input.limit ?? 20, 1, 100, "recovery_limit_invalid");
  const now = validDate(input.now ?? new Date(), "recovery_time_invalid");
  validInstitutionId(input.institutionId);
  const staleBefore = new Date(now.getTime() - staleAfterMs);
  const retryAt = new Date(now.getTime() + 60 * 1000);
  const result = await input.tx.execute(sql<RecoveredRow>`
    with candidates as (
      select id
      from public.communication_jobs
      where institution_id = ${input.institutionId}::uuid
        and status = 'running'
        and job_type in ('send_delivery', 'retry_delivery')
        and locked_at < ${staleBefore}
      order by locked_at asc, id asc
      for update skip locked
      limit ${limit}
    )
    update public.communication_jobs as job
    set status = case when job.attempt_count + 1 >= 5 then 'dead' else 'retry' end,
        attempt_count = least(job.attempt_count + 1, 20),
        run_after = case when job.attempt_count + 1 >= 5 then job.run_after else ${retryAt} end,
        locked_at = null,
        completed_at = null,
        last_error_code = 'worker_interrupted',
        updated_at = ${now}
    from candidates
    where job.id = candidates.id
      and job.institution_id = ${input.institutionId}::uuid
      and job.status = 'running'
    returning job.id as job_id, job.status, job.attempt_count, job.run_after
  `);
  return Array.from(result as unknown as RecoveredRow[]).map((row) => ({
    jobId: row.job_id,
    status: row.status,
    attemptCount: row.attempt_count,
    runAfter: row.status === "dead" || row.run_after === null
      ? null
      : toIso(row.run_after, "recovered_run_time_invalid"),
  }));
}
