import assert from "node:assert/strict";
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

async function loadEnvFile(path) {
  const content = await readFile(path, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    if (!match || process.env[match[1]]) continue;
    const rawValue = match[2].trim();
    process.env[match[1]] =
      rawValue.length >= 2 &&
      ((rawValue.startsWith('"') && rawValue.endsWith('"')) ||
        (rawValue.startsWith("'") && rawValue.endsWith("'")))
        ? rawValue.slice(1, -1)
        : rawValue;
  }
}

function projectRefFromUrl(url) {
  return new URL(url).hostname.split(".")[0] ?? "";
}

function decodeBase32(value) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = value.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = "";
  for (const character of clean) {
    const index = alphabet.indexOf(character);
    assert.notEqual(index, -1, "Invalid TOTP secret");
    bits += index.toString(2).padStart(5, "0");
  }
  const bytes = [];
  for (let offset = 0; offset + 8 <= bits.length; offset += 8) {
    bytes.push(Number.parseInt(bits.slice(offset, offset + 8), 2));
  }
  return Buffer.from(bytes);
}

function totp(secret) {
  const counter = BigInt(Math.floor(Date.now() / 30_000));
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(counter);
  const digest = createHmac("sha1", decodeBase32(secret)).update(counterBuffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    (((digest[offset] & 0x7f) << 24) |
      ((digest[offset + 1] & 0xff) << 16) |
      ((digest[offset + 2] & 0xff) << 8) |
      (digest[offset + 3] & 0xff)) >>>
    0;
  return String(binary % 1_000_000).padStart(6, "0");
}

async function waitForStableTotpWindow() {
  const remaining = 30 - Math.floor((Date.now() / 1000) % 30);
  if (remaining > 4) return;
  await new Promise((resolve) => setTimeout(resolve, (remaining + 1) * 1000));
}

await loadEnvFile(process.env.PREVIEW_ENV_FILE ?? ".env.preview.local");

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const expectedRef = process.env.EXPECTED_SUPABASE_REF ?? "";
const productionRef = process.env.PRODUCTION_SUPABASE_REF ?? "";
const testApiUrl = process.env.TEST_API_URL?.replace(/\/$/, "") ?? "";

assert.ok(supabaseUrl && anonKey && serviceRoleKey, "Preview Supabase variables are required");
assert.ok(expectedRef, "EXPECTED_SUPABASE_REF is required");
assert.equal(
  process.env.CONFIRM_PREVIEW_AUTH_TESTS,
  expectedRef,
  "CONFIRM_PREVIEW_AUTH_TESTS must equal the expected preview ref"
);
assert.equal(projectRefFromUrl(supabaseUrl), expectedRef, "Unexpected Supabase target");
assert.notEqual(expectedRef, productionRef, "Preview and production refs must differ");

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const { data: institution, error: institutionError } = await admin
  .from("institutions")
  .select("id")
  .eq("slug", "blaise-cendrars-sevran")
  .single();
if (institutionError) throw institutionError;

const fixtures = [
  {
    key: "superadmin",
    authRole: "superadmin",
    membershipRole: "admin",
    services: [],
    canViewAll: true,
  },
  {
    key: "ddfpt",
    authRole: "agent",
    membershipRole: "agent",
    services: ["ddfpt"],
    canViewAll: false,
  },
  {
    key: "administration",
    authRole: "agent",
    membershipRole: "service_manager",
    services: ["secretariat", "administration", "intendance"],
    canViewAll: false,
  },
  {
    key: "vie_scolaire",
    authRole: "agent",
    membershipRole: "agent",
    services: ["vie_scolaire"],
    canViewAll: false,
  },
];

const createdUserIds = [];
const results = [];

try {
  for (const fixture of fixtures) {
    const suffix = randomUUID();
    const email = `codex-${fixture.key}-${suffix}@example.test`;
    const password = `${randomBytes(24).toString("base64url")}Aa1!`;
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { role: fixture.authRole, fixture: true },
    });
    if (created.error || !created.data.user) {
      throw created.error ?? new Error(`Unable to create ${fixture.key}`);
    }
    createdUserIds.push(created.data.user.id);

    const membership = await admin.from("institution_memberships").insert({
      institution_id: institution.id,
      user_id: created.data.user.id,
      role: fixture.membershipRole,
      service_codes: fixture.services,
      status: "active",
    });
    if (membership.error) throw membership.error;

    const client = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const signIn = await client.auth.signInWithPassword({ email, password });
    if (signIn.error || !signIn.data.session) throw signIn.error;

    const enrollment = await client.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: `Codex preview ${fixture.key}`,
    });
    if (enrollment.error || !enrollment.data.totp?.secret) throw enrollment.error;

    await waitForStableTotpWindow();
    const challenge = await client.auth.mfa.challenge({ factorId: enrollment.data.id });
    if (challenge.error) throw challenge.error;
    const verification = await client.auth.mfa.verify({
      factorId: enrollment.data.id,
      challengeId: challenge.data.id,
      code: totp(enrollment.data.totp.secret),
    });
    if (verification.error) throw verification.error;

    const assurance = await client.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assurance.error) throw assurance.error;
    assert.equal(assurance.data.currentLevel, "aal2", `${fixture.key} did not reach AAL2`);

    const audited = await admin
      .from("institution_memberships")
      .update({ mfa_verified_at: new Date().toISOString() })
      .eq("institution_id", institution.id)
      .eq("user_id", created.data.user.id);
    if (audited.error) throw audited.error;

    const persisted = await admin
      .from("institution_memberships")
      .select("role, service_codes, status, mfa_verified_at")
      .eq("institution_id", institution.id)
      .eq("user_id", created.data.user.id)
      .single();
    if (persisted.error) throw persisted.error;
    assert.equal(persisted.data.role, fixture.membershipRole);
    assert.deepEqual(persisted.data.service_codes, fixture.services);
    assert.equal(persisted.data.status, "active");
    assert.ok(persisted.data.mfa_verified_at, `${fixture.key} MFA audit is missing`);

    if (testApiUrl) {
      const session = await client.auth.getSession();
      const accessToken = session.data.session?.access_token;
      assert.ok(accessToken, `Missing AAL2 token for ${fixture.key}`);
      const response = await fetch(`${testApiUrl}/api/support/agent/requests?pageSize=10`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      assert.equal(response.status, 200, `${fixture.key} API status ${response.status}`);
      const payload = await response.json();
      assert.equal(payload.access.canViewAll, fixture.canViewAll);
      if (!fixture.canViewAll) {
        assert.deepEqual(payload.access.serviceCodes, fixture.services);
      }

      if (fixture.key === "ddfpt") {
        const forbidden = await fetch(
          `${testApiUrl}/api/support/agent/requests?service=vie_scolaire`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        assert.equal(forbidden.status, 403, "DDFPT crossed into school-life scope");
      }
    }

    results.push({ key: fixture.key, mfa: "aal2", api: testApiUrl ? "verified" : "not_requested" });
    await client.auth.signOut();
  }
} finally {
  for (const userId of createdUserIds.reverse()) {
    const deleted = await admin.auth.admin.deleteUser(userId);
    if (deleted.error) {
      console.error("Fixture cleanup failed for one preview account");
      process.exitCode = 1;
    }
  }
}

assert.equal(results.length, fixtures.length);
console.log(JSON.stringify({ target: "isolated_preview", fixtures: results, cleanup: "complete" }));
