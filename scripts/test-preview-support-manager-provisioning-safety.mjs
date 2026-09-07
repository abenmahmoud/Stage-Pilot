import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(
  new URL("./provision-preview-support-manager.mjs", import.meta.url),
  "utf8"
);

test("keeps real manager provisioning explicit and preview-only", () => {
  assert.match(source, /--preview-only/);
  assert.match(source, /CONFIRM_DDFPT_SUPPORT_MANAGER_PREVIEW/);
  assert.match(source, /projectRefFromUrl\(supabaseUrl\), expectedRef/);
  assert.match(source, /assert\.notEqual\(expectedRef, productionRef/);
  assert.match(source, /lycee-blaise-cendrars-sevran\.fr\/reset-password/);
});

test("creates an agent service manager with every support service", () => {
  for (const service of [
    "referent_numerique",
    "ddfpt",
    "secretariat",
    "vie_scolaire",
    "intendance",
    "direction",
    "administration",
  ]) {
    assert.match(source, new RegExp(`"${service}"`));
  }
  assert.match(source, /role: "agent"/);
  assert.match(source, /account_scope: "support_manager"/);
  assert.match(source, /role: "service_manager"/);
  assert.match(source, /status: "active"/);
});

test("does not create or print a shared password and rolls back partial accounts", () => {
  assert.doesNotMatch(source, /createUser\s*\(/);
  assert.doesNotMatch(source, /console\.log\([^\n]*(email|fullName|createdUserId)/);
  assert.match(source, /inviteUserByEmail/);
  assert.match(source, /deleteUser\(createdUserId\)/);
  assert.match(source, /account rollback was not confirmed/);
  assert.match(source, /password: "chosen_by_invited_user"/);
  assert.match(source, /mfa: "required_on_first_sign_in"/);
});

test("refuses to replace an existing account automatically", () => {
  assert.match(source, /assert\.equal\(existing, null/);
  assert.match(source, /manual review is required/);
});
