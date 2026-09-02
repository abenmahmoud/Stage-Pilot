import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  IDENTITY_DEVICE_ABSOLUTE_SESSION_SECONDS,
  IDENTITY_DEVICE_MAX_ATTEMPTS,
  IDENTITY_DEVICE_PERSISTENT_IDLE_SECONDS,
  identityDeviceFeatureEnabled,
  identityDeviceReadyPayload,
  parseIdentityDeviceRequestInput,
  parseIdentityDeviceVerifyInput,
} from "../shared/identity-device-access.ts";

assert.deepEqual(
  parseIdentityDeviceRequestInput({
    email: "  ELEVE@EXAMPLE.TEST ",
    deviceId: "device-test-1234567890",
    rememberDevice: true,
  }),
  {
    email: "eleve@example.test",
    deviceId: "device-test-1234567890",
    rememberDevice: true,
  }
);
assert.throws(
  () =>
    parseIdentityDeviceRequestInput({
      email: "eleve@example.test",
      deviceId: "device-test-1234567890",
      rememberDevice: true,
      personType: "student",
    }),
  /invalid/
);
assert.throws(
  () =>
    parseIdentityDeviceRequestInput({
      email: "not-an-email",
      deviceId: "device-test-1234567890",
      rememberDevice: false,
    }),
  /email/
);
assert.deepEqual(parseIdentityDeviceVerifyInput({ code: "012345" }), { code: "012345" });
assert.throws(() => parseIdentityDeviceVerifyInput({ code: "12345" }), /code/);
assert.throws(() => parseIdentityDeviceVerifyInput({ code: "123456", email: "hidden" }), /invalid/);
assert.equal(identityDeviceFeatureEnabled({}), false);
assert.equal(identityDeviceFeatureEnabled({ IDENTITY_DEVICE_ACCESS_ENABLED: "true" }), true);
assert.equal(IDENTITY_DEVICE_MAX_ATTEMPTS, 5);
assert.equal(IDENTITY_DEVICE_PERSISTENT_IDLE_SECONDS, 7 * 24 * 60 * 60);
assert.equal(IDENTITY_DEVICE_ABSOLUTE_SESSION_SECONDS, 30 * 24 * 60 * 60);

const ready = identityDeviceReadyPayload(new Date("2026-09-02T12:00:00.000Z"));
assert.equal(ready.status, "ready");
assert.doesNotMatch(JSON.stringify(ready), /student|guardian|staff|personRef|known|unknown/i);

process.env.DATABASE_URL ||= "postgres://test:test@127.0.0.1:5432/test";
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.test";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
process.env.SUPPORT_HASH_SECRET = "test-support-hash-secret-that-is-long-enough";
process.env.IDENTITY_DEVICE_OTP_SECRET = "test-identity-otp-secret-that-is-long-enough";
const helper = await import("../api/_shared/identity-device-access.ts");
const challengeId = "11111111-1111-4111-8111-111111111111";
const code = helper.identityDeviceCode(challengeId);
assert.match(code, /^\d{6}$/);
assert.equal(helper.identityDeviceCode(challengeId), code);
const hash = helper.identityDeviceCodeHash(challengeId, code);
assert.match(hash, /^[a-f0-9]{64}$/);
assert.equal(helper.identityDeviceCodeMatches(challengeId, code, hash), true);
assert.equal(helper.identityDeviceCodeMatches(challengeId, "999999", hash), code === "999999");
assert.notEqual(hash, code);
const times = helper.identityDeviceSessionTimes(new Date("2026-09-02T12:00:00.000Z"), true);
assert.equal(times.expiresAt.toISOString(), "2026-09-09T12:00:00.000Z");
assert.equal(times.absoluteExpiresAt.toISOString(), "2026-10-02T12:00:00.000Z");

const migration = await readFile(
  new URL("../supabase/migrations/20260902210908_create_identity_device_access.sql", import.meta.url),
  "utf8"
);
const requestRoute = await readFile(new URL("../api/identity/device/request.ts", import.meta.url), "utf8");
const statusRoute = await readFile(new URL("../api/identity/device/status.ts", import.meta.url), "utf8");
const verifyRoute = await readFile(new URL("../api/identity/device/verify.ts", import.meta.url), "utf8");
const sessionRoute = await readFile(new URL("../api/identity/device/session.ts", import.meta.url), "utf8");
const serverHelper = await readFile(new URL("../api/_shared/identity-device-access.ts", import.meta.url), "utf8");
const worker = await readFile(new URL("../workers/identity-directory-lookup-worker.mjs", import.meta.url), "utf8");
const ratePolicy = await readFile(new URL("../shared/support-rate-limit-policy.ts", import.meta.url), "utf8");

assert.match(migration, /force row level security/g);
assert.match(migration, /revoke all on table public\.identity_device_challenges from public, anon, authenticated/);
assert.match(migration, /revoke all on table public\.identity_device_sessions from public, anon, authenticated/);
assert.match(migration, /actor_id is null and public_actor_id is not null/);
assert.match(migration, /search_type in \([^)]*'email'/s);
assert.match(migration, /attempt_count between 0 and 5/);
assert.match(migration, /absolute_expires_at/);
assert.doesNotMatch(migration, /\bemail\b text|\bcode\b text|first_name|last_name/);
assert.match(requestRoute, /encryptIdentityLookupRequest/);
assert.match(requestRoute, /contactHash: personalHash|contactHash/);
assert.doesNotMatch(requestRoute, /email:\s*input\.email[^,]*,[\s\S]{0,80}insert\(identityDeviceChallenges\)/);
assert.match(statusRoute, /identityDeviceReadyPayload/);
assert.match(statusRoute, /idempotencyKey: `identity-device-/);
assert.match(statusRoute, /req\.method !== "POST"/);
assert.doesNotMatch(statusRoute, /req\.method !== "GET"/);
assert.match(verifyRoute, /for update/);
assert.match(verifyRoute, /IDENTITY_DEVICE_MAX_ATTEMPTS/);
assert.match(verifyRoute, /status: "verified"/);
assert.match(sessionRoute, /revokedAt: new Date\(\)/);
assert.match(serverHelper, /HttpOnly; SameSite=Lax/);
assert.match(serverHelper, /process\.env\.NODE_ENV === "production" \? "; Secure"/);
assert.doesNotMatch(serverHelper, /personRef=.*Set-Cookie|email=.*Set-Cookie/);
assert.match(worker, /\["academic_email", "personal_email", "email", "phone", "person_ref"\]/);
assert.match(worker, /academic_email_hash[\s\S]+personal_email_hash/);
assert.match(worker, /publicSelfService/);
assert.match(ratePolicy, /identity_otp_device_burst/);
assert.match(ratePolicy, /identity_otp_contact_daily/);

console.log("identity device access: all checks passed");
