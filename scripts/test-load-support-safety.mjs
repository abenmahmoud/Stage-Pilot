import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(
  new URL("../scripts/load-test-support.mjs", import.meta.url),
  "utf8"
);

test("refuses any target that is not explicitly confirmed as preview", () => {
  assert.match(source, /LOAD_TEST_CONFIRM !== "preview-only"/);
  assert.match(source, /LOAD_TEST_EXPECTED_PROJECT_REF/);
  assert.match(source, /connectionString\.includes\(expectedProjectRef\)/);
});

test("binds all synthetic requests and queue payloads to one named institution", () => {
  assert.match(source, /LOAD_TEST_INSTITUTION_SLUG/);
  assert.match(source, /status in \('pilot', 'active'\)/);
  assert.match(source, /institution_id, idempotency_key_hash/);
  assert.match(source, /'institution_id', \$\{institutionId\}::uuid/);
});

test("scopes counts and cleanup to the synthetic run and institution", () => {
  assert.match(source, /r\.institution_id = \$\{institutionId\}/);
  assert.match(
    source,
    /delete from public\.support_requests[\s\S]*institution_id = \$\{institutionId\}[\s\S]*idempotency_key_hash like/
  );
  assert.match(source, /pgmq\.create\(\$\{queueName\}\)/);
  assert.match(source, /pgmq\.drop_queue\(\$\{queueName\}\)/);
});
