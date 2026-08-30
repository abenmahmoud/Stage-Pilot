import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { promisify } from "node:util";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import WebSocket from "ws";
import {
  CommunicationDocumentExtractionError,
  extractCommunicationDocument,
} from "./communication-document-extractor.mjs";

const execFileAsync = promisify(execFile);
const databaseUrl = process.env.DATABASE_URL;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!databaseUrl || !supabaseUrl || !serviceRoleKey) {
  throw new Error("DATABASE_URL, SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
}

const sql = postgres(databaseUrl, { prepare: false, max: 2, idle_timeout: 20 });
const storage = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: { transport: WebSocket },
}).storage;

function safeName(value) {
  return basename(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .slice(-90) || "document";
}

async function clamScan(bytes, name) {
  const directory = await mkdtemp(join(tmpdir(), "lyceegest-communication-"));
  const filePath = join(directory, safeName(name));
  try {
    await writeFile(filePath, bytes, { flag: "wx" });
    try {
      await execFileAsync(
        process.env.CLAMDSCAN_PATH ?? "clamdscan",
        ["--stream", "--no-summary", filePath],
        { timeout: 120000, windowsHide: true }
      );
      return "clean";
    } catch (error) {
      if (error && typeof error === "object" && error.code === 1) return "blocked";
      throw new Error("antivirus_unavailable");
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function loadDocument(job) {
  const [document] = await sql`
    select id, institution_id, original_name, mime_type, size_bytes,
           storage_bucket, storage_path, status
    from public.communication_source_documents
    where id = ${job.source_document_id} and institution_id = ${job.institution_id}
    limit 1
  `;
  if (!document) throw new Error("communication_document_not_found");
  if (["review", "used", "rejected", "failed"].includes(document.status)) {
    return { document, duplicate: true, invalid: false };
  }
  if (!["quarantined", "processing"].includes(document.status)) {
    return { document, duplicate: false, invalid: true };
  }
  return { document, duplicate: false, invalid: false };
}

async function downloadDocument(document) {
  const { data, error } = await storage
    .from(document.storage_bucket)
    .download(document.storage_path);
  if (error || !data) throw new Error("communication_storage_download_failed");
  const bytes = Buffer.from(await data.arrayBuffer());
  if (bytes.length !== Number(document.size_bytes)) {
    throw new CommunicationDocumentExtractionError(
      "size_mismatch",
      "Taille différente du dépôt annoncé"
    );
  }
  return bytes;
}

async function findDuplicate(document, checksum) {
  const [duplicate] = await sql`
    select 1
    from public.communication_source_documents
    where institution_id = ${document.institution_id}
      and id <> ${document.id}
      and checksum = ${checksum}
      and status not in ('rejected', 'failed')
    limit 1
  `;
  return Boolean(duplicate);
}

async function rejectDuplicate(document, checksum, msgId) {
  const { error } = await storage.from(document.storage_bucket).remove([document.storage_path]);
  if (error) throw new Error("communication_duplicate_removal_failed");
  await sql.begin(async (transaction) => {
    await transaction`
      update public.communication_source_documents
      set status = 'rejected', checksum = null,
          extraction_summary = ${transaction.json({ state: "manual_review", reason: "duplicate_source" })},
          extracted_text = null, analysis_error = 'Document déjà déposé.', analyzed_at = now()
      where id = ${document.id} and institution_id = ${document.institution_id}
        and status = 'processing'
    `;
    await transaction`
      insert into public.communication_source_events (
        institution_id, source_document_id, event_type, actor_user_id, actor_type, summary
      ) values (
        ${document.institution_id}, ${document.id}, 'source.rejected', null, 'system',
        ${transaction.json({ reason: "duplicate_checksum", checksum })}
      )
    `;
    await transaction`select pgmq.delete('communication_document_scan', ${msgId}::bigint)`;
  });
}

async function persistReview(document, result, msgId) {
  const summary = {
    state: result.state,
    reason: result.reason,
    method: result.method,
    pages: result.pages,
    warnings: result.warnings,
    privacySignals: result.privacySignals,
    safetySignals: result.safetySignals,
    reviewProposal: result.reviewProposal,
    truncated: result.truncated,
  };
  await sql.begin(async (transaction) => {
    await transaction`
      update public.communication_source_documents
      set status = 'review', checksum = ${result.checksum},
          extraction_summary = ${transaction.json(summary)},
          extracted_text = ${result.extractedText}, analysis_error = null, analyzed_at = now()
      where id = ${document.id} and institution_id = ${document.institution_id}
        and status = 'processing'
    `;
    await transaction`
      insert into public.communication_source_events (
        institution_id, source_document_id, event_type, actor_user_id, actor_type, summary
      ) values (
        ${document.institution_id}, ${document.id}, 'source.scanned', null, 'system',
        ${transaction.json({
          result: result.state,
          reason: result.reason,
          method: result.method,
          privacySignals: result.privacySignals,
          safetySignals: result.safetySignals,
          checksum: result.checksum,
        })}
      )
    `;
    await transaction`select pgmq.delete('communication_document_scan', ${msgId}::bigint)`;
  });
}

async function rejectThreat(document, msgId) {
  const { error } = await storage.from(document.storage_bucket).remove([document.storage_path]);
  if (error) throw new Error("communication_threat_removal_failed");
  await sql.begin(async (transaction) => {
    await transaction`
      update public.communication_source_documents
      set status = 'rejected', extraction_summary = ${transaction.json({
        state: "blocked",
        reason: "antivirus_detected_threat",
      })}, extracted_text = null,
          analysis_error = 'Une menace a été détectée. Le fichier a été supprimé.', analyzed_at = now()
      where id = ${document.id} and institution_id = ${document.institution_id}
    `;
    await transaction`
      insert into public.communication_source_events (
        institution_id, source_document_id, event_type, actor_user_id, actor_type, summary
      ) values (
        ${document.institution_id}, ${document.id}, 'source.rejected', null, 'system',
        ${transaction.json({ reason: "antivirus_detected_threat" })}
      )
    `;
    await transaction`select pgmq.delete('communication_document_scan', ${msgId}::bigint)`;
  });
}

async function markFailure(document, msgId, code) {
  await sql.begin(async (transaction) => {
    await transaction`
      update public.communication_source_documents
      set status = 'failed', extraction_summary = ${transaction.json({ state: "failed", reason: code })},
          extracted_text = null, analysis_error = ${code.slice(0, 500)}, analyzed_at = now()
      where id = ${document.id} and institution_id = ${document.institution_id}
    `;
    await transaction`
      insert into public.communication_source_events (
        institution_id, source_document_id, event_type, actor_user_id, actor_type, summary
      ) values (
        ${document.institution_id}, ${document.id}, 'source.failed', null, 'system',
        ${transaction.json({ reason: code.slice(0, 120) })}
      )
    `;
    await transaction`select pgmq.delete('communication_document_scan', ${msgId}::bigint)`;
  });
}

async function processMessage(row) {
  let job;
  try {
    job = typeof row.message === "string" ? JSON.parse(row.message) : row.message;
  } catch {
    await sql`select pgmq.archive('communication_document_scan', ${row.msg_id}::bigint)`;
    return "invalid_job_archived";
  }
  if (
    !job?.job_id
    || job.job_type !== "scan_communication_document"
    || !job.source_document_id
    || !job.institution_id
  ) {
    await sql`select pgmq.archive('communication_document_scan', ${row.msg_id}::bigint)`;
    return "invalid_job_archived";
  }

  let loaded;
  try {
    loaded = await loadDocument(job);
    if (loaded.duplicate) {
      await sql`select pgmq.delete('communication_document_scan', ${row.msg_id}::bigint)`;
      return "duplicate";
    }
    if (loaded.invalid) {
      await sql`select pgmq.archive('communication_document_scan', ${row.msg_id}::bigint)`;
      return "invalid_state_archived";
    }
    const bytes = await downloadDocument(loaded.document);
    const scan = await clamScan(bytes, loaded.document.original_name);
    if (scan === "blocked") {
      await rejectThreat(loaded.document, row.msg_id);
      return "blocked";
    }
    await sql`
      update public.communication_source_documents
      set status = 'processing', analysis_error = null
      where id = ${loaded.document.id} and institution_id = ${loaded.document.institution_id}
        and status = 'quarantined'
    `;
    const result = await extractCommunicationDocument({
      bytes,
      mimeType: loaded.document.mime_type,
    });
    if (await findDuplicate(loaded.document, result.checksum)) {
      await rejectDuplicate(loaded.document, result.checksum, row.msg_id);
      return "duplicate_source";
    }
    await persistReview(loaded.document, result, row.msg_id);
    return "review";
  } catch (error) {
    const code = error instanceof CommunicationDocumentExtractionError
      ? error.code
      : error instanceof Error
        ? error.message.slice(0, 120)
        : "unknown_error";
    if (loaded?.document && error instanceof CommunicationDocumentExtractionError) {
      await markFailure(loaded.document, row.msg_id, code);
      return "failed";
    }
    if (loaded?.document && Number(row.read_ct) >= 5) {
      await markFailure(loaded.document, row.msg_id, code);
      return "failed";
    }
    if (!loaded && Number(row.read_ct) >= 5) {
      await sql`select pgmq.archive('communication_document_scan', ${row.msg_id}::bigint)`;
      return "unresolved_job_archived";
    }
    if (loaded?.document) {
      await sql`
        update public.communication_source_documents
        set status = 'quarantined', analysis_error = 'Nouvelle tentative planifiée.'
        where id = ${loaded.document.id} and institution_id = ${loaded.document.institution_id}
          and status = 'processing'
      `;
    }
    return "retrying";
  }
}

async function main() {
  const rows = await sql`
    select msg_id, read_ct, message
    from pgmq.read('communication_document_scan', 300, 2)
  `;
  const outcomes = [];
  for (const row of rows) outcomes.push(await processMessage(row));
  console.log(JSON.stringify({ claimed: rows.length, outcomes }));
  await sql.end();
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : "communication_document_worker_failed");
  await sql.end({ timeout: 1 });
  process.exitCode = 1;
});
