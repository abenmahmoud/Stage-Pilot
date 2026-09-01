import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import "./test-support-incident-guidance.mjs";
import "./test-support-operations-payload.mjs";
import {
  isSupportRetryableJobType,
  retryPayloadId,
  supportRetryNeedsRequesterAccess,
} from "../shared/support-job-retry.ts";
import {
  createSupportJobRetryConfirmation,
  verifySupportJobRetryConfirmation,
} from "../shared/support-operation-confirmation.ts";

const root = new URL("../", import.meta.url);

test("limits manual retries to known notification jobs", () => {
  assert.equal(isSupportRetryableJobType("send_requester_reply"), true);
  assert.equal(isSupportRetryableJobType("delete_request"), false);
  assert.equal(supportRetryNeedsRequesterAccess("send_requester_reply"), true);
  assert.equal(supportRetryNeedsRequesterAccess("notify_agent_request_created"), false);
});

test("accepts only opaque identifiers from the redacted failure payload", () => {
  const id = "9c7032e1-2607-4bc3-a99c-8d93371d6ddf";
  assert.equal(retryPayloadId({ messageId: id }, "messageId"), id);
  assert.equal(retryPayloadId({ messageId: "../../secret" }, "messageId"), null);
  assert.equal(retryPayloadId({ accessToken: "secret" }, "contactId"), null);
});

test("requires direction scope and MFA for global operations", async () => {
  const source = await readFile(new URL("../api/_shared/support-operations.ts", import.meta.url), "utf8");
  assert.match(source, /context\.access\.canViewAll/);
  assert.match(source, /requireAal2\(req\)/);
});

test("rotates requester access and keeps secrets out of the response", async () => {
  const source = await readFile(new URL("../api/support/agent/operations/[id]/retry.ts", import.meta.url), "utf8");
  assert.match(source, /randomBytes\(32\)/);
  assert.match(source, /supportMagicTokens/);
  assert.match(source, /tokenHash: sha256\(accessToken\)/);
  assert.match(source, /isNull\(supportMagicTokens\.usedAt\)/);
  assert.match(source, /isNull\(supportFailedJobs\.retriedAt\)/);
  assert.match(source, /pgmq\.send\('support_jobs'/);
  assert.doesNotMatch(source, /return \{[^}]*accessToken/);
});

test("accepts only a current retry confirmation tied to the failed job", () => {
  const failedJobId = "9c7032e1-2607-4bc3-a99c-8d93371d6ddf";
  const now = Date.parse("2026-08-30T10:00:00.000Z");
  const confirmation = createSupportJobRetryConfirmation({
    failedJobId,
    jobId: "2f9d5406-599d-48e6-a9c0-a59895547246",
    correlationId: "58298d45-b2c4-41b8-bcc2-2045f997ec2f",
    confirmedAt: new Date(now),
  });

  assert.deepEqual(
    verifySupportJobRetryConfirmation({ expectedFailedJobId: failedJobId, confirmation, now }),
    confirmation
  );
  for (const invalid of [
    null,
    { ...confirmation, status: "pending" },
    { ...confirmation, failedJobId: "00a3661c-0845-4f43-aaef-86c1a80e2c61" },
    { ...confirmation, jobId: "not-a-job" },
    { ...confirmation, confirmationRef: "support:job-retry:unknown" },
    { ...confirmation, confirmedAt: "2026-08-30T10:00:00+00:00" },
    { ...confirmation, confirmedAt: "2026-08-30T09:54:59.000Z" },
    { ...confirmation, confirmedAt: "2026-08-30T10:05:01.000Z" },
    { ...confirmation, accessToken: "secret" },
  ]) {
    assert.equal(
      verifySupportJobRetryConfirmation({ expectedFailedJobId: failedJobId, confirmation: invalid, now }),
      null
    );
  }
});

test("confirms the retry from the transaction before showing success", async () => {
  const route = await readFile(new URL("../api/support/agent/operations/[id]/retry.ts", import.meta.url), "utf8");
  const page = await readFile(new URL("../src/pages/admin/SupportOperationsPage.tsx", import.meta.url), "utf8");
  const transaction = route.indexOf("const confirmedAt = await db.transaction");
  const eventTime = route.indexOf("returning({ createdAt: supportEvents.createdAt })", transaction);
  const response = route.indexOf("return createSupportJobRetryConfirmation", eventTime);
  assert.ok(transaction >= 0 && transaction < eventTime && eventTime < response);

  const retryAction = page.slice(page.indexOf("async function retry"), page.indexOf("const summary"));
  const verification = retryAction.indexOf("verifySupportJobRetryConfirmation");
  const notice = retryAction.indexOf("setNotice(`La relance");
  assert.ok(verification >= 0 && verification < notice);
  assert.match(retryAction, /La relance n'a pas été confirmée par le serveur/);
});

test("shows only unresolved failures without exposing contact values", async () => {
  const source = await readFile(new URL("../api/support/agent/operations/index.ts", import.meta.url), "utf8");
  assert.match(source, /isNull\(supportFailedJobs\.retriedAt\)/);
  assert.match(source, /\.limit\(50\)/);
  assert.doesNotMatch(source, /supportContacts\.value/);
});

test("counts interrupted attachment removals without exposing storage details", async () => {
  const source = await readFile(new URL("../api/support/agent/operations/index.ts", import.meta.url), "utf8");
  const page = await readFile(new URL("../src/pages/admin/SupportOperationsPage.tsx", import.meta.url), "utf8");

  assert.match(source, /attachmentRemovalStats/);
  assert.match(source, /supportRequests\.institutionId, context\.institutionId/);
  assert.match(source, /supportAttachments\.direction, "agent"/);
  assert.match(source, /supportAttachments\.scanStatus} = 'removal_pending'/);
  assert.match(source, /supportAttachments\.scanDetail} = 'storage_removal_failed'/);
  assert.match(source, /isNull\(supportAttachments\.messageId\)/);
  assert.match(source, /isNull\(supportAttachments\.releasedAt\)/);
  assert.doesNotMatch(source, /originalName: supportAttachments\.originalName/);
  assert.doesNotMatch(source, /storagePath: supportAttachments\.storagePath/);
  assert.match(page, /summary\.attachmentRemovalsWaiting === 0/);
  assert.match(page, /Retraits à reprendre/);
});
