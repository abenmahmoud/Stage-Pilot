import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  DEVICE_MEMORY_RETENTION_MS,
  MAX_PENDING_REQUESTER_UPLOADS,
  PENDING_REQUESTER_UPLOAD_RETENTION_MS,
  isDeviceMemoryFresh,
  isPendingRequesterUploadFresh,
  normalizePendingRequesterUploads,
} from "../src/lib/support-device-memory.ts";

const now = Date.UTC(2026, 7, 28, 12, 0, 0);
assert.equal(isDeviceMemoryFresh(new Date(now - 1_000).toISOString(), now), true);
assert.equal(isDeviceMemoryFresh(new Date(now - DEVICE_MEMORY_RETENTION_MS).toISOString(), now), true);
assert.equal(isDeviceMemoryFresh(new Date(now - DEVICE_MEMORY_RETENTION_MS - 1).toISOString(), now), false);
assert.equal(isDeviceMemoryFresh(new Date(now + 1).toISOString(), now), false);
assert.equal(isDeviceMemoryFresh("invalid", now), false);
assert.equal(isPendingRequesterUploadFresh(new Date(now - 1_000).toISOString(), now), true);
assert.equal(
  isPendingRequesterUploadFresh(new Date(now - PENDING_REQUESTER_UPLOAD_RETENTION_MS - 1).toISOString(), now),
  false
);

const pendingUpload = (index, updatedAt = new Date(now - index).toISOString()) => ({
  fingerprintDigest: index.toString(16).padStart(64, "0"),
  publicCode: "BC-2026-000009",
  idempotencyKey: `00000000-0000-4000-8000-${index.toString(16).padStart(12, "0")}`,
  attachmentId: null,
  updatedAt,
});
const normalizedUploads = normalizePendingRequesterUploads(
  Array.from({ length: MAX_PENDING_REQUESTER_UPLOADS + 3 }, (_, index) => pendingUpload(index + 1)),
  now
);
assert.equal(normalizedUploads.length, MAX_PENDING_REQUESTER_UPLOADS);
assert.equal(normalizedUploads[0]?.fingerprintDigest, pendingUpload(1).fingerprintDigest);
assert.equal(
  normalizePendingRequesterUploads([
    pendingUpload(1, new Date(now - PENDING_REQUESTER_UPLOAD_RETENTION_MS - 1).toISOString()),
    { ...pendingUpload(2), fileName: "bulletin.pdf" },
  ], now).length,
  0
);

const memorySource = await readFile("src/lib/support-device-memory.ts", "utf8");
const prototypeSource = await readFile("src/pages/prototype/LyceeConnectPrototype.tsx", "utf8");

assert.match(memorySource, /indexedDB\.open/);
assert.doesNotMatch(memorySource, /localStorage|sessionStorage/);
assert.doesNotMatch(memorySource, /magic[_A-Z]?token|access[_A-Z]?token|password/i);
assert.match(memorySource, /PENDING_REQUESTER_UPLOAD_RETENTION_MS = 7 \* 24 \* 60 \* 60 \* 1000/);
assert.match(memorySource, /MAX_PENDING_REQUESTER_UPLOADS = 20/);
assert.match(memorySource, /PENDING_REQUESTER_UPLOAD_PREFIX/);
assert.doesNotMatch(memorySource, /fileName|originalName|storagePath|uploadToken|signedUrl/);
assert.match(prototypeSource, /saveSupportDeviceDraft<AssistantInsight>/);
assert.match(prototypeSource, /requestKey,/);
assert.match(prototypeSource, /"Idempotency-Key": requestKey/);
assert.match(prototypeSource, /hadAttachments: files\.length > 0/);
assert.match(prototypeSource, /clearSupportDeviceDraft\(\)/);
assert.match(prototypeSource, /crypto\.subtle\.digest\("SHA-256"/);
assert.match(prototypeSource, /readPendingRequesterUpload\(publicCode, fingerprint\)/);
assert.match(prototypeSource, /savePendingRequesterUpload\(/);
assert.match(prototypeSource, /clearPendingRequesterUploads\(\)/);
const restartBlock = prototypeSource.slice(
  prototypeSource.indexOf("function restartConversation"),
  prototypeSource.indexOf("function selectFiles")
);
assert.match(restartBlock, /setProfile\(""\)/);
assert.match(restartBlock, /setClassicDescription\(""\)/);
assert.match(restartBlock, /setFormValues\(defaultSupportFormValues\(\)\)/);
assert.match(restartBlock, /clearSupportDeviceDraft\(\)/);

console.log("support device memory policy: ok");
