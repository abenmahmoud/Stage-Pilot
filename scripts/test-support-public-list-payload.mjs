import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  isValidSupportPublicListPayload,
  SUPPORT_PUBLIC_LIST_LIMITS,
} from "../shared/support-public-list-payload-policy.ts";

const page = readFileSync(new URL("../src/pages/prototype/LyceeConnectPrototype.tsx", import.meta.url), "utf8");
const route = readFileSync(new URL("../api/support/requests/index.ts", import.meta.url), "utf8");

const validSummary = {
  publicCode: "BC-2026-000101",
  subject: "Accès ENT",
  category: "ent",
  status: "en_cours",
  priority: "p3",
  createdAt: "2026-09-01T08:00:00.000Z",
  updatedAt: "2026-09-01T08:05:00.000Z",
};

test("validates the public request list before side effects", () => {
  const validation = page.indexOf("if (!isPublicSupportRequestListPayload(payload))");
  const notification = page.indexOf("const receivedCodes = new Set(payload.requests.map", validation);
  const memory = page.indexOf("await rememberSupportRequests(payload.requests)", validation);
  assert.notEqual(validation, -1);
  assert.ok(validation < notification);
  assert.ok(validation < memory);
});

test("accepts one exact and bounded public request list", () => {
  assert.deepEqual(SUPPORT_PUBLIC_LIST_LIMITS, { requests: 200 });
  assert.equal(isValidSupportPublicListPayload({ requests: [validSummary] }), true);
});

test("rejects hidden fields, malformed summaries and oversized lists", () => {
  assert.equal(isValidSupportPublicListPayload({ requests: [validSummary], cursor: "hidden" }), false);
  assert.equal(isValidSupportPublicListPayload({
    requests: [{ ...validSummary, sourceIpHash: "hidden" }],
  }), false);
  assert.equal(isValidSupportPublicListPayload({
    requests: [{ ...validSummary, category: "unknown" }],
  }), false);
  const requests = Array.from(
    { length: SUPPORT_PUBLIC_LIST_LIMITS.requests + 1 },
    (_, index) => ({
      ...validSummary,
      publicCode: `BC-2026-${String(index + 1).padStart(6, "0")}`,
    })
  );
  assert.equal(isValidSupportPublicListPayload({ requests }), false);
});

test("rejects duplicate codes and a non-descending list", () => {
  assert.equal(isValidSupportPublicListPayload({ requests: [validSummary, validSummary] }), false);
  assert.equal(isValidSupportPublicListPayload({
    requests: [
      validSummary,
      {
        ...validSummary,
        publicCode: "BC-2026-000102",
        createdAt: "2026-09-01T09:00:00.000Z",
        updatedAt: "2026-09-01T09:05:00.000Z",
      },
    ],
  }), false);
});

test("delegates the browser contract and ignores stale refreshes", () => {
  assert.match(page, /function isPublicSupportRequestListPayload\(value: unknown\): value is \{ requests: SupportRequestSummary\[\] \} \{\s*return isValidSupportPublicListPayload\(value\);/);
  assert.doesNotMatch(page, /function isPublicSupportRequestSummary\(/);
  assert.match(page, /const loadId = \+\+requestsLoadIdRef\.current/);
  assert.match(page, /if \(loadId !== requestsLoadIdRef\.current\) return;/);
});

test("bounds the server read and refuses a partial device list", () => {
  assert.match(route, /\.limit\(SUPPORT_PUBLIC_LIST_LIMITS\.requests \+ 1\)/);
  assert.match(route, /if \(requests\.length > SUPPORT_PUBLIC_LIST_LIMITS\.requests\)/);
  assert.match(route, /Aucune liste partielle n’a été affichée/);
  assert.match(route, /orderBy\(desc\(supportRequests\.createdAt\)\)/);
});
