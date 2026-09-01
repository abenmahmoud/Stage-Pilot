import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import {
  COMMUNICATION_INBOUND_CONTENT_LIMITS,
  parseCommunicationInboundQuarantineConfirmation,
} from "../shared/communication-inbound-content-policy.ts";
import { inspectSupportOfficeArchive } from "./support-office-archive-policy.mjs";

const OUTPUT_BYTES = 16 * 1024;
const MAX_BYTES = COMMUNICATION_INBOUND_CONTENT_LIMITS.objectBytes;
const ENV_KEYS = new Set(["systemroot", "windir", "temp", "tmp"]);
const OFFICE_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

export class CommunicationInboundScanError extends Error {
  constructor(code) {
    super(code);
    this.name = "CommunicationInboundScanError";
    this.code = code;
  }
}

const fail = (code) => { throw new CommunicationInboundScanError(code); };
const exact = (value, fields) => value && typeof value === "object" && !Array.isArray(value)
  && Object.keys(value).length === fields.length
  && fields.every((field) => Object.hasOwn(value, field));
const safePath = (value) => typeof value === "string" && value.length <= 4096
  && isAbsolute(value) && !/[\x00-\x1f\x7f"\r\n]/u.test(value);

function configuration(endpoint) {
  let connection;
  if (exact(endpoint, ["socketPath"]) && safePath(endpoint.socketPath)) {
    connection = `LocalSocket "${endpoint.socketPath}"`;
  } else if (exact(endpoint, ["port"]) && Number.isInteger(endpoint.port)
    && endpoint.port >= 1 && endpoint.port <= 65535) {
    connection = `TCPAddr 127.0.0.1\nTCPSocket ${endpoint.port}`;
  } else fail("configuration_invalid");
  // clamdscan can truncate stdin at StreamMaxLength without reporting an error.
  return `${connection}\nStreamMaxLength ${MAX_BYTES + 1}\n`;
}

function runScan({ executable, configPath, bytes, timeoutMs, spawnImpl }) {
  return new Promise((resolveScan, reject) => {
    let child;
    let timer;
    let failure;
    let output = "";
    let outputBytes = 0;
    let stderrBytes = 0;
    let inputFinished = false;
    const stop = (code) => {
      failure ??= code;
      child?.stdin.destroy();
      child?.kill("SIGKILL");
    };
    try {
      child = spawnImpl(executable, ["--config-file", configPath, "--stream", "--no-summary", "-"], {
        shell: false,
        windowsHide: true,
        stdio: ["pipe", "pipe", "pipe"],
        env: {
          ...Object.fromEntries(Object.entries(process.env).filter(([key]) => ENV_KEYS.has(key.toLowerCase()))),
          LANG: "C", LC_ALL: "C",
        },
      });
    } catch {
      reject(new CommunicationInboundScanError("scanner_unavailable"));
      return;
    }
    timer = setTimeout(() => stop("scan_timeout"), timeoutMs);
    child.once("error", () => stop("scanner_unavailable"));
    child.stdin.once("error", () => stop("scanner_unavailable"));
    child.stdout.once("error", () => stop("scanner_unavailable"));
    child.stderr.once("error", () => stop("scanner_unavailable"));
    child.stdin.once("finish", () => { inputFinished = true; });
    child.stdout.on("data", (chunk) => {
      outputBytes += chunk.length;
      if (outputBytes + stderrBytes > OUTPUT_BYTES) stop("scanner_unavailable");
      else output += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      stderrBytes += chunk.length;
      if (outputBytes + stderrBytes > OUTPUT_BYTES) stop("scanner_unavailable");
    });
    child.once("close", (code, signal) => {
      clearTimeout(timer);
      if (failure || signal || !inputFinished || stderrBytes) {
        reject(new CommunicationInboundScanError(failure ?? "scanner_unavailable"));
      } else if (code === 0 && /^stream: OK\r?\n?$/u.test(output)) {
        resolveScan("clean");
      } else if (code === 1 && /^stream: [^\r\n]{1,1024} FOUND\r?\n?$/u.test(output)) {
        resolveScan("blocked");
      } else reject(new CommunicationInboundScanError("scanner_unavailable"));
    });
    child.stdin.end(bytes);
  });
}

export function createCommunicationInboundScanner({
  executable, endpoint, timeoutMs = 60_000, concurrency = 2, spawnImpl = spawn,
} = {}) {
  if (!safePath(executable) || typeof spawnImpl !== "function"
    || !Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 120_000
    || !Number.isInteger(concurrency) || concurrency < 1 || concurrency > 4) {
    fail("configuration_invalid");
  }
  const config = configuration(endpoint);
  let active = 0;
  return async function scan(input) {
    if (!exact(input, ["bytes", "confirmation"])) fail("input_invalid");
    const source = input.bytes;
    if (!(source instanceof Uint8Array)
      || source.length < 1 || source.length > MAX_BYTES) fail("input_invalid");
    let confirmation;
    try {
      confirmation = { ...parseCommunicationInboundQuarantineConfirmation(input.confirmation) };
    } catch { fail("input_invalid"); }
    if (source.length !== confirmation.sizeBytes) fail("digest_mismatch");
    if (active >= concurrency) fail("capacity_exceeded");
    active += 1;
    let bytes;
    let directory;
    let root;
    try {
      bytes = Buffer.from(source);
      if (bytes.length < 1 || bytes.length > MAX_BYTES) fail("input_invalid");
      if (bytes.length !== confirmation.sizeBytes) fail("digest_mismatch");
      if (createHash("sha256").update(bytes).digest("hex") !== confirmation.sha256) fail("digest_mismatch");
      // Ordinary ZIP signatures must not bypass Office checks via a false MIME declaration.
      const zip = bytes[0] === 0x50 && bytes[1] === 0x4b
        && ((bytes[2] === 3 && bytes[3] === 4) || (bytes[2] === 5 && bytes[3] === 6)
          || (bytes[2] === 7 && bytes[3] === 8));
      if (zip && !OFFICE_TYPES.has(confirmation.mediaType)) fail("unsafe_archive");
      root = resolve(tmpdir());
      directory = await mkdtemp(join(root, "lyceegest-inbound-scan-"));
      const configPath = join(directory, "clamdscan.conf");
      await writeFile(configPath, config, { flag: "wx", mode: 0o600 });
      const status = await runScan({ executable, configPath, bytes, timeoutMs, spawnImpl });
      if (status === "clean") {
        try {
          await inspectSupportOfficeArchive({ bytes, name: "", mimeType: confirmation.mediaType });
        } catch { fail("unsafe_archive"); }
      }
      return {
        ...confirmation, status,
        scanDetail: status === "clean" ? "clamav_clean" : "antivirus_detected_threat",
        scannedAt: new Date().toISOString(),
      };
    } catch (error) {
      if (error instanceof CommunicationInboundScanError) throw error;
      fail("scanner_unavailable");
    } finally {
      bytes?.fill(0);
      try {
        if (directory) {
          const target = resolve(directory);
          if (dirname(target) !== root
            || !target.startsWith(join(root, "lyceegest-inbound-scan-"))) {
            fail("scanner_unavailable");
          }
          await rm(target, { recursive: true, force: true });
        }
      } catch { fail("scanner_unavailable"); }
      finally { active -= 1; }
    }
  };
}
