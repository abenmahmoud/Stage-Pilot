import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  createSupportAttachmentRemovalConfirmation,
  verifySupportAttachmentRemovalConfirmation,
} from "../shared/support-attachment-removal-confirmation.ts";

const publicCode = "BC-2026-000123";
const attachmentId = "2f9d5406-599d-48e6-a9c0-a59895547246";
const correlationId = "58298d45-b2c4-41b8-bcc2-2045f997ec2f";
const now = Date.parse("2026-08-31T09:00:00.000Z");

function confirmation(overrides = {}) {
  return createSupportAttachmentRemovalConfirmation({
    publicCode,
    attachmentId,
    duplicate: false,
    confirmedAt: new Date(now),
    correlationId,
    ...overrides,
  });
}

test("verifies a fresh attachment removal receipt", () => {
  const receipt = confirmation();
  assert.deepEqual(
    verifySupportAttachmentRemovalConfirmation({
      expectedPublicCode: publicCode,
      expectedAttachmentId: attachmentId,
      confirmation: receipt,
      now,
    }),
    receipt
  );
});

test("accepts an old duplicate but rejects false or unbound removal", () => {
  const duplicate = confirmation({
    duplicate: true,
    confirmedAt: new Date("2026-08-20T09:00:00.000Z"),
  });
  assert.deepEqual(
    verifySupportAttachmentRemovalConfirmation({
      expectedPublicCode: publicCode,
      expectedAttachmentId: attachmentId,
      confirmation: duplicate,
      now,
    }),
    duplicate
  );

  const valid = confirmation();
  for (const candidate of [
    null,
    { ...valid, status: "pending" },
    { ...valid, operation: "support_attachment_remove" },
    { ...valid, publicCode: "BC-2026-000124" },
    { ...valid, attachmentId: "a795fc1a-bef1-49e8-b904-88f0d44cd736" },
    { ...valid, duplicate: "false" },
    { ...valid, confirmedAt: "2026-08-31T08:54:59.000Z" },
    { ...valid, confirmationRef: "support:attachment-removal:unknown" },
    { ...valid, storagePath: "hidden" },
  ]) {
    assert.equal(
      verifySupportAttachmentRemovalConfirmation({
        expectedPublicCode: publicCode,
        expectedAttachmentId: attachmentId,
        confirmation: candidate,
        now,
      }),
      null
    );
  }
});

test("binds removal and concurrent reuse to the exact durable event", () => {
  const route = readFileSync(
    new URL("../api/support/agent/attachments/[id].ts", import.meta.url),
    "utf8"
  );
  const operationLookup = route.indexOf("eq(supportEvents.correlationId, removalOperationId)");
  const candidateLookup = route.indexOf("const prepared = await db.transaction");
  assert.ok(operationLookup >= 0 && operationLookup < candidateLookup);
  assert.match(route, /operationEvent\.actorId !== user\.id/);
  assert.match(route, /operationEvent\.attachmentId !== id/);
  assert.match(route, /eventType: "attachment\.draft_removed"[\s\S]*correlationId: removalOperationId/);
  assert.match(route, /eventType: "attachment\.draft_removal_reused"[\s\S]*correlationId: removalOperationId/);
  assert.match(route, /returning\(\{[\s\S]*createdAt: supportEvents\.createdAt/);
  assert.doesNotMatch(route, /fromValue: \{[^}]*originalName/);
});

test("keeps the removal key and re-reads absence before clearing the UI", () => {
  const page = readFileSync(
    new URL("../src/pages/prototype/LyceeConnectPrototype.tsx", import.meta.url),
    "utf8"
  );
  const removal = page.slice(
    page.indexOf("async function removeAgentAttachment"),
    page.indexOf("const selected = detail?.request")
  );
  const stableKey = removal.indexOf("attachmentRemovalSubmissionRef.current?.fingerprint !== submissionFingerprint");
  const request = removal.indexOf("apiFetch<unknown>", stableKey);
  const verify = removal.indexOf("verifySupportAttachmentRemovalConfirmation", request);
  const reread = removal.indexOf("fetchAgentRequestDetail", verify);
  const absence = removal.indexOf("refreshedDetail.attachments.some", reread);
  const clearKey = removal.indexOf("attachmentRemovalSubmissionRef.current = null", absence);
  const update = removal.indexOf("setDetail(refreshedDetail)", clearKey);
  assert.ok(
    stableKey >= 0
    && stableKey < request
    && request < verify
    && verify < reread
    && reread < absence
    && absence < clearKey
    && clearKey < update
  );
  assert.match(removal, /headers: \{ "Idempotency-Key": idempotencyKey \}/);
  assert.equal(removal.match(/fetchAgentRequestDetail/g)?.length, 1);
});
