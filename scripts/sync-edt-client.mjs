#!/usr/bin/env node

import { createHash } from "node:crypto";
import {
  mkdir,
  open,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { basename, dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const MAX_FILE_BYTES = 50 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256 = /^[a-f0-9]{64}$/;
const ALLOWED_SOURCE_KINDS = new Set(["classes", "teachers"]);
const ALLOWED_RESPONSE_STATUSES = new Set([
  "reserved", "uploaded", "quarantined", "processing", "mapping_pending",
  "review", "approved", "active", "superseded",
]);

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function exactObject(value, required, optional = []) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const allowed = new Set([...required, ...optional]);
  const keys = Object.keys(value);
  return required.every((key) => keys.includes(key)) && keys.every((key) => allowed.has(key))
    ? value
    : null;
}

function dateInParis(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function plusDays(day, count) {
  const value = new Date(`${day}T12:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + count);
  return value.toISOString().slice(0, 10);
}

function schoolYearFor(day) {
  const year = Number(day.slice(0, 4));
  const month = Number(day.slice(5, 7));
  const start = month >= 8 ? year : year - 1;
  return `${start}-${start + 1}`;
}

function fileFormat(filePath) {
  const extension = extname(filePath).toLowerCase();
  if (extension === ".pdf") {
    return { sourceFormat: "pdf_import", mimeType: "application/pdf" };
  }
  if (extension === ".csv") {
    return { sourceFormat: "tabular_import", mimeType: "text/csv" };
  }
  if (extension === ".xlsx") {
    return {
      sourceFormat: "tabular_import",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };
  }
  fail("unsupported_edt_file_extension");
}

function validateEndpoint(value, allowHttpLocalhost) {
  let url;
  try {
    url = new URL(value);
  } catch {
    fail("invalid_endpoint");
  }
  const local = url.hostname === "127.0.0.1" || url.hostname === "localhost";
  if ((url.protocol !== "https:" && !(allowHttpLocalhost && local))
    || url.username || url.password || url.hash || url.search
    || !url.pathname.endsWith("/api/depot/edt")) {
    fail("invalid_endpoint");
  }
  return url.toString();
}

function validateUploadUrl(value, allowHttpLocalhost) {
  let url;
  try {
    url = new URL(value);
  } catch {
    fail("invalid_signed_upload_url");
  }
  const local = url.hostname === "127.0.0.1" || url.hostname === "localhost";
  const supabase = url.hostname.endsWith(".supabase.co");
  if ((url.protocol !== "https:" && !(allowHttpLocalhost && local))
    || (!supabase && !(allowHttpLocalhost && local))
    || url.username || url.password || url.hash
    || !url.pathname.includes("/storage/v1/object/upload/sign/schedule-ingest/")
    || [...url.searchParams.keys()].length !== 1
    || !url.searchParams.get("token")) {
    fail("invalid_signed_upload_url");
  }
  return url.toString();
}

function parseConfig(value, configPath) {
  const config = exactObject(value, ["endpoint", "sources"], [
    "minimumAgeSeconds", "freshDays", "allowHttpLocalhost", "statePath",
  ]);
  if (!config || !Array.isArray(config.sources) || config.sources.length < 1 || config.sources.length > 2) {
    fail("invalid_config");
  }
  const allowHttpLocalhost = config.allowHttpLocalhost === true;
  const minimumAgeSeconds = config.minimumAgeSeconds === undefined ? 60 : Number(config.minimumAgeSeconds);
  const freshDays = config.freshDays === undefined ? 2 : Number(config.freshDays);
  if (!Number.isInteger(minimumAgeSeconds) || minimumAgeSeconds < 30 || minimumAgeSeconds > 3_600) {
    fail("invalid_minimum_age");
  }
  if (!Number.isInteger(freshDays) || freshDays < 1 || freshDays > 14) fail("invalid_fresh_days");
  const kinds = new Set();
  const sources = config.sources.map((candidate) => {
    const source = exactObject(candidate, ["path", "sourceKind", "title"], [
      "schoolYear", "effectiveUntil",
    ]);
    if (!source || typeof source.path !== "string" || typeof source.title !== "string") fail("invalid_source");
    if (!ALLOWED_SOURCE_KINDS.has(source.sourceKind) || kinds.has(source.sourceKind)) fail("invalid_source_kind");
    kinds.add(source.sourceKind);
    const filePath = resolve(source.path);
    fileFormat(filePath);
    if (source.title.trim().length < 2 || source.title.trim().length > 180) fail("invalid_source_title");
    if (source.schoolYear !== undefined && !/^\d{4}-\d{4}$/.test(source.schoolYear)) fail("invalid_school_year");
    if (source.effectiveUntil !== undefined && source.effectiveUntil !== null
      && !/^\d{4}-\d{2}-\d{2}$/.test(source.effectiveUntil)) fail("invalid_effective_until");
    return {
      path: filePath,
      sourceKind: source.sourceKind,
      title: source.title.trim(),
      schoolYear: source.schoolYear,
      effectiveUntil: source.effectiveUntil ?? null,
    };
  });
  return {
    endpoint: validateEndpoint(config.endpoint, allowHttpLocalhost),
    allowHttpLocalhost,
    minimumAgeSeconds,
    freshDays,
    sources,
    statePath: resolve(
      config.statePath ?? resolve(dirname(configPath), "edt-sync-state.json")
    ),
  };
}

async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return fallback;
    fail("invalid_json_file");
  }
}

async function responseJson(response, code) {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) fail(code);
  let value;
  try {
    value = await response.json();
  } catch {
    fail(code);
  }
  if (!response.ok) fail(code);
  return value;
}

async function stableFile(source, minimumAgeSeconds) {
  let before;
  try {
    before = await stat(source.path);
  } catch (error) {
    if (error?.code === "ENOENT") return { skipped: "file_missing" };
    throw error;
  }
  if (!before.isFile() || before.size < 1 || before.size > MAX_FILE_BYTES) {
    return { skipped: "invalid_file_size" };
  }
  if (Date.now() - before.mtimeMs < minimumAgeSeconds * 1_000) {
    return { skipped: "file_still_recent" };
  }
  const bytes = await readFile(source.path);
  const after = await stat(source.path);
  if (before.size !== after.size || before.mtimeMs !== after.mtimeMs || bytes.length !== after.size) {
    return { skipped: "file_changed_during_read" };
  }
  return { bytes, checksum: createHash("sha256").update(bytes).digest("hex") };
}

async function reserve(config, source, bytes, checksum, token) {
  const today = dateInParis();
  const format = fileFormat(source.path);
  const schoolYear = source.schoolYear ?? schoolYearFor(today);
  const freshUntil = plusDays(today, config.freshDays);
  const body = {
    mode: "reserve",
    originalName: basename(source.path),
    sizeBytes: bytes.length,
    schoolYear,
    title: source.title,
    effectiveFrom: today,
    effectiveUntil: source.effectiveUntil,
    freshUntil,
    sourceKind: source.sourceKind,
    sourceFormat: format.sourceFormat,
    mimeType: format.mimeType,
    checksum,
  };
  const response = await fetch(config.endpoint, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const payload = exactObject(
    await responseJson(response, "edt_reservation_failed"),
    ["ok", "type", "importId", "status"],
    ["upload", "duplicate"]
  );
  if (!payload || payload.ok !== true || payload.type !== "edt"
    || !UUID.test(payload.importId) || !ALLOWED_RESPONSE_STATUSES.has(payload.status)) {
    fail("invalid_edt_reservation_response");
  }
  const upload = exactObject(payload.upload, ["bucket", "path", "token", "signedUrl"]);
  if (!upload && payload.duplicate === true) {
    return { duplicate: true, importId: payload.importId, status: payload.status };
  }
  if (!upload || upload.bucket !== "schedule-ingest" || typeof upload.path !== "string"
    || typeof upload.token !== "string" || typeof upload.signedUrl !== "string"
    || payload.status !== "reserved" || typeof payload.duplicate !== "boolean") {
    fail("invalid_edt_reservation_response");
  }
  return {
    duplicate: false,
    resumed: payload.duplicate,
    importId: payload.importId,
    status: payload.status,
    signedUrl: validateUploadUrl(upload.signedUrl, config.allowHttpLocalhost),
    mimeType: format.mimeType,
  };
}

async function uploadAndConfirm(config, reservation, bytes, token) {
  const upload = await fetch(reservation.signedUrl, {
    method: "PUT",
    headers: {
      "cache-control": "max-age=3600",
      "content-type": reservation.mimeType,
      "x-upsert": "false",
    },
    body: bytes,
  });
  if (!upload.ok) fail("edt_private_upload_failed");
  const confirmation = await fetch(config.endpoint, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ mode: "confirm", importId: reservation.importId }),
  });
  const payload = exactObject(
    await responseJson(confirmation, "edt_confirmation_failed"),
    ["ok", "type", "importId", "status", "duplicate"]
  );
  if (!payload || payload.ok !== true || payload.type !== "edt"
    || payload.importId !== reservation.importId
    || typeof payload.duplicate !== "boolean"
    || !ALLOWED_RESPONSE_STATUSES.has(payload.status)) {
    fail("invalid_edt_confirmation_response");
  }
  return { importId: payload.importId, status: payload.status, duplicate: payload.duplicate };
}

async function writeState(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  await rename(temporary, path);
}

export async function runEdtSync({ configPath, token, now = new Date() }) {
  if (typeof token !== "string" || token.length < 32 || token.length > 512) fail("missing_depot_token");
  const absoluteConfigPath = resolve(configPath);
  const config = parseConfig(await readJson(absoluteConfigPath), absoluteConfigPath);
  const lockPath = `${config.statePath}.lock`;
  await mkdir(dirname(lockPath), { recursive: true });
  let lock;
  try {
    lock = await open(lockPath, "wx", 0o600);
  } catch (error) {
    if (error?.code === "EEXIST") return { status: "already_running", results: [] };
    throw error;
  }
  try {
    const stored = await readJson(config.statePath, { version: 1, sources: {} });
    const state = stored && stored.version === 1 && stored.sources && typeof stored.sources === "object"
      ? stored
      : { version: 1, sources: {} };
    const results = [];
    for (const source of config.sources) {
      const stable = await stableFile(source, config.minimumAgeSeconds);
      if (stable.skipped) {
        results.push({ sourceKind: source.sourceKind, status: "skipped", reason: stable.skipped });
        continue;
      }
      if (!SHA256.test(stable.checksum)) fail("invalid_local_checksum");
      const previous = state.sources[source.sourceKind];
      if (previous?.checksum === stable.checksum && previous?.accepted === true) {
        results.push({ sourceKind: source.sourceKind, status: "unchanged" });
        continue;
      }
      const reservation = await reserve(config, source, stable.bytes, stable.checksum, token);
      const result = reservation.duplicate
        ? { importId: reservation.importId, status: reservation.status, duplicate: true }
        : await uploadAndConfirm(config, reservation, stable.bytes, token);
      state.sources[source.sourceKind] = {
        checksum: stable.checksum,
        accepted: true,
        importId: result.importId,
        serverStatus: result.status,
        synchronizedAt: now.toISOString(),
      };
      await writeState(config.statePath, state);
      results.push({
        sourceKind: source.sourceKind,
        status: result.duplicate ? "already_received" : reservation.resumed ? "resumed" : "synchronized",
        importId: result.importId,
        serverStatus: result.status,
      });
    }
    return { status: "complete", results };
  } finally {
    await lock?.close();
    await rm(lockPath, { force: true });
  }
}

async function main() {
  const configIndex = process.argv.indexOf("--config");
  if (configIndex < 0 || !process.argv[configIndex + 1] || process.argv.length !== 4) {
    fail("usage: sync-edt-client.mjs --config <path>");
  }
  const result = await runEdtSync({
    configPath: process.argv[configIndex + 1],
    token: process.env.LYCEEGEST_DEPOT_TOKEN,
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main().catch((error) => {
    process.stderr.write(`${error?.code ?? "edt_sync_failed"}\n`);
    process.exitCode = 1;
  });
}
