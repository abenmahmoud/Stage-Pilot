import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { promisify } from "node:util";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import WebSocket from "ws";
import { createSiteContentFileWorker } from "./site-content-file-worker-core.mjs";

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
  const directory = await mkdtemp(join(tmpdir(), "lyceegest-content-scan-"));
  const filePath = join(directory, safeName(name));
  try {
    await writeFile(filePath, bytes, { flag: "wx" });
    try {
      await execFileAsync(
        process.env.CLAMDSCAN_PATH ?? "clamdscan",
        ["--stream", "--no-summary", filePath],
        { timeout: 120000, windowsHide: true },
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

async function main() {
  const worker = createSiteContentFileWorker({
    sql,
    storage,
    scanBytes: ({ bytes, asset }) => clamScan(bytes, asset.originalName),
  });
  try {
    console.log(JSON.stringify(await worker.runBatch()));
  } finally {
    await sql.end();
  }
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : "site_content_file_worker_failed");
  await sql.end({ timeout: 1 });
  process.exitCode = 1;
});
