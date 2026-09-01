import { createHash } from "node:crypto";
import {
  communicationInboundObjectStoragePath,
  parseCommunicationInboundQuarantineConfirmation,
} from "../shared/communication-inbound-content-policy.ts";

const QUARANTINE = "communication-inbound-quarantine";
const CLEAN = "communication-inbound-clean";
const RETRY_SECONDS = [30, 120, 300, 900];
const TRANSIENT = new Set(["scanner_unavailable", "scan_timeout", "storage_read_failed"]);
const FAILURES = new Set([...TRANSIENT, "digest_mismatch", "unsafe_archive", "unsupported_media"]);
const CONFIRMATION_KEYS = ["institutionId", "inboundId", "objectId", "mediaType", "sizeBytes", "sha256"];
const exact = (value, keys) => value && typeof value === "object" && !Array.isArray(value)
  && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
const same = (a, b) => CONFIRMATION_KEYS.every((key) => a[key] === b[key]);

export class CommunicationInboundWorkerError extends Error {
  constructor(code) { super(code); this.name = "CommunicationInboundWorkerError"; this.code = code; }
}
const fail = (code) => { throw new CommunicationInboundWorkerError(code); };

function jobScope(value) {
  if (!exact(value, ["schema", "job_type", "institution_id", "inbound_id", "object_id"])
    || value.schema !== 1 || value.job_type !== "scan_communication_inbound_object") fail("job_invalid");
  const scope = { institutionId: value.institution_id, inboundId: value.inbound_id, objectId: value.object_id };
  try { communicationInboundObjectStoragePath(scope.institutionId, scope.inboundId, scope.objectId); }
  catch { fail("job_invalid"); }
  return Object.freeze(Object.fromEntries(Object.entries(scope).map(([key, id]) => [key, id.toLowerCase()])));
}

function verifyScan(value, confirmation, startedAt) {
  if (!exact(value, [...CONFIRMATION_KEYS, "status", "scanDetail", "scannedAt"])) fail("scanner_unavailable");
  const snapshot = { ...value };
  const reference = parseCommunicationInboundQuarantineConfirmation(
    Object.fromEntries(CONFIRMATION_KEYS.map((key) => [key, snapshot[key]]))
  );
  const timestamp = typeof snapshot.scannedAt === "string" ? Date.parse(snapshot.scannedAt) : NaN;
  if (!same(reference, confirmation) || !Number.isFinite(timestamp)
    || new Date(timestamp).toISOString() !== snapshot.scannedAt
    || timestamp < startedAt - 1000 || timestamp > Date.now() + 1000
    || !["clean", "blocked"].includes(snapshot.status)
    || snapshot.scanDetail !== (snapshot.status === "clean" ? "clamav_clean" : "antivirus_detected_threat")) {
    fail("scanner_unavailable");
  }
  return snapshot;
}

function scanFailure(error, stage) {
  const code = error && typeof error === "object" ? error.code : undefined;
  if (FAILURES.has(code)) return code;
  if (code === "content_digest_mismatch" || code === "content_size_invalid") return "digest_mismatch";
  if (code === "content_media_invalid") return "unsupported_media";
  return stage === "scan" ? "scanner_unavailable" : "storage_read_failed";
}

export function createCommunicationInboundScanProcessor({
  withTransaction, download, scan, storeClean, concurrency = 2,
} = {}) {
  if (![withTransaction, download, scan, storeClean].every((fn) => typeof fn === "function")
    || !Number.isInteger(concurrency) || concurrency < 1 || concurrency > 4) fail("configuration_invalid");
  let active = 0;
  return async (lease) => {
    if (!exact(lease, ["msgId", "readCount"]) || typeof lease.msgId !== "string"
      || !/^[1-9][0-9]{0,18}$/u.test(lease.msgId) || BigInt(lease.msgId) > 9223372036854775807n
      || !Number.isSafeInteger(lease.readCount) || lease.readCount < 1) fail("lease_invalid");
    const leased = { ...lease };
    if (active >= concurrency) fail("capacity_exceeded");
    active += 1;
    try {
      return await withTransaction(async (tx) => {
        const row = await tx.lockJob(leased);
        if (!row) return { status: "stale" };
        let scope;
        try { scope = jobScope(row.message); }
        catch { await tx.archiveJob(leased.msgId); return { status: "archived" }; }
        const object = await tx.lockObject(scope);
        const expectedPath = communicationInboundObjectStoragePath(scope.institutionId, scope.inboundId, scope.objectId);
        if (!object || object.storagePath !== expectedPath || object.status === "reserved") {
          await tx.archiveJob(leased.msgId);
          return { status: "archived" };
        }
        if (["clean", "blocked", "purged"].includes(object.status)) {
          await tx.acknowledgeJob(leased.msgId);
          return { status: "already_processed", objectId: scope.objectId };
        }
        if (!["quarantine", "scan_error"].includes(object.status) || object.storageBucket !== QUARANTINE) {
          fail("object_invalid");
        }
        const confirmation = Object.freeze(parseCommunicationInboundQuarantineConfirmation({ ...scope,
          mediaType: object.mediaType, sizeBytes: Number(object.sizeBytes), sha256: object.sha256 }));
        const attempt = Math.min(leased.readCount, 5);
        if (leased.readCount > 5) {
          if (object.status === "quarantine") {
            await tx.setObject(scope, { status: "scan_error", scanDetail: "scanner_unavailable", scannedAt: null });
            await tx.addEvent(scope, "object.scan_error", { reason: "scanner_unavailable", attempt: 5 });
          }
          await tx.archiveJob(leased.msgId);
          return { status: "failed", objectId: scope.objectId };
        }
        if (object.status === "scan_error") {
          await tx.setObject(scope, { status: "quarantine", scanDetail: "awaiting_antivirus", scannedAt: null });
          await tx.addEvent(scope, "object.quarantined", { scan: "pending" });
        }
        let bytes;
        let result;
        let failure;
        let stage = "download";
        try {
          // Nested MIME parts need their own bounded extraction and archive policy.
          if (confirmation.mediaType === "message/rfc822") fail("unsupported_media");
          bytes = await download(confirmation);
          if (!(bytes instanceof Uint8Array) || bytes.byteLength !== confirmation.sizeBytes
            || createHash("sha256").update(bytes).digest("hex") !== confirmation.sha256) fail("digest_mismatch");
          stage = "scan";
          const startedAt = Date.now();
          result = verifyScan(await scan({ bytes, confirmation }), confirmation, startedAt);
          if (result.status === "clean") {
            stage = "storage";
            const stored = parseCommunicationInboundQuarantineConfirmation(await storeClean({ bytes, confirmation }));
            if (!same(stored, confirmation)) fail("digest_mismatch");
          }
        } catch (error) { failure = scanFailure(error, stage); }
        finally { if (bytes instanceof Uint8Array) bytes.fill(0); }

        if (failure) {
          await tx.setObject(scope, { status: "scan_error", scanDetail: failure, scannedAt: null });
          await tx.addEvent(scope, "object.scan_error", { reason: failure, attempt });
          if (!TRANSIENT.has(failure) || leased.readCount >= 5) {
            await tx.archiveJob(leased.msgId);
            return { status: "failed", objectId: scope.objectId };
          }
          await tx.retryJob(leased.msgId, RETRY_SECONDS[attempt - 1]);
          return { status: "retry", objectId: scope.objectId };
        }
        await tx.setObject(scope, { status: result.status,
          storageBucket: result.status === "clean" ? CLEAN : QUARANTINE,
          scanDetail: result.scanDetail, scannedAt: new Date(result.scannedAt) });
        await tx.addEvent(scope, `object.${result.status}`, result.status === "clean"
          ? { antivirus: "clamav_clean" } : { reason: "antivirus_detected_threat" });
        await tx.acknowledgeJob(leased.msgId);
        return { status: result.status, objectId: scope.objectId };
      });
    } catch (error) {
      if (error instanceof CommunicationInboundWorkerError) throw error;
      fail("processing_unavailable");
    } finally { active -= 1; }
  };
}
