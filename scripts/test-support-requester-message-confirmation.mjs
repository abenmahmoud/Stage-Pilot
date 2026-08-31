import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  createSupportRequesterMessageConfirmation,
  verifySupportRequesterMessageConfirmation,
} from "../shared/support-requester-message-confirmation.ts";

const publicCode = "BC-2026-000123";
const messageId = "2f9d5406-599d-48e6-a9c0-a59895547246";
const correlationId = "58298d45-b2c4-41b8-bcc2-2045f997ec2f";
const now = Date.parse("2026-08-31T09:00:00.000Z");

function confirmation(overrides = {}) {
  return createSupportRequesterMessageConfirmation({
    publicCode,
    messageId,
    duplicate: false,
    messageCreatedAt: new Date("2026-08-31T08:59:59.000Z"),
    confirmedAt: new Date(now),
    correlationId,
    ...overrides,
  });
}

test("verifies a fresh requester message receipt", () => {
  const receipt = confirmation();
  assert.deepEqual(
    verifySupportRequesterMessageConfirmation({
      expectedPublicCode: publicCode,
      confirmation: receipt,
      now,
    }),
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
    verifySupportRequesterMessageConfirmation({
      expectedPublicCode: publicCode,
      confirmation: duplicate,
      now,
    }),
    duplicate
  );

  const valid = confirmation();
  for (const candidate of [
    null,
    { ...valid, status: "queued" },
    { ...valid, operation: "support_agent_reply" },
    { ...valid, publicCode: "BC-2026-000124" },
    { ...valid, messageId: "not-a-message" },
    { ...valid, duplicate: "false" },
    { ...valid, messageCreatedAt: "2026-08-31T09:00:01.000Z" },
    { ...valid, confirmedAt: "2026-08-31T08:54:59.000Z" },
    { ...valid, confirmationRef: "support:requester-message:unknown" },
    { ...valid, internalEventId: "hidden" },
  ]) {
    assert.equal(
      verifySupportRequesterMessageConfirmation({
        expectedPublicCode: publicCode,
        confirmation: candidate,
        now,
      }),
      null
    );
  }
});

test("binds an idempotent replay to the same body and persisted event", () => {
  const route = readFileSync(
    new URL("../api/support/requests/[code]/messages.ts", import.meta.url),
    "utf8"
  );
  assert.match(route, /existing\.bodyText !== text/);
  assert.match(route, /supportEvents\.toValue}->>'messageId'/);
  assert.match(route, /Le message enregistré n'a pas de confirmation exploitable/);

  const transaction = route.indexOf("const message = await db.transaction");
  const eventTime = route.indexOf("returning({ createdAt: supportEvents.createdAt })", transaction);
  const factory = route.indexOf("createSupportRequesterMessageConfirmation", eventTime);
  assert.ok(transaction >= 0 && transaction < eventTime && eventTime < factory);
});

test("keeps one submission key and clears only after re-reading the inbound message", () => {
  const page = readFileSync(
    new URL("../src/pages/prototype/LyceeConnectPrototype.tsx", import.meta.url),
    "utf8"
  );
  const send = page.slice(
    page.indexOf("async function sendReply"),
    page.indexOf("async function openPublicAttachment")
  );
  const key = send.indexOf("requesterReplySubmissionRef.current?.fingerprint !== submissionFingerprint");
  const request = send.indexOf("fetch(`/api/support/requests/${code}/messages`", key);
  const verify = send.indexOf("verifySupportRequesterMessageMutationPayload", request);
  const reread = send.indexOf("fetch(`/api/support/requests/${code}`", verify);
  const persisted = send.indexOf("message.id === confirmation.messageId", reread);
  const persistedAt = send.indexOf("message.createdAt === confirmation.messageCreatedAt", persisted);
  const clear = send.indexOf('setReply("")', persistedAt);
  assert.ok(
    key >= 0
    && key < request
    && request < verify
    && verify < reread
    && reread < persisted
    && persisted < persistedAt
    && persistedAt < clear
  );
  assert.match(send, /"Idempotency-Key": idempotencyKey/);
  assert.match(send, /Réessayez sans modifier le message/);
});
