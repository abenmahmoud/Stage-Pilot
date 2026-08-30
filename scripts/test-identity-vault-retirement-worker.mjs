import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [worker, rotationWorker, ingestionWorker] = await Promise.all([
  readFile(new URL("../workers/identity-directory-vault-retirement-check-worker.mjs", import.meta.url), "utf8"),
  readFile(new URL("../workers/identity-directory-vault-rotation-worker.mjs", import.meta.url), "utf8"),
  readFile(new URL("../workers/identity-directory-worker.mjs", import.meta.url), "utf8"),
]);

assert.match(worker, /IDENTITY_VAULT_RETIREMENT_CHECK_ENABLED\s*!==\s*"true"/);
assert.match(worker, /IDENTITY_VAULT_RETIREMENT_INSTITUTION_ID/);
assert.match(worker, /IDENTITY_VAULT_RETIRED_KEY_VERSIONS/);
assert.match(worker, /IDENTITY_VAULT_RETIREMENT_BATCH_LIMIT/);
assert.match(worker, /IDENTITY_VAULT_RETIREMENT_MAX_ROWS/);
assert.doesNotMatch(worker, /IDENTITY_VAULT_RETIREMENT_IMPORT_ID/);
assert.match(worker, /isolation level repeatable read read only/);
assert.match(worker, /where institution_id = \$\{institutionId\}::uuid/);
assert.match(worker, /key_version <> \$\{targetConfig\.version\}/);
assert.match(worker, /totalCount > maxRows/);
assert.match(worker, /identity_vault_rotation_incomplete/);
assert.match(worker, /id > \$\{lastId\}::bigint[\s\S]+order by id[\s\S]+limit \$\{batchLimit\}/i);
assert.match(worker, /rowsByImport = new Map\(\)/);
assert.match(worker, /verifyIdentityVaultKeyRetirement/);
assert.match(worker, /verifiedCount !== totalCount/);
assert.match(worker, /evidenceDigest: evidence\.digest\("hex"\)/);
assert.doesNotMatch(worker, /console\.(?:log|error)\([^\n]*(?:person_ref|ciphertext|auth_tag|rowsByImport)/);

for (const source of [worker, rotationWorker, ingestionWorker]) {
  assert.match(source, /pg_advisory_xact_lock/);
  assert.match(source, /identity-vault:\$\{/);
  assert.match(source, /74219/);
}

console.log("identity vault retirement worker: 26/26 checks passed");
