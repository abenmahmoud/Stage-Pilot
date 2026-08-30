import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  parseSupportEmailQueueJob,
  supportEmailFailureDisposition,
} from "../shared/support-email-job-policy.ts";

const institutionId = "00000000-0000-4000-8000-000000000101";
const base = {
  job_id: "00000000-0000-4000-8000-000000000201",
  job_type: "notify_requester_request_created",
  institution_id: institutionId,
  request_id: "00000000-0000-4000-8000-000000000301",
  message_id: "00000000-0000-4000-8000-000000000401",
  contact_id: "00000000-0000-4000-8000-000000000501",
  access_token: "fictitious_access_token_1234567890_abcd",
};

test("accepts every supported fictitious email job with a stable job identifier", () => {
  for (const jobType of [
    "notify_requester_request_created",
    "notify_agent_request_created",
    "notify_agent_message_received",
    "send_requester_reply",
  ]) {
    const requesterJob = ["notify_requester_request_created", "send_requester_reply"].includes(jobType);
    const value = {
      ...base,
      job_type: jobType,
      ...(requesterJob ? {} : { contact_id: undefined, access_token: undefined }),
    };
    const parsed = parseSupportEmailQueueJob(JSON.stringify(value), institutionId);
    assert.equal(parsed.job_id, base.job_id);
    assert.equal(parsed.institution_id, institutionId);
    assert.equal(parsed.job_type, jobType);
  }
});

test("rejects missing scope, cross-institution work and malformed identifiers", () => {
  assert.throws(
    () => parseSupportEmailQueueJob({ ...base, institution_id: undefined }, institutionId),
    /institution_mismatch/
  );
  assert.throws(
    () => parseSupportEmailQueueJob({ ...base, institution_id: "00000000-0000-4000-8000-000000000999" }, institutionId),
    /institution_mismatch/
  );
  assert.throws(
    () => parseSupportEmailQueueJob({ ...base, request_id: "not-a-uuid" }, institutionId),
    /invalid_queue_payload/
  );
});

test("rejects unsupported jobs, missing evidence and unsafe access tokens", () => {
  assert.throws(
    () => parseSupportEmailQueueJob({ ...base, job_type: "send_anything" }, institutionId),
    /unsupported_job_type/
  );
  assert.throws(
    () => parseSupportEmailQueueJob({ ...base, message_id: undefined }, institutionId),
    /invalid_queue_payload/
  );
  assert.throws(
    () => parseSupportEmailQueueJob({ ...base, access_token: "short" }, institutionId),
    /invalid_queue_payload/
  );
  assert.throws(
    () => parseSupportEmailQueueJob("{".repeat(4_097), institutionId),
    /invalid_queue_payload/
  );
});

test("retries four times and isolates the fifth failure", () => {
  assert.deepEqual(
    [1, 2, 3, 4, 5, 6].map(supportEmailFailureDisposition),
    ["retry", "retry", "retry", "retry", "dead_letter", "dead_letter"]
  );
  for (const invalid of [0, -1, 1.5, Number.NaN, 10_001]) {
    assert.throws(() => supportEmailFailureDisposition(invalid), /invalid_queue_attempt/);
  }
});

test("validates and scopes a queue item before delivery or database lookup", async () => {
  const worker = await readFile(new URL("../api/cron/support-worker.ts", import.meta.url), "utf8");
  const parser = worker.indexOf("parseSupportEmailQueueJob(row.message, institutionId)");
  const lookup = worker.indexOf("const [alreadyDone]", parser);
  const delivery = worker.indexOf("await deliver(job, institutionId)", parser);
  assert.ok(parser >= 0 && parser < lookup && lookup < delivery);
  assert.match(worker.slice(parser, lookup), /pgmq\.archive\('support_jobs'/u);
  assert.match(worker, /supportEmailFailureDisposition\(row\.read_ct\) === "dead_letter"/u);
  assert.match(worker, /idempotencyKey: job\.job_id/u);
});
