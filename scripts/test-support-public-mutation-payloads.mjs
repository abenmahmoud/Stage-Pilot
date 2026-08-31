import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createSupportAttachmentRemovalConfirmation } from "../shared/support-attachment-removal-confirmation.ts";
import {
  isSupportAttachmentConfirmationPayload,
  isSupportSessionClearPayload,
  verifySupportAttachmentRemovalMutationPayload,
  verifySupportRequesterMessageMutationPayload,
} from "../shared/support-public-mutation-payload-policy.ts";
import { createSupportRequesterMessageConfirmation } from "../shared/support-requester-message-confirmation.ts";

const page = readFileSync(new URL("../src/pages/prototype/LyceeConnectPrototype.tsx", import.meta.url), "utf8");
const messageRoute = readFileSync(new URL("../api/support/requests/[code]/messages.ts", import.meta.url), "utf8");
const attachmentConfirmationRoute = readFileSync(new URL("../api/support/attachments/[id]/confirm.ts", import.meta.url), "utf8");
const attachmentRoute = readFileSync(new URL("../api/support/attachments/[id].ts", import.meta.url), "utf8");
const sessionRoute = readFileSync(new URL("../api/support/session.ts", import.meta.url), "utf8");

const publicCode = "BC-2026-000123";
const attachmentId = "2f9d5406-599d-48e6-a9c0-a59895547246";
const messageId = "a795fc1a-bef1-49e8-b904-88f0d44cd736";
const correlationId = "58298d45-b2c4-41b8-bcc2-2045f997ec2f";
const now = Date.parse("2026-09-01T08:00:00.000Z");

function requesterMessagePayload() {
  return {
    confirmation: createSupportRequesterMessageConfirmation({
      publicCode,
      messageId,
      duplicate: false,
      messageCreatedAt: new Date(now - 1_000),
      confirmedAt: new Date(now),
      correlationId,
    }),
  };
}

function attachmentRemovalPayload() {
  return {
    confirmation: createSupportAttachmentRemovalConfirmation({
      publicCode,
      attachmentId,
      duplicate: false,
      confirmedAt: new Date(now),
      correlationId,
    }),
  };
}

test("accepts only exact requester message mutation payloads", () => {
  const payload = requesterMessagePayload();
  assert.deepEqual(verifySupportRequesterMessageMutationPayload({
    value: payload,
    expectedPublicCode: publicCode,
    now,
  }), payload.confirmation);
  assert.equal(verifySupportRequesterMessageMutationPayload({
    value: { ...payload, internalJobId: "hidden" },
    expectedPublicCode: publicCode,
    now,
  }), null);
  assert.equal(verifySupportRequesterMessageMutationPayload({
    value: { confirmation: { ...payload.confirmation, actorId: "hidden" } },
    expectedPublicCode: publicCode,
    now,
  }), null);
});

test("accepts only exact requester attachment confirmations", () => {
  const payload = {
    attachment: { id: attachmentId, scanStatus: "quarantine" },
    duplicate: false,
  };
  assert.equal(isSupportAttachmentConfirmationPayload(payload, attachmentId), true);
  assert.equal(isSupportAttachmentConfirmationPayload({ ...payload, storagePath: "hidden" }, attachmentId), false);
  assert.equal(isSupportAttachmentConfirmationPayload({
    ...payload,
    attachment: { ...payload.attachment, sha256: "hidden" },
  }, attachmentId), false);
  assert.equal(isSupportAttachmentConfirmationPayload({
    ...payload,
    attachment: { id: attachmentId, scanStatus: "blocked" },
  }, attachmentId), false);
});

test("accepts only exact requester attachment removal payloads", () => {
  const payload = attachmentRemovalPayload();
  assert.deepEqual(verifySupportAttachmentRemovalMutationPayload({
    value: payload,
    expectedPublicCode: publicCode,
    expectedAttachmentId: attachmentId,
    now,
  }), payload.confirmation);
  assert.equal(verifySupportAttachmentRemovalMutationPayload({
    value: { ...payload, storageDeleted: true },
    expectedPublicCode: publicCode,
    expectedAttachmentId: attachmentId,
    now,
  }), null);
  assert.equal(verifySupportAttachmentRemovalMutationPayload({
    value: { confirmation: { ...payload.confirmation, storagePath: "hidden" } },
    expectedPublicCode: publicCode,
    expectedAttachmentId: attachmentId,
    now,
  }), null);
});

test("accepts only the exact session closure acknowledgement", () => {
  assert.equal(isSupportSessionClearPayload({ cleared: true }), true);
  assert.equal(isSupportSessionClearPayload({ cleared: true, sessionHash: "hidden" }), false);
  assert.equal(isSupportSessionClearPayload({ cleared: false }), false);
});

test("validates every public mutation before a visible or local side effect", () => {
  assert.match(page, /from "\.\.\/\.\.\/\.\.\/shared\/support-public-mutation-payload-policy"/);
  assert.doesNotMatch(page, /function isSupportAttachmentConfirmationPayload/);
  assert.doesNotMatch(page, /function isSupportSessionClearPayload/);

  const upload = page.indexOf("async function uploadSupportFile");
  const uploadValidation = page.indexOf("isSupportAttachmentConfirmationPayload", upload);
  const uploadComplete = page.indexOf("completeRequesterUploadSubmission", uploadValidation);
  assert.ok(upload >= 0 && upload < uploadValidation && uploadValidation < uploadComplete);

  const send = page.indexOf("async function sendReply");
  const sendValidation = page.indexOf("verifySupportRequesterMessageMutationPayload", send);
  const sendClear = page.indexOf('setReply("")', sendValidation);
  assert.ok(send >= 0 && send < sendValidation && sendValidation < sendClear);

  const removal = page.indexOf("async function removeRequesterAttachment");
  const removalValidation = page.indexOf("verifySupportAttachmentRemovalMutationPayload", removal);
  const removalClear = page.indexOf("requesterAttachmentRemovalSubmissionRef.current = null", removalValidation);
  assert.ok(removal >= 0 && removal < removalValidation && removalValidation < removalClear);

  const forget = page.indexOf("async function forgetThisDevice");
  const sessionValidation = page.indexOf("isSupportSessionClearPayload", forget);
  const memoryClear = page.indexOf("clearRememberedSupportRequests", sessionValidation);
  assert.ok(forget >= 0 && forget < sessionValidation && sessionValidation < memoryClear);
});

test("validates the four projected server payloads before returning them", () => {
  const messageValidation = messageRoute.indexOf("verifySupportRequesterMessageMutationPayload({");
  const messageStatus = messageRoute.indexOf("res.status(message.duplicate", messageValidation);
  const messageReturn = messageRoute.indexOf("return payload", messageStatus);
  assert.ok(messageValidation >= 0 && messageValidation < messageStatus && messageStatus < messageReturn);
  assert.match(attachmentConfirmationRoute, /isSupportAttachmentConfirmationPayload\(payload, attachmentId\)/);
  assert.match(attachmentConfirmationRoute, /scanStatus !== "quarantine" && attachment\.scanStatus !== "clean"[\s\S]*HttpError\(422/);
  assert.match(attachmentRoute, /verifySupportAttachmentRemovalMutationPayload\([\s\S]*return payload/);
  assert.match(sessionRoute, /isSupportSessionClearPayload\(payload\)[\s\S]*return payload/);
});
