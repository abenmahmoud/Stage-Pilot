import { createHash } from "node:crypto";
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
  inspectSupportOfficeArchive,
  SupportOfficeArchiveError,
} from "./support-office-archive-policy.mjs";

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
const maxBytes = 10 * 1024 * 1024;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function safeName(value) {
  return basename(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .slice(-90) || "document";
}

async function clamScan(bytes, name) {
  const directory = await mkdtemp(join(tmpdir(), "lyceegest-content-scan-"));
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

async function loadAsset(assetId) {
  const [asset] = await sql`
    select id, storage_bucket, storage_path, original_name, mime_type,
           size_bytes, status, scan_detail, sha256
    from public.site_content_assets
    where id = ${assetId}
    limit 1
  `;
  if (!asset) throw new Error("asset_not_found");
  if (
    asset.status === "ready"
    && asset.storage_bucket === "site-content"
    && asset.scan_detail === "clamav_clean"
    && asset.sha256
  ) return { asset, duplicate: true };
  if (asset.status !== "quarantine" || asset.storage_bucket !== "site-content-quarantine") {
    throw new Error("asset_not_quarantined");
  }
  return { asset, duplicate: false };
}

async function downloadAsset(asset) {
  const { data, error } = await storage.from(asset.storage_bucket).download(asset.storage_path);
  if (error || !data) throw new Error("storage_download_failed");
  let bytes;
  try {
    bytes = await boundedBlobToBuffer(data, Number(asset.size_bytes), maxBytes);
  } catch {
    throw new Error("asset_size_invalid");
  }
  const digest = createHash("sha256").update(bytes).digest("hex");
  if (!asset.sha256 || digest !== asset.sha256) throw new Error("asset_digest_mismatch");
  return bytes;
}

async function blockAsset(asset, detail) {
  await storage.from(asset.storage_bucket).remove([asset.storage_path]);
  await sql.begin(async (transaction) => {
    const updated = await transaction`
      update public.site_content_assets
      set status = 'blocked', scan_detail = ${detail}, scanned_at = now()
      where id = ${asset.id} and status = 'quarantine'
      returning id
    `;
    if (updated.length) {
      await transaction`
        insert into public.site_content_audit (
          resource_type, resource_id, action, summary
        ) values (
          'asset', ${asset.id}, 'scan_blocked',
          ${transaction.json({ reason: detail })}
        )
      `;
    }
  });
  return "blocked";
}

async function scanAsset(asset) {
  const bytes = await downloadAsset(asset);
  if (await clamScan(bytes, asset.original_name) === "blocked") {
    return blockAsset(asset, "antivirus_detected_threat");
  }
  try {
    await inspectSupportOfficeArchive({
      bytes,
      name: asset.original_name,
      mimeType: asset.mime_type,
    });
  } catch (error) {
    const detail = error instanceof SupportOfficeArchiveError
      ? error.code
      : "invalid_office_archive";
    return blockAsset(asset, detail);
  }

  const { error: cleanUploadError } = await storage
    .from("site-content")
    .upload(asset.storage_path, bytes, { contentType: asset.mime_type, upsert: true });
  if (cleanUploadError) throw new Error("clean_storage_upload_failed");
  const { error: quarantineDeleteError } = await storage
    .from(asset.storage_bucket)
    .remove([asset.storage_path]);
  if (quarantineDeleteError) throw new Error("quarantine_delete_failed");

  await sql.begin(async (transaction) => {
    const updated = await transaction`
      update public.site_content_assets
      set storage_bucket = 'site-content', status = 'ready',
          scan_detail = 'clamav_clean', scanned_at = now()
      where id = ${asset.id} and status = 'quarantine'
      returning id
    `;
    if (!updated.length) throw new Error("asset_state_changed");
    await transaction`
      insert into public.site_content_audit (
        resource_type, resource_id, action, summary
      ) values (
        'asset', ${asset.id}, 'scan_clean',
        ${transaction.json({ engine: "clamav", digestVerified: true })}
      )
    `;
  });
  return "clean";
}

async function processMessage(row) {
  let job = null;
  try {
    job = typeof row.message === "string" ? JSON.parse(row.message) : row.message;
    if (
      !job
      || job.job_type !== "scan_site_content_asset"
      || !uuidPattern.test(job.job_id ?? "")
      || !uuidPattern.test(job.asset_id ?? "")
    ) throw new Error("invalid_site_content_scan_job");
    const loaded = await loadAsset(job.asset_id);
    const outcome = loaded.duplicate ? "clean" : await scanAsset(loaded.asset);
    await sql`select pgmq.delete('site_content_file_scan', ${row.msg_id}::bigint)`;
    return outcome;
  } catch (error) {
    const code = error instanceof Error ? error.message.slice(0, 120) : "unknown_error";
    if (row.read_ct >= 5) {
      await sql.begin(async (transaction) => {
        const assetId = uuidPattern.test(job?.asset_id ?? "") ? job.asset_id : null;
        const updated = assetId ? await transaction`
            update public.site_content_assets
            set status = 'scan_error', scan_detail = ${code}
            where id = ${assetId} and status = 'quarantine'
            returning id
          ` : [];
        if (updated.length) {
          await transaction`
            insert into public.site_content_audit (
              resource_type, resource_id, action, summary
            ) values (
              'asset', ${assetId}, 'scan_error',
              ${transaction.json({ errorCode: code, attempts: row.read_ct })}
            )
          `;
        }
        await transaction`select pgmq.archive('site_content_file_scan', ${row.msg_id}::bigint)`;
      });
      return "failed";
    }
    return "retrying";
  }
}

async function main() {
  const rows = await sql`
    select msg_id, read_ct, message
    from pgmq.read('site_content_file_scan', 300, 10)
  `;
  const outcomes = [];
  for (const row of rows) outcomes.push(await processMessage(row));
  console.log(JSON.stringify({ claimed: rows.length, outcomes }));
  await sql.end();
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : "site_content_file_worker_failed");
  await sql.end({ timeout: 1 });
  process.exitCode = 1;
});
