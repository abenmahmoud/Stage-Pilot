import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  createSupportInternalNoteConfirmation,
  verifySupportInternalNoteConfirmation,
} from "../shared/support-internal-note-confirmation.ts";

const publicCode = "BC-2026-000123";
const messageId = "2f9d5406-599d-48e6-a9c0-a59895547246";
const correlationId = "58298d45-b2c4-41b8-bcc2-2045f997ec2f";
const now = Date.parse("2026-08-31T09:00:00.000Z");

function confirmation(overrides = {}) {
  return createSupportInternalNoteConfirmation({
    publicCode,
    messageId,
    duplicate: false,
    messageCreatedAt: new Date("2026-08-31T08:59:59.000Z"),
    confirmedAt: new Date(now),
    correlationId,
    ...overrides,
  });
}

test("verifies a fresh internal note receipt", () => {
  const receipt = confirmation();
  assert.deepEqual(
    verifySupportInternalNoteConfirmation({ expectedPublicCode: publicCode, confirmation: receipt, now }),
    receipt
  );
});

test("accepts an old duplicate receipt but rejects false or malformed success", () => {
  const duplicate = confirmation({
    duplicate: true,
    messageCreatedAt: new Date("2026-08-20T08:59:59.000Z"),
    confirmedAt: new Date("2026-08-20T09:00:00.000Z"),
  });
  assert.deepEqual(
    verifySupportInternalNoteConfirmation({ expectedPublicCode: publicCode, confirmation: duplicate, now }),
    duplicate
  );

  const valid = confirmation();
  for (const candidate of [
    null,
    { ...valid, status: "queued" },
    { ...valid, operation: "support_requester_message" },
    { ...valid, publicCode: "BC-2026-000124" },
    { ...valid, messageId: "not-a-message" },
    { ...valid, duplicate: "false" },
    { ...valid, messageCreatedAt: "2026-08-31T09:00:01.000Z" },
    { ...valid, messageCreatedAt: "2026-08-31T08:59:59+00:00" },
    { ...valid, confirmedAt: "2026-08-31T09:00:00Z" },
    { ...valid, confirmedAt: "2026-08-31T08:54:59.000Z" },
    { ...valid, confirmationRef: "support:internal-note:unknown" },
    { ...valid, bodyText: "contenu interne" },
  ]) {
    assert.equal(
      verifySupportInternalNoteConfirmation({ expectedPublicCode: publicCode, confirmation: candidate, now }),
      null
    );
  }
});

test("binds an idempotent note replay to author, body and event", () => {
  const route = readFileSync(
    new URL("../api/support/agent/requests/[code]/notes.ts", import.meta.url),
    "utf8"
  );
  assert.match(route, /existing\.bodyText !== note \|\| existing\.authorUserId !== user\.id/);
  assert.match(route, /eq\(supportEvents\.actorId, user\.id\)/);
  assert.match(route, /supportEvents\.toValue}->>'messageId'/);
  assert.match(route, /La note enregistrée n'a pas de confirmation exploitable/);

  const transaction = route.indexOf("const result = await db.transaction");
  const eventTime = route.indexOf("returning({ createdAt: supportEvents.createdAt })", transaction);
  const factory = route.indexOf("createSupportInternalNoteConfirmation", eventTime);
  assert.ok(transaction >= 0 && transaction < eventTime && eventTime < factory);
});

test("keeps one note key and clears only after re-reading the internal message", () => {
  const page = readFileSync(
    new URL("../src/pages/prototype/LyceeConnectPrototype.tsx", import.meta.url),
    "utf8"
  );
  const save = page.slice(
    page.indexOf("async function saveInternalNote"),
    page.indexOf("async function createCallback")
  );
  const key = save.indexOf("internalNoteSubmissionRef.current?.fingerprint !== submissionFingerprint");
  const request = save.indexOf("apiFetch<unknown>", key);
  const verify = save.indexOf("verifySupportInternalNoteConfirmation", request);
  const reread = save.indexOf("fetchAgentRequestDetail", verify);
  const persisted = save.indexOf("message.id === confirmation.messageId", reread);
  const persistedAt = save.indexOf("message.createdAt === confirmation.messageCreatedAt", persisted);
  const clear = save.indexOf('setInternalNote("")', persistedAt);
  assert.ok(
    key >= 0
    && key < request
    && request < verify
    && verify < reread
    && reread < persisted
    && persisted < persistedAt
    && persistedAt < clear
  );
  assert.match(save, /headers: \{ "Idempotency-Key": idempotencyKey \}/);
  assert.match(save, /Réessayez sans la modifier/);
});
