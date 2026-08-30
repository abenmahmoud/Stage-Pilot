import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const recipe = readFileSync(
  new URL("../supabase/tests/communication_webmail_handshake_security.test.sql", import.meta.url),
  "utf8"
);

test("keeps the 200-delivery preview recipe transactional and residue-free", () => {
  assert.match(recipe, /^begin;/);
  assert.match(recipe, /from generate_series\(1, 200\)/);
  assert.match(recipe, /rollback;\s+select[\s\S]*auth_residue[\s\S]*delivery_residue[\s\S]*job_residue[\s\S]*event_residue;?\s*$/);
  assert.doesNotMatch(recipe, /\bcommit\s*;/i);
});

test("covers completion, retry, dead-letter and pending states", () => {
  assert.match(recipe, /sent_count = 160/);
  assert.match(recipe, /retry_count = 20/);
  assert.match(recipe, /dead_count = 10/);
  assert.match(recipe, /pending_count = 10/);
  assert.match(recipe, /status = 'completed'/);
  assert.match(recipe, /status = 'retry'/);
  assert.match(recipe, /status = 'dead'/);
});

test("proves command immutability and receipt idempotence", () => {
  assert.match(recipe, /duplicate_command_blocked/);
  assert.match(recipe, /duplicate_receipt_event_blocked/);
  assert.match(recipe, /command_mutation_blocked/);
  assert.match(recipe, /Communication delivery identity is immutable/);
  assert.match(recipe, /external_event_hash/);
});

test("uses only opaque fictitious contacts and provider hashes", () => {
  assert.doesNotMatch(recipe, /recipient_email|contact_email|provider_message_id/i);
  assert.doesNotMatch(recipe, /@(gmail|hotmail|yahoo|ac-creteil)\./i);
  assert.match(recipe, /contact:fictive:/);
  assert.match(recipe, /provider_message_ref = md5/);
  assert.match(recipe, /webmail_receipt_hash = md5/);
});
