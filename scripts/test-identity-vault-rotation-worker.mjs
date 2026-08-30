import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const worker = await readFile(
  new URL("../workers/identity-directory-vault-rotation-worker.mjs", import.meta.url),
  "utf8"
);
const migration = await readFile(
  new URL("../supabase/migrations/20260830140000_prepare_identity_vault_rotation.sql", import.meta.url),
  "utf8"
);

assert.match(worker, /IDENTITY_VAULT_ROTATION_ENABLED\s*!==\s*"true"/);
assert.match(worker, /IDENTITY_VAULT_ROTATION_INSTITUTION_ID/);
assert.match(worker, /IDENTITY_VAULT_ROTATION_IMPORT_ID/);
assert.match(worker, /IDENTITY_VAULT_ROTATION_BATCH_LIMIT/);
assert.match(worker, /IDENTITY_VAULT_ROTATION_MAX_ROWS/);
assert.match(worker, /sql\.begin\(async \(transaction\)/);
assert.match(worker, /institution_id = \$\{institutionId\}::uuid/);
assert.match(worker, /import_id = \$\{importId\}::uuid/);
assert.match(worker, /key_version <> \$\{targetConfig\.version\}/);
assert.match(worker, /order by id[\s\S]*limit \$\{batchLimit\}[\s\S]*for update skip locked/i);
assert.match(worker, /rotateIdentityVaultBatch/);
assert.match(worker, /and key_version = \$\{source\.key_version\}/);
assert.match(worker, /and iv = \$\{source\.iv\}/);
assert.match(worker, /and auth_tag = \$\{source\.auth_tag\}/);
assert.match(worker, /and ciphertext = \$\{source\.ciphertext\}/);
assert.match(worker, /updated\.length !== 1/);
assert.match(worker, /'rotate_vault_batch', null, \$\{transaction\.json\(summary\)\}/);
assert.match(worker, /remainingCount/);
assert.doesNotMatch(worker, /sourceRows\.length === 0[\s\S]{0,400}remainingCount:\s*0/);
assert.doesNotMatch(worker, /console\.(?:log|error)\([^\n]*(?:person_ref|ciphertext|auth_tag|sourceRows|batch\.rows)/);

assert.match(migration, /identity_directory_private_rows_rotation_idx/);
assert.match(migration, /institution_id,[\s\S]*import_id,[\s\S]*key_version,[\s\S]*id/);
assert.match(migration, /'rotate_vault_batch'/);
assert.doesNotMatch(migration, /grant\s+[^;]*(?:anon|authenticated)/i);

console.log("identity vault rotation worker: 24/24 checks passed");
