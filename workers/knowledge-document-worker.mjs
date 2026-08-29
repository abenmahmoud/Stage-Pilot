import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { promisify } from "node:util";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import WebSocket from "ws";
import {
  KnowledgeDocumentExtractionError,
  extractKnowledgeDocument,
} from "./knowledge-document-extractor.mjs";

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
  const directory = await mkdtemp(join(tmpdir(), "lyceegest-knowledge-"));
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
    select id, institution_id, title, original_name, mime_type, size_bytes,
           classification, storage_bucket, storage_path, status
    from public.knowledge_documents
    where id = ${job.document_id} and institution_id = ${job.institution_id}
    limit 1
  `;
  if (!document) throw new Error("knowledge_document_not_found");
  if (["review", "ready", "rejected", "failed"].includes(document.status)) {
    return { document, duplicate: true };
  }
  if (!["uploaded", "quarantined", "processing"].includes(document.status)) {
    return { document, invalid: true };
  }
  return { document, duplicate: false, invalid: false };
}

async function downloadDocument(document) {
  const { data, error } = await storage
    .from(document.storage_bucket)
    .download(document.storage_path);
  if (error || !data) throw new Error("knowledge_storage_download_failed");
  const bytes = Buffer.from(await data.arrayBuffer());
  if (bytes.length !== Number(document.size_bytes)) {
    throw new KnowledgeDocumentExtractionError(
      "size_mismatch",
      "Taille différente du dépôt annoncé"
    );
  }
  return bytes;
}

function analysisLabel(result) {
  if (result.summary.state === "extracted") {
    const suffix = result.summary.truncated ? " Extrait borné à 120 000 caractères." : "";
    return `Antivirus validé. Texte extrait localement (${result.summary.storedCharacters} caractères).${suffix}`;
  }
  if (result.summary.reason === "privacy_signal_detected") {
    return "Antivirus validé. Données privées ou codes potentiels détectés : lecture humaine obligatoire.";
  }
  if (result.summary.reason === "sensitive_classification") {
    return "Antivirus validé. Document personnel ou sensible : aucune extraction automatique conservée.";
  }
  if (result.summary.reason === "instruction_signal_detected") {
    return "Antivirus validé. Consigne visant potentiellement l’agent détectée : lecture humaine obligatoire.";
  }
  return "Antivirus validé. Ce format nécessite une lecture humaine.";
}

async function persistReview(document, result, msgId) {
  await sql.begin(async (transaction) => {
    await transaction`
      update public.knowledge_documents
      set status = 'review', checksum = ${result.checksum},
          analysis_summary = ${analysisLabel(result)},
          proposed_knowledge = ${transaction.json(result.proposedKnowledge)},
          analysis_error = null, analyzed_at = now()
      where id = ${document.id} and institution_id = ${document.institution_id}
    `;
    await transaction`
      insert into public.agent_skill_audit (
        institution_id, resource_type, resource_id, action, actor_id, summary
      ) values (
        ${document.institution_id}, 'document', ${document.id},
        'complete_analysis', null,
        ${transaction.json({
          result: result.summary.state,
          method: result.summary.method ?? null,
          reason: result.summary.reason ?? null,
          privacySignals: result.proposedKnowledge.privacySignals ?? [],
          safetySignals: result.proposedKnowledge.safetySignals ?? [],
          checksum: result.checksum,
        })}
      )
    `;
    await transaction`select pgmq.delete('knowledge_document_scan', ${msgId}::bigint)`;
  });
}

async function rejectThreat(document, msgId) {
  await storage.from(document.storage_bucket).remove([document.storage_path]);
  await sql.begin(async (transaction) => {
    await transaction`
      update public.knowledge_documents
      set status = 'rejected', analysis_summary = 'Fichier bloqué par l’antivirus.',
          analysis_error = 'Une menace a été détectée. Le fichier a été supprimé.',
          proposed_knowledge = '{}'::jsonb, analyzed_at = now()
      where id = ${document.id} and institution_id = ${document.institution_id}
    `;
    await transaction`
      insert into public.agent_skill_audit (
        institution_id, resource_type, resource_id, action, actor_id, summary
      ) values (
        ${document.institution_id}, 'document', ${document.id},
        'reject_upload', null,
        ${transaction.json({ reason: "antivirus_detected_threat" })}
      )
    `;
    await transaction`select pgmq.delete('knowledge_document_scan', ${msgId}::bigint)`;
  });
}

async function markFailure(document, msgId, code) {
  await sql.begin(async (transaction) => {
    await transaction`
      update public.knowledge_documents
      set status = 'failed', analysis_summary = 'Analyse locale impossible.',
          analysis_error = ${code}, proposed_knowledge = '{}'::jsonb, analyzed_at = now()
      where id = ${document.id} and institution_id = ${document.institution_id}
    `;
    await transaction`
      insert into public.agent_skill_audit (
        institution_id, resource_type, resource_id, action, actor_id, summary
      ) values (
        ${document.institution_id}, 'document', ${document.id},
        'complete_analysis', null,
        ${transaction.json({ result: "failed", reason: code })}
      )
    `;
    await transaction`select pgmq.delete('knowledge_document_scan', ${msgId}::bigint)`;
  });
}

async function processMessage(row) {
  let job;
  try {
    job = typeof row.message === "string" ? JSON.parse(row.message) : row.message;
  } catch {
    await sql`select pgmq.archive('knowledge_document_scan', ${row.msg_id}::bigint)`;
    return "invalid_job_archived";
  }
  if (
    !job?.job_id ||
    job?.job_type !== "scan_knowledge_document" ||
    !job?.document_id ||
    !job?.institution_id
  ) {
    await sql`select pgmq.archive('knowledge_document_scan', ${row.msg_id}::bigint)`;
    return "invalid_job_archived";
  }

  let loaded;
  try {
    loaded = await loadDocument(job);
    if (loaded.duplicate) {
      await sql`select pgmq.delete('knowledge_document_scan', ${row.msg_id}::bigint)`;
      return "duplicate";
    }
    if (loaded.invalid) {
      await sql`select pgmq.archive('knowledge_document_scan', ${row.msg_id}::bigint)`;
      return "invalid_state_archived";
    }
    const bytes = await downloadDocument(loaded.document);
    await sql`
      update public.knowledge_documents set status = 'quarantined'
      where id = ${loaded.document.id}
        and status in ('uploaded', 'quarantined', 'processing')
    `;
    const scan = await clamScan(bytes, loaded.document.original_name);
    if (scan === "blocked") {
      await rejectThreat(loaded.document, row.msg_id);
      return "blocked";
    }
    await sql`
      update public.knowledge_documents
      set status = 'processing', analysis_summary = 'Extraction locale en cours.'
      where id = ${loaded.document.id} and status = 'quarantined'
    `;
    const result = await extractKnowledgeDocument({
      bytes,
      mimeType: loaded.document.mime_type,
      classification: loaded.document.classification,
    });
    await persistReview(loaded.document, result, row.msg_id);
    return "review";
  } catch (error) {
    const code = error instanceof KnowledgeDocumentExtractionError
      ? error.code
      : error instanceof Error
        ? error.message.slice(0, 120)
        : "unknown_error";
    if (loaded?.document && error instanceof KnowledgeDocumentExtractionError) {
      await markFailure(loaded.document, row.msg_id, code);
      return "failed";
    }
    if (loaded?.document && row.read_ct >= 5) {
      await markFailure(loaded.document, row.msg_id, code);
      return "failed";
    }
    if (!loaded && row.read_ct >= 5) {
      await sql`select pgmq.archive('knowledge_document_scan', ${row.msg_id}::bigint)`;
      return "unresolved_job_archived";
    }
    if (loaded?.document) {
      await sql`
        update public.knowledge_documents
        set status = 'quarantined', analysis_summary = 'Nouvelle tentative planifiée.'
        where id = ${loaded.document.id} and status = 'processing'
      `;
    }
    return "retrying";
  }
}

async function main() {
  const rows = await sql`
    select msg_id, read_ct, message
    from pgmq.read('knowledge_document_scan', 300, 2)
  `;
  const outcomes = [];
  for (const row of rows) outcomes.push(await processMessage(row));
  console.log(JSON.stringify({ claimed: rows.length, outcomes }));
  await sql.end();
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : "knowledge_document_worker_failed");
  await sql.end({ timeout: 1 });
  process.exitCode = 1;
});
