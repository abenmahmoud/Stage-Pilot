import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import {
  createCommunicationInboundCleanStore,
  createCommunicationInboundQuarantineReader,
} from "../api/_shared/communication-inbound-transfer.ts";
import { createCommunicationInboundScanner } from "./communication-inbound-scanner.mjs";
import { createCommunicationInboundScanProcessor } from "./communication-inbound-scan-core.mjs";
import { createCommunicationInboundScanRepository } from "./communication-inbound-scan-repository.mjs";
import { communicationInboundPreviewDatabaseUrl, COMMUNICATION_INBOUND_PREVIEW_PROJECT }
  from "./communication-inbound-preview-target.mjs";

export function verifyCommunicationInboundWorkerConfiguration(env, args) {
  if (args.length !== 1 || args[0] !== "--preview-only"
    || env.COMMUNICATION_INBOUND_SCAN_ENABLED !== "true"
    || env.COMMUNICATION_INBOUND_CLAMAV_VERIFIED !== "true") throw new Error("inbound_scan_disabled");
  communicationInboundPreviewDatabaseUrl(env.DATABASE_URL);
  if (env.VITE_SUPABASE_URL !== `https://${COMMUNICATION_INBOUND_PREVIEW_PROJECT}.supabase.co`) {
    throw new Error("inbound_scan_preview_configuration_invalid");
  }
  const decimal = (value, fallback) => value === undefined ? fallback
    : (typeof value === "string" && /^[1-9][0-9]?$/u.test(value) ? Number(value) : NaN);
  const limit = decimal(env.COMMUNICATION_INBOUND_SCAN_BATCH_SIZE, 10);
  const concurrency = decimal(env.COMMUNICATION_INBOUND_SCAN_CONCURRENCY, 2);
  if (!Number.isInteger(limit) || limit < 1 || limit > 20
    || !Number.isInteger(concurrency) || concurrency < 1 || concurrency > 4) {
    throw new Error("inbound_scan_preview_configuration_invalid");
  }
  return { limit, concurrency };
}

export async function runCommunicationInboundScanBatch({ repository, processLease, limit = 10, concurrency = 2 }) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 20
    || !Number.isInteger(concurrency) || concurrency < 1 || concurrency > 4) {
    throw new Error("inbound_scan_batch_invalid");
  }
  const counts = { leased: 0, clean: 0, blocked: 0, retry: 0, failed: 0,
    already_processed: 0, archived: 0, stale: 0, errors: 0 };
  let tickets = 0;
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (tickets < limit) {
      tickets += 1;
      try {
        const lease = await repository.lease();
        if (!lease) break;
        counts.leased += 1;
        const result = await processLease(lease);
        if (!Object.hasOwn(counts, result?.status) || ["leased", "errors"].includes(result.status)) {
          counts.errors += 1;
        } else counts[result.status] += 1;
      } catch { counts.errors += 1; break; }
    }
  }));
  return counts;
}

async function main() {
  const { limit, concurrency } = verifyCommunicationInboundWorkerConfiguration(process.env, process.argv.slice(2));
  const scan = createCommunicationInboundScanner({
    executable: process.env.CLAMDSCAN_PATH,
    endpoint: process.env.CLAMD_SOCKET_PATH
      ? { socketPath: process.env.CLAMD_SOCKET_PATH }
      : { port: Number(process.env.CLAMD_PORT ?? 3310) },
    concurrency,
  });
  const storageOptions = { supabaseUrl: process.env.VITE_SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY };
  const download = createCommunicationInboundQuarantineReader(storageOptions);
  const storeClean = createCommunicationInboundCleanStore(storageOptions);
  const sql = postgres(communicationInboundPreviewDatabaseUrl(process.env.DATABASE_URL), { prepare: false, max: concurrency + 1,
    connect_timeout: 10, idle_timeout: 20, ssl: { rejectUnauthorized: true }, onnotice: () => {} });
  try {
    const repository = createCommunicationInboundScanRepository(sql);
    const processLease = createCommunicationInboundScanProcessor({
      withTransaction: repository.withTransaction, download, scan, storeClean, concurrency,
    });
    const result = await runCommunicationInboundScanBatch({ repository, processLease, limit, concurrency });
    console.log(JSON.stringify(result));
    if (result.errors) process.exitCode = 1;
  } finally { await sql.end({ timeout: 5 }); }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch(() => {
    console.error("communication_inbound_scan_unavailable");
    process.exitCode = 1;
  });
}
