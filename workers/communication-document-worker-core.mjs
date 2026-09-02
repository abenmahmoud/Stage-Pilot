import { createHash } from "node:crypto";
import { boundedBlobToBuffer } from "./bounded-download.mjs";
import {
  CommunicationDocumentExtractionError,
  extractCommunicationDocument,
} from "./communication-document-extractor.mjs";

const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const errorCodePattern = /^[a-z0-9_]{1,120}$/u;

function machineErrorCode(error) {
  if (error instanceof CommunicationDocumentExtractionError
    && errorCodePattern.test(error.code)) return error.code;
  const message = error instanceof Error ? error.message : "";
  return errorCodePattern.test(message) ? message : "communication_document_worker_failed";
}

function validDependencies(options) {
  return options && typeof options.sql === "function"
    && options.storage && typeof options.storage.from === "function"
    && typeof options.scanBytes === "function"
    && typeof options.extractDocument === "function"
    && Number.isSafeInteger(options.maxBytes)
    && options.maxBytes >= 1
    && options.maxBytes <= DEFAULT_MAX_BYTES;
}

export function createCommunicationDocumentWorker({
  sql,
  storage,
  scanBytes,
  extractDocument = extractCommunicationDocument,
  maxBytes = DEFAULT_MAX_BYTES,
} = {}) {
  const options = { sql, storage, scanBytes, extractDocument, maxBytes };
  if (!validDependencies(options)) {
    throw new Error("communication_document_worker_configuration_invalid");
  }

  async function loadDocument(job) {
    const [document] = await sql`
      select id, institution_id, original_name, mime_type, size_bytes,
             storage_bucket, storage_path, status, checksum,
             extraction_summary, analyzed_at
      from public.communication_source_documents
      where id = ${job.source_document_id}
        and institution_id = ${job.institution_id}
      limit 1
    `;
    if (!document) throw new Error("communication_document_not_found");
    if (document.storage_bucket !== "communication-ingest") {
      throw new Error("communication_document_bucket_invalid");
    }
    if (["review", "used", "rejected", "failed"].includes(document.status)) {
      return { document, terminal: document.status };
    }
    if (!["quarantined", "processing"].includes(document.status)) {
      return { document, terminal: "invalid" };
    }
    return { document, terminal: null };
  }

  async function downloadDocument(document) {
    const { data, error } = await storage
      .from(document.storage_bucket)
      .download(document.storage_path);
    if (error || !data) throw new Error("communication_storage_download_failed");
    try {
      return await boundedBlobToBuffer(data, Number(document.size_bytes), maxBytes);
    } catch {
      throw new CommunicationDocumentExtractionError("size_mismatch", "size_mismatch");
    }
  }

  async function verifyStoredDocument(document) {
    const bytes = await downloadDocument(document);
    try {
      if (!document.checksum
        || createHash("sha256").update(bytes).digest("hex") !== document.checksum) {
        throw new Error("communication_document_digest_mismatch");
      }
    } finally {
      bytes.fill(0);
    }
  }

  async function removeSourceObject(document) {
    const { error } = await storage
      .from(document.storage_bucket)
      .remove([document.storage_path]);
    if (error) throw new Error("communication_source_object_delete_failed");
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

  async function persistRejected(document, reason, checksum = null) {
    await sql.begin(async (transaction) => {
      const updated = await transaction`
        update public.communication_source_documents
        set status = 'rejected', checksum = ${checksum},
            extraction_summary = ${transaction.json({ state: "blocked", reason })},
            extracted_text = null, analysis_error = ${reason}, analyzed_at = now()
        where id = ${document.id} and institution_id = ${document.institution_id}
          and status in ('quarantined', 'processing')
        returning id
      `;
      if (!updated.length) throw new Error("communication_document_state_changed");
      await transaction`
        insert into public.communication_source_events (
          institution_id, source_document_id, event_type, actor_user_id, actor_type, summary
        ) values (
          ${document.institution_id}, ${document.id}, 'source.rejected', null, 'system',
          ${transaction.json({ reason })}
        )
      `;
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
      const updated = await transaction`
        update public.communication_source_documents
        set status = 'review', checksum = ${result.checksum},
            extraction_summary = ${transaction.json(summary)},
            extracted_text = ${result.extractedText}, analysis_error = null, analyzed_at = now()
        where id = ${document.id} and institution_id = ${document.institution_id}
          and status = 'processing'
        returning id
      `;
      if (!updated.length) throw new Error("communication_document_state_changed");
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

  async function persistFailure(document, msgId, code) {
    await sql.begin(async (transaction) => {
      const updated = await transaction`
        update public.communication_source_documents
        set status = 'failed',
            extraction_summary = ${transaction.json({ state: "failed", reason: code })},
            extracted_text = null, analysis_error = ${code}, analyzed_at = now()
        where id = ${document.id} and institution_id = ${document.institution_id}
          and status in ('quarantined', 'processing', 'review')
        returning id
      `;
      if (updated.length) {
        await transaction`
          insert into public.communication_source_events (
            institution_id, source_document_id, event_type, actor_user_id, actor_type, summary
          ) values (
            ${document.institution_id}, ${document.id}, 'source.failed', null, 'system',
            ${transaction.json({ reason: code })}
          )
        `;
      }
      await transaction`select pgmq.archive('communication_document_scan', ${msgId}::bigint)`;
    });
  }

  async function archiveCleanupFailure(document, msgId, code) {
    await sql.begin(async (transaction) => {
      await transaction`
        insert into public.communication_source_events (
          institution_id, source_document_id, event_type, actor_user_id, actor_type, summary
        ) values (
          ${document.institution_id}, ${document.id}, 'source.failed', null, 'system',
          ${transaction.json({ reason: code, terminalStatus: document.status })}
        )
      `;
      await transaction`select pgmq.archive('communication_document_scan', ${msgId}::bigint)`;
    });
  }

  async function finishTerminal(document, terminal, msgId) {
    if (terminal === "invalid") {
      await sql`select pgmq.archive('communication_document_scan', ${msgId}::bigint)`;
      return "invalid_state_archived";
    }
    if (terminal === "review") await verifyStoredDocument(document);
    if (terminal === "rejected") await removeSourceObject(document);
    await sql`select pgmq.delete('communication_document_scan', ${msgId}::bigint)`;
    return terminal;
  }

  async function analyzeDocument(document, msgId) {
    const bytes = await downloadDocument(document);
    try {
      const verdict = await scanBytes({
        bytes,
        document: {
          id: document.id,
          institutionId: document.institution_id,
          originalName: document.original_name,
          mimeType: document.mime_type,
          sizeBytes: Number(document.size_bytes),
        },
      });
      if (verdict === "blocked") {
        await persistRejected(document, "antivirus_detected_threat");
        await removeSourceObject(document);
        await sql`select pgmq.delete('communication_document_scan', ${msgId}::bigint)`;
        return "blocked";
      }
      if (verdict !== "clean") throw new Error("antivirus_unavailable");
      await sql`
        update public.communication_source_documents
        set status = 'processing', analysis_error = null
        where id = ${document.id} and institution_id = ${document.institution_id}
          and status = 'quarantined'
      `;
      const result = await extractDocument({ bytes, mimeType: document.mime_type });
      const checksum = createHash("sha256").update(bytes).digest("hex");
      if (result.checksum !== checksum) throw new Error("communication_extraction_digest_mismatch");
      if (await findDuplicate(document, checksum)) {
        await persistRejected(document, "duplicate_checksum");
        await removeSourceObject(document);
        await sql`select pgmq.delete('communication_document_scan', ${msgId}::bigint)`;
        return "duplicate_source";
      }
      await persistReview(document, result, msgId);
      return "review";
    } finally {
      bytes.fill(0);
    }
  }

  async function processMessage(row) {
    let job = null;
    let loaded = null;
    try {
      try {
        job = typeof row.message === "string" ? JSON.parse(row.message) : row.message;
      } catch {
        await sql`select pgmq.archive('communication_document_scan', ${row.msg_id}::bigint)`;
        return "invalid_job_archived";
      }
      if (!job || job.job_type !== "scan_communication_document"
        || !uuidPattern.test(job.job_id ?? "")
        || !uuidPattern.test(job.source_document_id ?? "")
        || !uuidPattern.test(job.institution_id ?? "")) {
        await sql`select pgmq.archive('communication_document_scan', ${row.msg_id}::bigint)`;
        return "invalid_job_archived";
      }
      loaded = await loadDocument(job);
      return await (loaded.terminal
        ? finishTerminal(loaded.document, loaded.terminal, row.msg_id)
        : analyzeDocument(loaded.document, row.msg_id));
    } catch (error) {
      const code = machineErrorCode(error);
      const extractionFailure = error instanceof CommunicationDocumentExtractionError;
      if (loaded?.document && (extractionFailure || Number(row.read_ct) >= 5)) {
        const current = code === "communication_source_object_delete_failed"
          ? await loadDocument(job)
          : loaded;
        if (code === "communication_source_object_delete_failed"
          && current.terminal === "rejected") {
          await archiveCleanupFailure(current.document, row.msg_id, code);
        } else {
          await persistFailure(current.document, row.msg_id, code);
        }
        return "failed";
      }
      if (!loaded && Number(row.read_ct) >= 5) {
        await sql`select pgmq.archive('communication_document_scan', ${row.msg_id}::bigint)`;
        return "unresolved_job_archived";
      }
      if (loaded?.document) {
        await sql`
          update public.communication_source_documents
          set status = 'quarantined', analysis_error = 'retry_scheduled'
          where id = ${loaded.document.id}
            and institution_id = ${loaded.document.institution_id}
            and status = 'processing'
        `;
      }
      return "retrying";
    }
  }

  async function runBatch({ visibilitySeconds = 300, limit = 2 } = {}) {
    if (!Number.isInteger(visibilitySeconds) || visibilitySeconds < 1 || visibilitySeconds > 900
      || !Number.isInteger(limit) || limit < 1 || limit > 20) {
      throw new Error("communication_document_worker_batch_invalid");
    }
    const rows = await sql`
      select msg_id, read_ct, message
      from pgmq.read('communication_document_scan', ${visibilitySeconds}, ${limit})
    `;
    const outcomes = [];
    for (const row of rows) outcomes.push(await processMessage(row));
    return { claimed: rows.length, outcomes };
  }

  return { processMessage, runBatch };
}
