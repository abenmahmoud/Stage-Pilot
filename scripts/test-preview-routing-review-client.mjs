import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { assertRoutingReviewPreviewTarget } from "./routing-review-preview-target.mjs";
import { assertRoutingReviewVercelAvailable, runRoutingReviewVercel } from "./routing-review-vercel-cli.mjs";

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

function vercelApi({ deploymentHost, path, method = "GET", accessToken, body }) {
  const args = [
    "curl",
    path,
    "--deployment",
    deploymentHost,
    "--",
    "--silent",
    "--show-error",
    "--fail-with-body",
    "--connect-timeout", "10",
    "--max-time", "25",
    "--request",
    method,
    "--header",
    "Accept: application/json",
    "--header",
    `Authorization: Bearer ${accessToken}`,
  ];
  if (body !== undefined) {
    args.push("--header", "Content-Type: application/json", "--data-raw", JSON.stringify(body));
  }
  const result = runRoutingReviewVercel(args);
  if (result.status !== 0) {
    throw new Error(`preview_api_failed:${method}:${path}:${result.status ?? "unknown"}`);
  }
  try {
    return JSON.parse(result.stdout.trim());
  } catch {
    throw new Error(`preview_api_invalid_json:${method}:${path}`);
  }
}

await loadEnvFile(process.env.PREVIEW_ENV_FILE ?? ".env.preview.local");

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? "";
const expectedRef = process.env.EXPECTED_SUPABASE_REF ?? "";
const productionRef = process.env.PRODUCTION_SUPABASE_REF ?? "";
const deploymentHost = process.env.PREVIEW_ROUTING_REVIEW_DEPLOYMENT ?? "";
const email = process.env.PREVIEW_ROUTING_REVIEW_FIXTURE_EMAIL ?? "";
const password = process.env.PREVIEW_ROUTING_REVIEW_FIXTURE_PASSWORD ?? "";
const confirmCode = process.env.PREVIEW_ROUTING_REVIEW_CONFIRM_CODE ?? "";
const correctCode = process.env.PREVIEW_ROUTING_REVIEW_CORRECT_CODE ?? "";

assertRoutingReviewPreviewTarget({ supabaseUrl, expectedRef, productionRef, deploymentHost });
assert.ok(supabaseUrl && anonKey, "Preview public Supabase variables are required");
assert.equal(process.env.CONFIRM_PREVIEW_ROUTING_REVIEW_RECIPE, expectedRef);
assert.equal(process.env.SUPPORT_ASSISTANT_ROUTING_REVIEW_ENABLED, "true");
assert.match(email, /^codex-routing-review-[a-z0-9-]+@example\.test$/);
assert.ok(password.length >= 20, "Fixture password is required");
assert.match(confirmCode, /^BC-2099-\d{6}$/);
assert.match(correctCode, /^BC-2099-\d{6}$/);
assert.notEqual(confirmCode, correctCode);

assertRoutingReviewVercelAvailable();
const client = createClient(supabaseUrl, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

try {
  const signIn = await client.auth.signInWithPassword({ email, password });
  if (signIn.error || !signIn.data.session) throw signIn.error;
  const enrollment = await client.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: "Codex routing review SQL fixture",
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
  assert.equal(assurance.data.currentLevel, "aal2");
  const accessToken = (await client.auth.getSession()).data.session?.access_token;
  assert.ok(accessToken, "Missing AAL2 access token");

  const baseline = vercelApi({
    deploymentHost,
    path: "/api/support/agent/metrics?days=7",
    accessToken,
  }).summary;
  const confirmDetail = vercelApi({
    deploymentHost,
    path: `/api/support/agent/requests/${confirmCode}`,
    accessToken,
  });
  const correctDetail = vercelApi({
    deploymentHost,
    path: `/api/support/agent/requests/${correctCode}`,
    accessToken,
  });
  assert.equal(confirmDetail.routingReview?.status, "pending");
  assert.equal(correctDetail.routingReview?.status, "pending");

  vercelApi({
    deploymentHost,
    path: `/api/support/agent/requests/${confirmCode}`,
    method: "PATCH",
    accessToken,
    body: {
      expectedUpdatedAt: confirmDetail.request.updatedAt,
      routingDecision: "confirmed",
    },
  });
  vercelApi({
    deploymentHost,
    path: `/api/support/agent/requests/${correctCode}`,
    method: "PATCH",
    accessToken,
    body: {
      expectedUpdatedAt: correctDetail.request.updatedAt,
      assignedTeam: "secretariat",
    },
  });

  const confirmed = vercelApi({
    deploymentHost,
    path: `/api/support/agent/requests/${confirmCode}`,
    accessToken,
  });
  const corrected = vercelApi({
    deploymentHost,
    path: `/api/support/agent/requests/${correctCode}`,
    accessToken,
  });
  assert.equal(confirmed.routingReview?.status, "confirmed");
  assert.equal(corrected.routingReview?.status, "corrected");
  assert.equal(corrected.request.assignedTeam, "secretariat");

  const after = vercelApi({
    deploymentHost,
    path: "/api/support/agent/metrics?days=7",
    accessToken,
  }).summary;
  assert.equal(after.routingReviewTotal, baseline.routingReviewTotal);
  assert.equal(after.routingReviewPending, baseline.routingReviewPending - 2);
  assert.equal(after.routingReviewConfirmed, baseline.routingReviewConfirmed + 1);
  assert.equal(after.routingReviewCorrected, baseline.routingReviewCorrected + 1);

  console.log(JSON.stringify({
    target: "isolated_preview",
    mfa: "aal2",
    confirmed: 1,
    corrected: 1,
    metrics: "verified",
    cleanup: "external_required",
  }));
} finally {
  await client.auth.signOut();
}
