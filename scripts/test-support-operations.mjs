import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  isSupportRetryableJobType,
  retryPayloadId,
  supportRetryNeedsRequesterAccess,
} from "../shared/support-job-retry.ts";

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

test("shows only unresolved failures without exposing contact values", async () => {
  const source = await readFile(new URL("../api/support/agent/operations/index.ts", import.meta.url), "utf8");
  assert.match(source, /isNull\(supportFailedJobs\.retriedAt\)/);
  assert.match(source, /\.limit\(50\)/);
  assert.doesNotMatch(source, /supportContacts\.value/);
});
