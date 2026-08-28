import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [worker, parser, migration, service] = await Promise.all([
  readFile(new URL("../workers/identity-directory-worker.mjs", import.meta.url), "utf8"),
  readFile(new URL("../workers/identity-directory-parser.mjs", import.meta.url), "utf8"),
  readFile(
    new URL(
      "../supabase/migrations/20260828220614_create_identity_directory_quarantine_rows.sql",
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
assert.match(migration, /force row level security/);
assert.match(migration, /from public, anon, authenticated/);
assert.match(service, /--max-old-space-size=384/);
assert.match(service, /MemoryMax=512M/);
assert.match(service, /PrivateTmp=true/);
assert.match(service, /ProtectSystem=strict/);

console.log("identity directory worker: 14/14 checks passed");
