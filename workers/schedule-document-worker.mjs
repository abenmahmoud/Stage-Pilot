import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { promisify } from "node:util";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import WebSocket from "ws";
import { boundedBlobToBuffer } from "./bounded-download.mjs";
import {
  inspectSchedulePdf,
  ScheduleDocumentInspectionError,
} from "./schedule-document-inspector.mjs";
import {
  extractSchedulePageAssets,
  SchedulePageAssetError,
} from "./schedule-page-assets.mjs";
import {
  SCHEDULE_PAGE_ASSET_BUCKET,
  schedulePageAssetStoragePath,
} from "../shared/schedule-page-asset.mjs";

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
    .slice(-90) || "schedule.pdf";
}

async function clamScan(bytes, name) {
  const directory = await mkdtemp(join(tmpdir(), "lyceegest-schedule-"));
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

async function loadSource(job) {
  const [source] = await sql`
    select id, institution_id, original_name, mime_type, size_bytes,
           storage_bucket, storage_path, status, uploaded_by
    from public.schedule_source_versions
    where id = ${job.source_version_id} and institution_id = ${job.institution_id}
    limit 1
  `;
  if (!source) throw new Error("schedule_source_not_found");
  if (["review", "approved", "active", "superseded", "rejected", "failed", "retired"].includes(source.status)) {
    return { source, duplicate: true };
  }
  if (!["uploaded", "quarantined", "processing"].includes(source.status)) {
    return { source, invalid: true };
  }
  return { source, duplicate: false, invalid: false };
}

async function downloadSource(source) {
  const { data, error } = await storage.from(source.storage_bucket).download(source.storage_path);
  if (error || !data) throw new Error("schedule_storage_download_failed");
  try {
    return await boundedBlobToBuffer(data, Number(source.size_bytes), 50 * 1024 * 1024);
  } catch {
    throw new ScheduleDocumentInspectionError("size_mismatch", "Taille différente du dépôt annoncé");
  }
}

async function createPrivatePageAssets(source, bytes, pageCount) {
  const assets = [];
  for await (const asset of extractSchedulePageAssets(bytes, pageCount)) {
    const storagePath = schedulePageAssetStoragePath(
      source.institution_id,
      source.id,
      asset.pageNumber
    );
    const { error } = await storage
      .from(SCHEDULE_PAGE_ASSET_BUCKET)
      .upload(storagePath, asset.bytes, {
        cacheControl: "0",
        contentType: "application/pdf",
        upsert: true,
      });
    if (error) throw new Error("schedule_page_asset_upload_failed");
    assets.push({
      institution_id: source.institution_id,
      source_version_id: source.id,
      page_number: asset.pageNumber,
      storage_bucket: SCHEDULE_PAGE_ASSET_BUCKET,
      storage_path: storagePath,
      mime_type: "application/pdf",
      size_bytes: asset.sizeBytes,
      checksum: asset.checksum,
    });
  }
  if (assets.length !== pageCount) throw new Error("schedule_page_asset_count_mismatch");
  return assets;
}

async function persistReview(source, result, pageAssets, msgId) {
  await sql.begin(async (transaction) => {
    await transaction`
      insert into public.schedule_page_assets ${transaction(
        pageAssets,
        "institution_id",
        "source_version_id",
        "page_number",
        "storage_bucket",
        "storage_path",
        "mime_type",
        "size_bytes",
        "checksum"
      )}
      on conflict (source_version_id, page_number) do update set
        storage_bucket = excluded.storage_bucket,
        storage_path = excluded.storage_path,
        mime_type = excluded.mime_type,
        size_bytes = excluded.size_bytes,
        checksum = excluded.checksum
    `;
    const updated = await transaction`
      update public.schedule_source_versions
      set status = 'review', checksum = ${result.checksum}, page_count = ${result.pageCount},
          validation_summary = ${transaction.json({
            securityScan: "clean",
            pageCountVerified: true,
            pageCountMethod: result.method,
            pageAssetsVerified: true,
            pageAssetCount: pageAssets.length,
            humanMapping: "pending",
            activation: "blocked",
            realDataAllowedInModel: false,
          })}
      where id = ${source.id} and institution_id = ${source.institution_id}
        and status = 'processing'
      returning id
    `;
    if (!updated.length) throw new Error("schedule_source_state_changed");
    await transaction`
      insert into public.schedule_audit (
        institution_id, source_version_id, action, actor_id, summary
      ) values (
        ${source.institution_id}, ${source.id}, 'complete_scan', ${source.uploaded_by},
        ${transaction.json({
          result: "clean",
          pageCount: result.pageCount,
          checksum: result.checksum,
          method: result.method,
        })}
      )
    `;
    await transaction`select pgmq.delete('schedule_document_scan', ${msgId}::bigint)`;
  });
}

async function rejectSource(source, msgId, reason, threat = false) {
  const { error } = await storage.from(source.storage_bucket).remove([source.storage_path]);
  if (error) throw new Error("schedule_storage_delete_failed");
  await sql.begin(async (transaction) => {
    await transaction`
      update public.schedule_source_versions
      set status = 'rejected', checksum = null, page_count = null,
          validation_summary = ${transaction.json({
            securityScan: threat ? "blocked" : "clean",
            reason,
            objectDeleted: true,
            activation: "blocked",
          })}
      where id = ${source.id} and institution_id = ${source.institution_id}
    `;
    await transaction`
      insert into public.schedule_audit (
        institution_id, source_version_id, action, actor_id, summary
      ) values (
        ${source.institution_id}, ${source.id}, 'reject_upload', ${source.uploaded_by},
        ${transaction.json({ reason, objectDeleted: true })}
      )
    `;
    await transaction`select pgmq.delete('schedule_document_scan', ${msgId}::bigint)`;
  });
}

async function markFailure(source, msgId, code) {
  await sql.begin(async (transaction) => {
    await transaction`
      update public.schedule_source_versions
      set status = 'failed', validation_summary = ${transaction.json({
        securityScan: "unavailable",
        reason: code,
        activation: "blocked",
      })}
      where id = ${source.id} and institution_id = ${source.institution_id}
    `;
    await transaction`
      insert into public.schedule_audit (
        institution_id, source_version_id, action, actor_id, summary
      ) values (
        ${source.institution_id}, ${source.id}, 'complete_scan', ${source.uploaded_by},
        ${transaction.json({ result: "failed", reason: code })}
      )
    `;
    await transaction`select pgmq.delete('schedule_document_scan', ${msgId}::bigint)`;
  });
}

async function processMessage(row) {
  let job;
  try {
    job = typeof row.message === "string" ? JSON.parse(row.message) : row.message;
  } catch {
    await sql`select pgmq.archive('schedule_document_scan', ${row.msg_id}::bigint)`;
    return "invalid_job_archived";
  }
  if (
    !job?.job_id ||
    job?.job_type !== "scan_schedule_document" ||
    !job?.source_version_id ||
    !job?.institution_id
  ) {
    await sql`select pgmq.archive('schedule_document_scan', ${row.msg_id}::bigint)`;
    return "invalid_job_archived";
  }

  let loaded;
  try {
    loaded = await loadSource(job);
    if (loaded.duplicate) {
      await sql`select pgmq.delete('schedule_document_scan', ${row.msg_id}::bigint)`;
      return "duplicate";
    }
    if (loaded.invalid) {
      await sql`select pgmq.archive('schedule_document_scan', ${row.msg_id}::bigint)`;
      return "invalid_state_archived";
    }
    const bytes = await downloadSource(loaded.source);
    await sql`
      update public.schedule_source_versions set status = 'quarantined'
      where id = ${loaded.source.id} and status in ('uploaded', 'quarantined', 'processing')
    `;
    const scan = await clamScan(bytes, loaded.source.original_name);
    if (scan === "blocked") {
      await rejectSource(loaded.source, row.msg_id, "antivirus_detected_threat", true);
      return "blocked";
    }
    await sql`
      update public.schedule_source_versions
      set status = 'processing',
          validation_summary = jsonb_build_object(
            'securityScan', 'clean', 'pageCountVerified', false,
            'activation', 'blocked', 'realDataAllowedInModel', false
          )
      where id = ${loaded.source.id} and status = 'quarantined'
    `;
    const result = await inspectSchedulePdf(bytes);
    const pageAssets = await createPrivatePageAssets(loaded.source, bytes, result.pageCount);
    await persistReview(loaded.source, result, pageAssets, row.msg_id);
    return "review";
  } catch (error) {
    const code = error instanceof ScheduleDocumentInspectionError || error instanceof SchedulePageAssetError
      ? error.code
      : error instanceof Error
        ? error.message.slice(0, 120)
        : "unknown_error";
    if (
      loaded?.source
      && (error instanceof ScheduleDocumentInspectionError || error instanceof SchedulePageAssetError)
    ) {
      await rejectSource(loaded.source, row.msg_id, code);
      return "rejected";
    }
    if (loaded?.source && row.read_ct >= 5) {
      await markFailure(loaded.source, row.msg_id, code);
      return "failed";
    }
    if (!loaded && row.read_ct >= 5) {
      await sql`select pgmq.archive('schedule_document_scan', ${row.msg_id}::bigint)`;
      return "unresolved_job_archived";
    }
    if (loaded?.source) {
      await sql`
        update public.schedule_source_versions
        set status = 'quarantined',
            validation_summary = jsonb_build_object(
              'securityScan', 'retrying', 'reason', ${code},
              'activation', 'blocked'
            )
        where id = ${loaded.source.id} and status = 'processing'
      `;
    }
    return "retrying";
  }
}

async function main() {
  const rows = await sql`
    select msg_id, read_ct, message
    from pgmq.read('schedule_document_scan', 300, 2)
  `;
  const outcomes = [];
  for (const row of rows) outcomes.push(await processMessage(row));
  console.log(JSON.stringify({ claimed: rows.length, outcomes }));
  await sql.end();
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : "schedule_document_worker_failed");
  await sql.end({ timeout: 1 });
  process.exitCode = 1;
});
