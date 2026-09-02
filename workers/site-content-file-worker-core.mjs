import { createHash } from "node:crypto";
import { boundedBlobToBuffer } from "./bounded-download.mjs";
import {
  inspectSupportOfficeArchive,
  SupportOfficeArchiveError,
} from "./support-office-archive-policy.mjs";

const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const errorCodePattern = /^[a-z0-9_]{1,120}$/u;

function machineErrorCode(error) {
  const message = error instanceof Error ? error.message : "";
  return errorCodePattern.test(message) ? message : "site_content_worker_failed";
}

function validDependencies(options) {
  return options && typeof options.sql === "function"
    && options.storage && typeof options.storage.from === "function"
    && typeof options.scanBytes === "function"
    && typeof options.inspectOfficeArchive === "function"
    && Number.isSafeInteger(options.maxBytes)
    && options.maxBytes >= 1
    && options.maxBytes <= DEFAULT_MAX_BYTES;
}

export function createSiteContentFileWorker({
  sql,
  storage,
  scanBytes,
  inspectOfficeArchive = inspectSupportOfficeArchive,
  maxBytes = DEFAULT_MAX_BYTES,
} = {}) {
  const options = { sql, storage, scanBytes, inspectOfficeArchive, maxBytes };
  if (!validDependencies(options)) throw new Error("site_content_worker_configuration_invalid");

  async function loadAsset(assetId) {
    const [asset] = await sql`
      select id, storage_bucket, storage_path, original_name, mime_type,
             size_bytes, status, scan_detail, sha256, scanned_at
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
      && asset.scanned_at
    ) return { asset, terminal: "clean" };
    if (asset.status === "blocked" && asset.scan_detail && asset.scanned_at) {
      return { asset, terminal: "blocked" };
    }
    if (asset.status !== "quarantine" || asset.storage_bucket !== "site-content-quarantine") {
      throw new Error("asset_not_quarantined");
    }
    return { asset, terminal: null };
  }

  async function downloadBounded(bucket, path, sizeBytes, failure) {
    const { data, error } = await storage.from(bucket).download(path);
    if (error || !data) throw new Error(failure);
    try {
      return await boundedBlobToBuffer(data, Number(sizeBytes), maxBytes);
    } catch {
      throw new Error("asset_size_invalid");
    }
  }

  async function verifyStored(bucket, asset) {
    const bytes = await downloadBounded(
      bucket,
      asset.storage_path,
      asset.size_bytes,
      "storage_download_failed",
    );
    try {
      if (!asset.sha256 || createHash("sha256").update(bytes).digest("hex") !== asset.sha256) {
        throw new Error("asset_digest_mismatch");
      }
    } finally {
      bytes.fill(0);
    }
  }

  async function downloadAsset(asset) {
    const bytes = await downloadBounded(
      asset.storage_bucket,
      asset.storage_path,
      asset.size_bytes,
      "storage_download_failed",
    );
    if (!asset.sha256 || createHash("sha256").update(bytes).digest("hex") !== asset.sha256) {
      bytes.fill(0);
      throw new Error("asset_digest_mismatch");
    }
    return bytes;
  }

  async function removeQuarantine(asset) {
    const { error } = await storage
      .from("site-content-quarantine")
      .remove([asset.storage_path]);
    if (error) throw new Error("quarantine_delete_failed");
  }

  async function persistBlocked(asset, detail) {
    await sql.begin(async (transaction) => {
      const updated = await transaction`
        update public.site_content_assets
        set status = 'blocked', scan_detail = ${detail}, scanned_at = now()
        where id = ${asset.id} and status = 'quarantine'
        returning id
      `;
      if (!updated.length) throw new Error("asset_state_changed");
      await transaction`
        insert into public.site_content_audit (
          resource_type, resource_id, action, summary
        ) values (
          'asset', ${asset.id}, 'scan_blocked',
          ${transaction.json({ reason: detail })}
        )
      `;
    });
    await removeQuarantine(asset);
    return "blocked";
  }

  async function storeAndVerifyClean(asset, bytes) {
    await storage.from("site-content").upload(asset.storage_path, bytes, {
      contentType: asset.mime_type,
      upsert: false,
    });
    await verifyStored("site-content", asset);
  }

  async function persistClean(asset) {
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
    await removeQuarantine(asset);
    return "clean";
  }

  async function scanAsset(asset) {
    const bytes = await downloadAsset(asset);
    try {
      const verdict = await scanBytes({
        bytes,
        asset: {
          id: asset.id,
          originalName: asset.original_name,
          mimeType: asset.mime_type,
          sizeBytes: Number(asset.size_bytes),
          sha256: asset.sha256,
        },
      });
      if (verdict === "blocked") {
        return persistBlocked(asset, "antivirus_detected_threat");
      }
      if (verdict !== "clean") throw new Error("antivirus_unavailable");
      try {
        await inspectOfficeArchive({
          bytes,
          name: asset.original_name,
          mimeType: asset.mime_type,
        });
      } catch (error) {
        const detail = error instanceof SupportOfficeArchiveError
          && /^[a-z0-9_]{1,120}$/u.test(error.code)
          ? error.code
          : "invalid_office_archive";
        return persistBlocked(asset, detail);
      }
      await storeAndVerifyClean(asset, bytes);
      return persistClean(asset);
    } finally {
      bytes.fill(0);
    }
  }

  async function finishTerminal(asset, terminal) {
    if (terminal === "clean") await verifyStored("site-content", asset);
    await removeQuarantine(asset);
    return terminal;
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
      const outcome = loaded.terminal
        ? await finishTerminal(loaded.asset, loaded.terminal)
        : await scanAsset(loaded.asset);
      await sql`select pgmq.delete('site_content_file_scan', ${row.msg_id}::bigint)`;
      return outcome;
    } catch (error) {
      const code = machineErrorCode(error);
      if (Number(row.read_ct) >= 5) {
        await sql.begin(async (transaction) => {
          const assetId = uuidPattern.test(job?.asset_id ?? "") ? job.asset_id : null;
          const updated = assetId ? await transaction`
              update public.site_content_assets
              set status = case when status = 'ready' then 'archived' else 'scan_error' end,
                  scan_detail = ${code}
              where id = ${assetId} and status in ('quarantine', 'ready')
              returning id, status
            ` : [];
          if (updated.length) {
            await transaction`
              insert into public.site_content_audit (
                resource_type, resource_id, action, summary
              ) values (
                'asset', ${assetId}, 'scan_error',
                ${transaction.json({ errorCode: code, attempts: Number(row.read_ct) })}
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

  async function runBatch({ visibilitySeconds = 300, limit = 10 } = {}) {
    if (!Number.isInteger(visibilitySeconds) || visibilitySeconds < 1 || visibilitySeconds > 900
      || !Number.isInteger(limit) || limit < 1 || limit > 10) {
      throw new Error("site_content_worker_batch_invalid");
    }
    const rows = await sql`
      select msg_id, read_ct, message
      from pgmq.read('site_content_file_scan', ${visibilitySeconds}, ${limit})
    `;
    const outcomes = [];
    for (const row of rows) outcomes.push(await processMessage(row));
    return { claimed: rows.length, outcomes };
  }

  return { processMessage, runBatch };
}
