import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("../api/_shared/communication-job-claim.ts", import.meta.url),
  "utf8"
);

test("claims only due scoped send jobs with skip locked", () => {
  assert.match(source, /where institution_id = \$\{input\.institutionId\}::uuid/);
  assert.match(source, /status in \('pending', 'retry'\)/);
  assert.match(source, /job_type in \('send_delivery', 'retry_delivery'\)/);
  assert.match(source, /run_after <= \$\{now\}/);
  assert.match(source, /order by run_after asc, created_at asc, id asc/);
  assert.match(source, /for update skip locked/);
});

test("marks the claimed jobs running under the same scope and previous states", () => {
  assert.match(source, /set status = 'running',[\s\S]*locked_at = \$\{now\}/);
  assert.match(source, /job\.institution_id = \$\{input\.institutionId\}::uuid/);
  assert.match(source, /job\.status in \('pending', 'retry'\)/);
  assert.doesNotMatch(source, /contact_ref|provider_message_ref|idempotency_key_hash/);
});

test("bounds claim and recovery batch sizes", async () => {
  const bounded = /boundedInteger\(input\.limit \?\? 10, 1, 20, "claim_limit_invalid"\)/;
  assert.match(source, bounded);
  assert.match(source, /boundedInteger\(input\.limit \?\? 20, 1, 100, "recovery_limit_invalid"\)/);
  assert.match(source, /2 \* 60 \* 1000,[\s\S]*30 \* 60 \* 1000,[\s\S]*"stale_delay_invalid"/);
  assert.match(source, /validInstitutionId\(input\.institutionId\)/);
});

test("recovers only stale running jobs and never steals a fresh lock", () => {
  assert.match(source, /status = 'running'[\s\S]*locked_at < \$\{staleBefore\}/);
  assert.match(source, /order by locked_at asc, id asc[\s\S]*for update skip locked/);
  assert.match(source, /last_error_code = 'worker_interrupted'/);
  assert.match(source, /locked_at = null/);
});

test("moves an interrupted job to retry or dead with a bounded attempt count", () => {
  assert.match(source, /case when job\.attempt_count \+ 1 >= 5 then 'dead' else 'retry' end/);
  assert.match(source, /attempt_count = least\(job\.attempt_count \+ 1, 20\)/);
  assert.match(source, /new Date\(now\.getTime\(\) \+ 60 \* 1000\)/);
  assert.match(source, /row\.status === "dead" \|\| row\.run_after === null/);
});

test("returns identifiers and state only, never recipients or error prose", () => {
  const claimReturn = source.slice(source.indexOf("return Array.from(result as unknown as ClaimedRow[]"), source.indexOf("export async function recoverStale"));
  assert.match(claimReturn, /jobId:[\s\S]*institutionId:[\s\S]*communicationId:[\s\S]*versionId:[\s\S]*deliveryId:/);
  assert.doesNotMatch(claimReturn, /contactRef|email|phone|provider|lastError/);
});
