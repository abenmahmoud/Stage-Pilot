import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const ALL_SUPPORT_SERVICES = [
  "referent_numerique",
  "ddfpt",
  "secretariat",
  "vie_scolaire",
  "intendance",
  "direction",
  "administration",
];

async function loadEnvFile(path) {
  const content = await readFile(path, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    if (!match || process.env[match[1]]) continue;
    const rawValue = match[2].trim();
    process.env[match[1]] =
      rawValue.length >= 2
      && ((rawValue.startsWith('"') && rawValue.endsWith('"'))
        || (rawValue.startsWith("'") && rawValue.endsWith("'")))
        ? rawValue.slice(1, -1)
        : rawValue;
  }
}

function projectRefFromUrl(value) {
  return new URL(value).hostname.split(".")[0] ?? "";
}

function normalizedEmail(value) {
  const email = value.trim().toLowerCase();
  assert.match(email, /^[^\s@]+@[^\s@]+\.[^\s@]+$/, "A valid professional email is required");
  assert.ok(email.length <= 254, "The email is too long");
  assert.doesNotMatch(email, /@(example\.(?:com|test)|.*\.invalid)$/i, "A real professional email is required");
  return email;
}

function normalizedName(value) {
  const name = value.trim().replace(/\s+/g, " ");
  assert.ok(name.length >= 2 && name.length <= 120, "A bounded full name is required");
  assert.doesNotMatch(name, /[\u0000-\u001f\u007f]/, "The full name contains a control character");
  return name;
}

async function findUserByEmail(admin, email) {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const found = data.users.find((user) => user.email?.toLowerCase() === email);
    if (found) return found;
    if (data.users.length < 1000) return null;
  }
  throw new Error("The bounded Auth lookup did not complete");
}

assert.ok(process.argv.includes("--preview-only"), "The preview-only flag is required");
await loadEnvFile(process.env.PREVIEW_ENV_FILE ?? ".env.preview.local");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const expectedRef = process.env.EXPECTED_SUPABASE_REF ?? "";
const productionRef = process.env.PRODUCTION_SUPABASE_REF ?? "";
const confirmation = process.env.CONFIRM_DDFPT_SUPPORT_MANAGER_PREVIEW ?? "";
const email = normalizedEmail(process.env.DDFPT_SUPPORT_MANAGER_EMAIL ?? "");
const fullName = normalizedName(process.env.DDFPT_SUPPORT_MANAGER_NAME ?? "");
const redirectTo = process.env.DDFPT_SUPPORT_MANAGER_REDIRECT_URL
  ?? "https://lycee-blaise-cendrars-sevran.fr/reset-password";

assert.ok(supabaseUrl && serviceRoleKey && expectedRef && productionRef, "Preview configuration is incomplete");
assert.equal(projectRefFromUrl(supabaseUrl), expectedRef, "Unexpected Supabase target");
assert.notEqual(expectedRef, productionRef, "Preview and production references must differ");
assert.equal(confirmation, expectedRef, "Explicit preview provisioning confirmation is required");
assert.equal(
  new URL(redirectTo).origin,
  "https://lycee-blaise-cendrars-sevran.fr",
  "The invitation redirect must stay on the school site"
);
assert.equal(new URL(redirectTo).pathname, "/reset-password", "Unexpected invitation redirect path");

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const existing = await findUserByEmail(admin, email);
assert.equal(existing, null, "An account already uses this address; manual review is required");

const { data: institution, error: institutionError } = await admin
  .from("institutions")
  .select("id, status")
  .eq("slug", "blaise-cendrars-sevran")
  .single();
if (institutionError) throw institutionError;
assert.ok(["pilot", "active"].includes(institution.status), "The institution is not open to staff access");

let createdUserId = null;
try {
  const invited = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    data: { full_name: fullName },
  });
  if (invited.error || !invited.data.user) {
    throw invited.error ?? new Error("The invitation did not create an account");
  }
  createdUserId = invited.data.user.id;

  const updated = await admin.auth.admin.updateUserById(createdUserId, {
    app_metadata: {
      ...(invited.data.user.app_metadata ?? {}),
      role: "agent",
      account_scope: "support_manager",
    },
    user_metadata: {
      ...(invited.data.user.user_metadata ?? {}),
      full_name: fullName,
    },
  });
  if (updated.error) throw updated.error;

  const membership = await admin.from("institution_memberships").insert({
    institution_id: institution.id,
    user_id: createdUserId,
    role: "service_manager",
    service_codes: ALL_SUPPORT_SERVICES,
    status: "active",
  });
  if (membership.error) throw membership.error;

  console.log(JSON.stringify({
    status: "invited",
    authRole: "agent",
    membershipRole: "service_manager",
    serviceCount: ALL_SUPPORT_SERVICES.length,
    password: "chosen_by_invited_user",
    mfa: "required_on_first_sign_in",
  }));
} catch (error) {
  if (createdUserId) {
    const cleanup = await admin.auth.admin.deleteUser(createdUserId);
    if (cleanup.error) {
      throw new Error("Provisioning failed and account rollback was not confirmed");
    }
  }
  throw error;
}
