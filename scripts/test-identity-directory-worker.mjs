import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [worker, parser, vault, migration, vaultMigration, service] = await Promise.all([
  readFile(new URL("../workers/identity-directory-worker.mjs", import.meta.url), "utf8"),
  readFile(new URL("../workers/identity-directory-parser.mjs", import.meta.url), "utf8"),
  readFile(new URL("../workers/identity-directory-vault.mjs", import.meta.url), "utf8"),
  readFile(
    new URL(
      "../supabase/migrations/20260828220614_create_identity_directory_quarantine_rows.sql",
      import.meta.url
    ),
    "utf8"
  ),
  readFile(
    new URL(
      "../supabase/migrations/20260829010855_create_identity_directory_vault.sql",
      import.meta.url
    ),
    "utf8"
  ),
  readFile(
    new URL("../deploy/lycee-identity-directory-worker.service", import.meta.url),
    "utf8"
  ),
]);

assert.match(worker, /IDENTITY_CONTACT_PEPPER/);
assert.match(worker, /identityVaultConfig\(\)/);
assert.match(worker, /encryptIdentityVaultPayload/);
assert.match(worker, /identity_directory_private_rows/);
assert.match(worker, /for update/);
assert.match(worker, /lockedImport\.status !== "parsing"/);
assert.ok(
  worker.indexOf("await clamScan") < worker.indexOf("const parsed = parseIdentityDirectoryBytes"),
  "antivirus must run before parsing"
);
assert.match(worker, /set status = 'quarantined'/);
assert.match(worker, /set status = 'parsing'/);
assert.match(worker, /set status = 'review'/);
assert.match(worker, /pgmq\.delete\('identity_directory_scan'/);
assert.match(worker, /pgmq\.archive\('identity_directory_scan'/);
assert.match(parser, /createHmac\("sha256", pepper\)/);
assert.doesNotMatch(parser, /firstName:/);
assert.doesNotMatch(parser, /lastName:/);
assert.match(vault, /aes-256-gcm/);
assert.match(vault, /cipher\.setAAD/);
assert.match(vault, /randomBytes\(12\)/);
assert.match(migration, /force row level security/);
assert.match(migration, /from public, anon, authenticated/);
assert.match(vaultMigration, /identity_directory_private_rows/);
assert.match(vaultMigration, /force row level security/);
assert.match(vaultMigration, /from public, anon, authenticated/);
assert.match(service, /--max-old-space-size=384/);
assert.match(service, /MemoryMax=512M/);
assert.match(service, /PrivateTmp=true/);
assert.match(service, /ProtectSystem=strict/);

console.log("identity directory worker: 26/26 checks passed");
