import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  createSupportAgentReplyConfirmation,
  verifySupportAgentReplyConfirmation,
} from "../shared/support-agent-reply-confirmation.ts";

const publicCode = "BC-2026-000123";
const messageId = "2f9d5406-599d-48e6-a9c0-a59895547246";
const correlationId = "58298d45-b2c4-41b8-bcc2-2045f997ec2f";
const now = Date.parse("2026-08-31T09:00:00.000Z");

function confirmation(overrides = {}) {
  return createSupportAgentReplyConfirmation({
    publicCode,
    messageId,
    channel: "email",
    duplicate: false,
    messageCreatedAt: new Date("2026-08-31T08:59:59.000Z"),
    confirmedAt: new Date(now),
    correlationId,
    ...overrides,
  });
}

test("verifies a fresh queued reply and its callback equivalent", () => {
  const queued = confirmation();
  assert.deepEqual(
    verifySupportAgentReplyConfirmation({ expectedPublicCode: publicCode, confirmation: queued, now }),
    queued
  );
  const callback = confirmation({ channel: "phone" });
  assert.equal(callback.status, "callback_required");
  assert.deepEqual(
    verifySupportAgentReplyConfirmation({ expectedPublicCode: publicCode, confirmation: callback, now }),
    callback
  );
});

test("accepts an old duplicate receipt but rejects false or malformed success", () => {
  const duplicate = confirmation({
    duplicate: true,
    messageCreatedAt: new Date("2026-08-20T08:59:59.000Z"),
    confirmedAt: new Date("2026-08-20T09:00:00.000Z"),
  });
  assert.deepEqual(
    verifySupportAgentReplyConfirmation({ expectedPublicCode: publicCode, confirmation: duplicate, now }),
    duplicate
  );

  const valid = confirmation();
  for (const candidate of [
    null,
    { ...valid, status: "sent" },
    { ...valid, operation: "support_request_update" },
    { ...valid, publicCode: "BC-2026-000124" },
    { ...valid, messageId: "not-a-message" },
    { ...valid, channel: "sms" },
    { ...valid, duplicate: "false" },
    { ...valid, messageCreatedAt: "2026-08-31T09:00:01.000Z" },
    { ...valid, confirmedAt: "2026-08-31T08:54:59.000Z" },
    { ...valid, confirmationRef: "support:agent-reply:unknown" },
  ]) {
    assert.equal(
      verifySupportAgentReplyConfirmation({ expectedPublicCode: publicCode, confirmation: candidate, now }),
      null
    );
  }
});

test("binds idempotent replay to the same body, attachments and event", () => {
  const route = readFileSync(
    new URL("../api/support/agent/requests/[code]/reply.ts", import.meta.url),
    "utf8"
  );
  assert.match(route, /existingReply\.bodyText !== messageText/);
  assert.match(route, /sameAttachmentIds\(attachmentIds, existingAttachments/);
  assert.match(route, /supportEvents\.toValue}->>'messageId'/);
  assert.match(route, /La réponse enregistrée n'a pas de confirmation exploitable/);

  const transaction = route.indexOf("const result = await db.transaction");
  const eventTime = route.indexOf("returning({ createdAt: supportEvents.createdAt })", transaction);
  const factory = route.indexOf("createSupportAgentReplyConfirmation", eventTime);
  assert.ok(transaction >= 0 && transaction < eventTime && eventTime < factory);
});

test("keeps one submission key and clears the editor only after re-reading the message", () => {
  const page = readFileSync(
    new URL("../src/pages/prototype/LyceeConnectPrototype.tsx", import.meta.url),
    "utf8"
  );
  const send = page.slice(
    page.indexOf("async function sendAgentReply"),
    page.indexOf("async function selectAgentFiles")
  );
  const key = send.indexOf("replySubmissionRef.current?.fingerprint !== submissionFingerprint");
  const request = send.indexOf("apiFetch<unknown>", key);
  const verify = send.indexOf("verifySupportAgentReplyConfirmation", request);
  const reread = send.indexOf("fetchAgentRequestDetail", verify);
  const persisted = send.indexOf("message.id === confirmation.messageId", reread);
  const persistedAt = send.indexOf("message.createdAt === confirmation.messageCreatedAt", persisted);
  const clear = send.indexOf('setReply("")', persisted);
  assert.ok(
    key >= 0
    && key < request
    && request < verify
    && verify < reread
    && reread < persisted
    && persisted < persistedAt
    && persistedAt < clear
  );
  assert.match(send, /headers: \{ "Idempotency-Key": idempotencyKey \}/);
  assert.match(send, /Réessayez sans modifier le message/);
});
