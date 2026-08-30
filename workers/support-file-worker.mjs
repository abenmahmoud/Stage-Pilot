import { createHash, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { promisify } from "node:util";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import WebSocket from "ws";
import { boundedBlobToBuffer, readBoundedResponseBytes } from "./bounded-download.mjs";

const execFileAsync = promisify(execFile);
const databaseUrl = process.env.DATABASE_URL;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const brevoApiKey = process.env.BREVO_API_KEY;
if (!databaseUrl || !supabaseUrl || !serviceRoleKey) {
  throw new Error("DATABASE_URL, SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
}

const sql = postgres(databaseUrl, { prepare: false, max: 2, idle_timeout: 20 });
const storage = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: { transport: WebSocket },
}).storage;
const maxBytes = 10 * 1024 * 1024;

function safeName(value) {
  return basename(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .slice(-90) || "document";
}

async function downloadBrowserAttachment(job) {
  const [attachment] = await sql`
    select attachment.id, attachment.storage_bucket, attachment.storage_path,
           attachment.original_name, attachment.detected_mime, attachment.declared_mime,
           attachment.size_bytes
    from public.support_attachments as attachment
    join public.support_requests as request on request.id = attachment.request_id
    where attachment.id = ${job.attachment_id}
      and attachment.request_id = ${job.request_id}
      and request.institution_id = ${job.institution_id}
    limit 1
  `;
  if (!attachment) throw new Error("attachment_not_found");
  const { data, error } = await storage.from(attachment.storage_bucket).download(attachment.storage_path);
  if (error || !data) throw new Error("storage_download_failed");
  let bytes;
  try {
    bytes = await boundedBlobToBuffer(data, Number(attachment.size_bytes), maxBytes);
  } catch {
    throw new Error("attachment_size_invalid");
  }
  return {
    attachmentId: attachment.id,
    bucket: attachment.storage_bucket,
    path: attachment.storage_path,
    name: attachment.original_name,
    mimeType: attachment.detected_mime ?? attachment.declared_mime,
    bytes,
  };
}

async function downloadInboundAttachment(job) {
  if (!brevoApiKey || !job.download_token) throw new Error("brevo_attachment_config_missing");
  const [request] = await sql`
    select request.id
    from public.support_requests as request
    join public.support_messages as message on message.request_id = request.id
    where request.id = ${job.request_id}
      and request.institution_id = ${job.institution_id}
      and message.id = ${job.message_id}
    limit 1
  `;
  if (!request) throw new Error("attachment_request_not_found");
  const response = await fetch(
    `https://api.brevo.com/v3/inbound/attachments/${encodeURIComponent(job.download_token)}`,
    { headers: { accept: "application/octet-stream", "api-key": brevoApiKey } }
  );
  if (!response.ok) throw new Error(`brevo_attachment_${response.status}`);
  let bytes;
  try {
    bytes = await readBoundedResponseBytes(response, maxBytes);
  } catch {
    throw new Error("attachment_size_invalid");
  }
  const attachmentId = randomUUID();
  const name = safeName(job.file_name ?? "document");
  const path = `${job.request_id}/inbound/${job.job_id}/${name}`;
  const { error: uploadError } = await storage
    .from("support-quarantine")
    .upload(path, bytes, { contentType: job.mime_type ?? "application/octet-stream", upsert: true });
  if (uploadError) throw new Error("storage_upload_failed");

  const digest = createHash("sha256").update(bytes).digest("hex");
  const rows = await sql`
    insert into public.support_attachments (
      id, request_id, message_id, concerns_type, document_type, original_name,
      declared_mime, detected_mime, size_bytes, sha256, storage_bucket,
      storage_path, scan_status, scan_detail, retention_until, uploaded_at
    ) values (
      ${attachmentId}, ${job.request_id}, ${job.message_id ?? null}, 'demande',
      'piece_email', ${name}, ${job.mime_type ?? "application/octet-stream"},
      ${job.mime_type ?? "application/octet-stream"}, ${bytes.length}, ${digest},
      'support-quarantine', ${path}, 'quarantine', 'awaiting_antivirus',
      now() + interval '90 days', now()
    )
    on conflict (storage_path) do update set uploaded_at = excluded.uploaded_at
    returning id
  `;
  return {
    attachmentId: rows[0].id,
    bucket: "support-quarantine",
    path,
    name,
    mimeType: job.mime_type ?? "application/octet-stream",
    bytes,
  };
}

async function clamScan(bytes, name) {
  const directory = await mkdtemp(join(tmpdir(), "lyceegest-scan-"));
  const filePath = join(directory, safeName(name));
  try {
    await writeFile(filePath, bytes, { flag: "wx" });
    try {
      await execFileAsync(process.env.CLAMDSCAN_PATH ?? "clamdscan", ["--stream", "--no-summary", filePath], {
        timeout: 120000,
        windowsHide: true,
      });
      return "clean";
    } catch (error) {
      if (error && typeof error === "object" && error.code === 1) return "blocked";
      throw new Error("antivirus_unavailable");
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function scanJob(job) {
  const file = job.job_type === "import_brevo_attachment"
    ? await downloadInboundAttachment(job)
    : await downloadBrowserAttachment(job);
  if (file.bytes.length < 1 || file.bytes.length > maxBytes) throw new Error("attachment_size_invalid");
  const result = await clamScan(file.bytes, file.name);
  if (result === "blocked") {
    await sql`
      update public.support_attachments
      set scan_status = 'blocked', scan_detail = 'antivirus_detected_threat'
      where id = ${file.attachmentId} and request_id = ${job.request_id}
    `;
    return "blocked";
  }

  const { error: cleanUploadError } = await storage
    .from("support-clean")
    .upload(file.path, file.bytes, { contentType: file.mimeType, upsert: true });
  if (cleanUploadError) throw new Error("clean_storage_upload_failed");
  const { error: quarantineDeleteError } = await storage.from(file.bucket).remove([file.path]);
  if (quarantineDeleteError) throw new Error("quarantine_delete_failed");
  await sql`
    update public.support_attachments
    set storage_bucket = 'support-clean', scan_status = 'clean', scan_detail = 'clamav_clean'
    where id = ${file.attachmentId} and request_id = ${job.request_id}
  `;
  return "clean";
}

async function processMessage(row) {
  const job = typeof row.message === "string" ? JSON.parse(row.message) : row.message;
  if (!job?.job_id || !job?.job_type || !job?.institution_id || !job?.request_id) {
    throw new Error("invalid_scan_job");
  }
  try {
    const result = await scanJob(job);
    await sql.begin(async (transaction) => {
      await transaction`
        insert into public.support_job_runs (
          institution_id, job_id, job_type, request_id, attempt, status, provider_reference
        ) values (
          ${job.institution_id}, ${job.job_id}, ${job.job_type}, ${job.request_id},
          ${row.read_ct}, 'success', ${result}
        )
        on conflict (institution_id, job_id, attempt) do nothing
      `;
      await transaction`select pgmq.delete('support_file_scan', ${row.msg_id}::bigint)`;
    });
    return "processed";
  } catch (error) {
    const code = error instanceof Error ? error.message.slice(0, 120) : "unknown_error";
    await sql`
      insert into public.support_job_runs (
        institution_id, job_id, job_type, request_id, attempt, status, error_code
      ) values (
        ${job.institution_id}, ${job.job_id}, ${job.job_type}, ${job.request_id},
        ${row.read_ct}, 'failure', ${code}
      )
      on conflict (institution_id, job_id, attempt) do nothing
    `;
    if (row.read_ct >= 5) {
      await sql.begin(async (transaction) => {
        await transaction`
          insert into public.support_failed_jobs (
            institution_id, job_id, request_id, job_type, payload_redacted, attempts,
            last_error_code, last_error_summary
          ) values (
            ${job.institution_id}, ${job.job_id}, ${job.request_id}, ${job.job_type},
            ${transaction.json({ attachmentId: job.attachment_id ?? null })},
            ${row.read_ct}, ${code}, 'Échec du contrôle de fichier'
          ) on conflict (institution_id, job_id) do nothing
        `;
        await transaction`
          update public.support_attachments
          set scan_status = 'scan_error', scan_detail = ${code}
          where id = ${job.attachment_id ?? "00000000-0000-0000-0000-000000000000"}
            and request_id = ${job.request_id}
        `;
        await transaction`select pgmq.archive('support_file_scan', ${row.msg_id}::bigint)`;
      });
      return "failed";
    }
    return "retrying";
  }
}

async function main() {
  const rows = await sql`
    select msg_id, read_ct, message
    from pgmq.read('support_file_scan', 300, 10)
  `;
  const outcomes = [];
  for (const row of rows) outcomes.push(await processMessage(row));
  console.log(JSON.stringify({ claimed: rows.length, outcomes }));
  await sql.end();
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : "file_worker_failed");
  await sql.end({ timeout: 1 });
  process.exitCode = 1;
});
