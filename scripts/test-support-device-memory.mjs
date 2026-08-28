import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  DEVICE_MEMORY_RETENTION_MS,
  isDeviceMemoryFresh,
} from "../src/lib/support-device-memory.ts";

const now = Date.UTC(2026, 7, 28, 12, 0, 0);
assert.equal(isDeviceMemoryFresh(new Date(now - 1_000).toISOString(), now), true);
assert.equal(isDeviceMemoryFresh(new Date(now - DEVICE_MEMORY_RETENTION_MS).toISOString(), now), true);
assert.equal(isDeviceMemoryFresh(new Date(now - DEVICE_MEMORY_RETENTION_MS - 1).toISOString(), now), false);
assert.equal(isDeviceMemoryFresh(new Date(now + 1).toISOString(), now), false);
assert.equal(isDeviceMemoryFresh("invalid", now), false);

const memorySource = await readFile("src/lib/support-device-memory.ts", "utf8");
const prototypeSource = await readFile("src/pages/prototype/LyceeConnectPrototype.tsx", "utf8");

assert.match(memorySource, /indexedDB\.open/);
assert.doesNotMatch(memorySource, /localStorage|sessionStorage/);
assert.doesNotMatch(memorySource, /magic[_A-Z]?token|access[_A-Z]?token|password/i);
assert.match(prototypeSource, /saveSupportDeviceDraft<AssistantInsight>/);
assert.match(prototypeSource, /requestKey,/);
assert.match(prototypeSource, /"Idempotency-Key": requestKey/);
assert.match(prototypeSource, /hadAttachments: files\.length > 0/);
assert.match(prototypeSource, /clearSupportDeviceDraft\(\)/);

console.log("support device memory policy: ok");
