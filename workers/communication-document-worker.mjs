import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import WebSocket from "ws";
import { createCommunicationInboundScanner } from "./communication-inbound-scanner.mjs";
import { createCommunicationDocumentWorker } from "./communication-document-worker-core.mjs";

const databaseUrl = process.env.DATABASE_URL;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const clamExecutable = process.env.CLAMDSCAN_PATH;
if (!databaseUrl || !supabaseUrl || !serviceRoleKey || !clamExecutable) {
  throw new Error("communication_document_worker_configuration_missing");
}

const sql = postgres(databaseUrl, { prepare: false, max: 2, idle_timeout: 20 });
const storage = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: { transport: WebSocket },
}).storage;

const scan = createCommunicationInboundScanner({
  executable: clamExecutable,
  endpoint: process.env.CLAMD_SOCKET_PATH
    ? { socketPath: process.env.CLAMD_SOCKET_PATH }
    : { port: Number(process.env.CLAMD_PORT ?? 3310) },
  timeoutMs: 120_000,
  concurrency: 2,
});

async function clamScan(bytes, document) {
  const result = await scan({
    bytes,
    confirmation: {
      institutionId: document.institutionId,
      inboundId: document.id,
      objectId: document.id,
      mediaType: document.mimeType,
      sizeBytes: document.sizeBytes,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    },
  });
  return result.status;
}

async function main() {
  const worker = createCommunicationDocumentWorker({
    sql,
    storage,
    scanBytes: ({ bytes, document }) => clamScan(bytes, document),
  });
  console.log(JSON.stringify(await worker.runBatch({ visibilitySeconds: 300, limit: 2 })));
  await sql.end();
}

main().catch(async (error) => {
  console.error("communication_document_worker_failed");
  await sql.end({ timeout: 1 });
  process.exitCode = 1;
});
