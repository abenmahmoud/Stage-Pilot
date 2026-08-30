import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  createSupportCallbackConfirmation,
  verifySupportCallbackConfirmation,
} from "../shared/support-callback-confirmation.ts";

const publicCode = "BC-2026-000123";
const callbackId = "2f9d5406-599d-48e6-a9c0-a59895547246";
const correlationId = "58298d45-b2c4-41b8-bcc2-2045f997ec2f";
const now = Date.parse("2026-08-31T09:00:00.000Z");

function confirmation(overrides = {}) {
  return createSupportCallbackConfirmation({
    operation: "support_callback_complete",
    publicCode,
    callbackId,
    previousStatus: "in_progress",
    callbackStatus: "done",
    duplicate: false,
    confirmedAt: new Date(now),
    correlationId,
    ...overrides,
  });
}

test("verifies create, claim, complete and cancel receipts", () => {
  const cases = [
    confirmation({
      operation: "support_callback_create",
      previousStatus: null,
      callbackStatus: "todo",
    }),
    confirmation({
      operation: "support_callback_claim",
      previousStatus: "todo",
      callbackStatus: "in_progress",
    }),
    confirmation(),
    confirmation({
      operation: "support_callback_cancel",
      previousStatus: "todo",
      callbackStatus: "cancelled",
    }),
  ];
  for (const receipt of cases) {
    assert.deepEqual(
      verifySupportCallbackConfirmation({
        expectedOperation: receipt.operation,
        expectedPublicCode: publicCode,
        expectedCallbackId: callbackId,
        confirmation: receipt,
        now,
      }),
      receipt
    );
  }
});

test("accepts an old duplicate but rejects unbound or impossible transitions", () => {
  const duplicate = confirmation({
    duplicate: true,
    confirmedAt: new Date("2026-08-20T09:00:00.000Z"),
  });
  assert.deepEqual(
    verifySupportCallbackConfirmation({
      expectedOperation: duplicate.operation,
      expectedPublicCode: publicCode,
      expectedCallbackId: callbackId,
      confirmation: duplicate,
      now,
    }),
    duplicate
  );

  const valid = confirmation();
  for (const candidate of [
    null,
    { ...valid, status: "queued" },
    { ...valid, operation: "support_callback_claim" },
    { ...valid, publicCode: "BC-2026-000124" },
    { ...valid, callbackId: "not-a-callback" },
    { ...valid, previousStatus: "todo" },
    { ...valid, callbackStatus: "in_progress" },
    { ...valid, duplicate: "false" },
    { ...valid, confirmedAt: "2026-08-31T08:54:59.000Z" },
    { ...valid, confirmationRef: "support:callback:unknown" },
  ]) {
    assert.equal(
      verifySupportCallbackConfirmation({
        expectedOperation: "support_callback_complete",
        expectedPublicCode: publicCode,
        expectedCallbackId: callbackId,
        confirmation: candidate,
        now,
      }),
      null
    );
  }
});

test("binds callback mutations to an idempotency event and exact payload", () => {
  const route = readFileSync(
    new URL("../api/support/agent/requests/[code]/callbacks.ts", import.meta.url),
    "utf8"
  );
  const replyRoute = readFileSync(
    new URL("../api/support/agent/requests/[code]/reply.ts", import.meta.url),
    "utf8"
  );
  assert.match(route, /const operationId = uuid\(idempotencyKey\(req\)/);
  assert.match(route, /eq\(supportEvents\.correlationId, operationId\)/);
  assert.match(route, /operationEvent\.actorId !== user\.id/);
  assert.match(route, /"callback\.creation_reused"/);
  assert.match(route, /eventType: "callback\.creation_reused"[\s\S]*correlationId: operationId/);
  assert.match(route, /existing\.phoneContactId !== phone\.id/);
  assert.match(route, /operationEvent\.callbackId !== callback\.id/);
  assert.match(route, /repeatedOutcome !== callback\.outcome/);
  assert.match(route, /correlationId: operationId/);
  assert.match(route, /returning\(\{[\s\S]*createdAt: supportEvents\.createdAt/);
  assert.match(replyRoute, /callbackId,/);
  assert.match(replyRoute, /toValue: \{[\s\S]*messageId: created\.id,[\s\S]*callbackId,/);
});

test("keeps callback keys and re-reads exact states before success", () => {
  const page = readFileSync(
    new URL("../src/pages/prototype/LyceeConnectPrototype.tsx", import.meta.url),
    "utf8"
  );
  const create = page.slice(
    page.indexOf("async function createCallback"),
    page.indexOf("async function updateCallback")
  );
  const createKey = create.indexOf("callbackCreateSubmissionRef.current?.fingerprint !== submissionFingerprint");
  const createRequest = create.indexOf("apiFetch<unknown>", createKey);
  const createVerify = create.indexOf("verifySupportCallbackConfirmation", createRequest);
  const createReread = create.indexOf("fetchAgentRequestDetail", createVerify);
  const createPersisted = create.indexOf("callback.status === confirmation.callbackStatus", createReread);
  const createDetail = create.indexOf("setDetail(refreshedDetail)", createPersisted);
  assert.ok(
    createKey >= 0
    && createKey < createRequest
    && createRequest < createVerify
    && createVerify < createReread
    && createReread < createPersisted
    && createPersisted < createDetail
  );
  assert.match(create, /headers: \{ "Idempotency-Key": idempotencyKey \}/);

  const update = page.slice(
    page.indexOf("async function updateCallback"),
    page.indexOf("async function saveReplyTemplate")
  );
  const updateKey = update.indexOf("callbackActionSubmissionRef.current?.fingerprint !== submissionFingerprint");
  const updateRequest = update.indexOf("apiFetch<unknown>", updateKey);
  const updateVerify = update.indexOf("verifySupportCallbackConfirmation", updateRequest);
  const updateReread = update.indexOf("fetchAgentRequestDetail", updateVerify);
  const updatePersisted = update.indexOf("callback.status === confirmation.callbackStatus", updateReread);
  const clear = update.indexOf('setCallbackOutcome("")', updatePersisted);
  assert.ok(
    updateKey >= 0
    && updateKey < updateRequest
    && updateRequest < updateVerify
    && updateVerify < updateReread
    && updateReread < updatePersisted
    && updatePersisted < clear
  );
  assert.match(update, /headers: \{ "Idempotency-Key": idempotencyKey \}/);
  assert.match(update, /Réessayez sans modifier le résultat/);
});
