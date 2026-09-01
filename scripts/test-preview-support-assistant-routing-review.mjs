import assert from "node:assert/strict";
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { assertRoutingReviewPreviewTarget } from "./routing-review-preview-target.mjs";
import { assertRoutingReviewVercelAvailable, routingReviewAuthorizationInput, runRoutingReviewVercel } from "./routing-review-vercel-cli.mjs";

async function loadEnvFile(path) {
  let content;
  try {
    content = await readFile(path, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT" && !process.env.PREVIEW_ENV_FILE) return;
    throw error;
  }
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
    "@-",
  ];
  if (body !== undefined) {
    args.push(
      "--header",
      "Content-Type: application/json",
      "--data-raw",
      JSON.stringify(body)
    );
  }
  const result = runRoutingReviewVercel(args, { input: routingReviewAuthorizationInput(accessToken) });
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
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const expectedRef = process.env.EXPECTED_SUPABASE_REF ?? "";
const productionRef = process.env.PRODUCTION_SUPABASE_REF ?? "";
const deploymentHost = process.env.PREVIEW_ROUTING_REVIEW_DEPLOYMENT ?? "";

assertRoutingReviewPreviewTarget({ supabaseUrl, expectedRef, productionRef, deploymentHost });
assert.ok(supabaseUrl && anonKey && serviceRoleKey, "Preview Supabase variables are required");
assert.doesNotMatch(
  serviceRoleKey,
  /^\[(?:SENSITIVE|ENCRYPTED)\]$/i,
  "Preview service role must be injected locally; Vercel redacted secret placeholders are refused"
);
assert.equal(
  process.env.CONFIRM_PREVIEW_ROUTING_REVIEW_RECIPE,
  expectedRef,
  "CONFIRM_PREVIEW_ROUTING_REVIEW_RECIPE must equal the preview ref"
);
assert.equal(
  process.env.SUPPORT_ASSISTANT_ROUTING_REVIEW_ENABLED,
  "true",
  "Routing review must be enabled only on the selected preview"
);
assertRoutingReviewVercelAvailable();
const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const { data: institution, error: institutionError } = await admin
  .from("institutions")
  .select("id")
  .eq("slug", "blaise-cendrars-sevran")
  .in("status", ["pilot", "active"])
  .single();
if (institutionError) throw institutionError;

const runId = randomUUID();
const email = `codex-routing-review-${runId}@example.test`;
const password = `${randomBytes(24).toString("base64url")}Aa1!`;
const createdRequestIds = [];
let createdUserId = null;
let accessToken = null;

async function deleteRequestFixtures() {
  if (createdRequestIds.length === 0) return;
  const deleted = await admin
    .from("support_requests")
    .delete()
    .eq("institution_id", institution.id)
    .in("id", createdRequestIds);
  if (deleted.error) throw deleted.error;
  const residue = await admin
    .from("support_assistant_routing_reviews")
    .select("id", { count: "exact", head: true })
    .eq("institution_id", institution.id)
    .in("request_id", createdRequestIds);
  if (residue.error) throw residue.error;
  assert.equal(residue.count, 0, "Routing review fixtures were not deleted");
  createdRequestIds.length = 0;
}

try {
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role: "superadmin", fixture: true },
  });
  if (created.error || !created.data.user) throw created.error;
  createdUserId = created.data.user.id;

  const membership = await admin.from("institution_memberships").insert({
    institution_id: institution.id,
    user_id: createdUserId,
    role: "admin",
    service_codes: [],
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
    friendlyName: "Codex routing review preview",
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
  assert.equal(assurance.data.currentLevel, "aal2", "Fixture account did not reach AAL2");
  accessToken = (await client.auth.getSession()).data.session?.access_token ?? null;
  assert.ok(accessToken, "Missing AAL2 access token");

  const mfaAudit = await admin
    .from("institution_memberships")
    .update({ mfa_verified_at: new Date().toISOString() })
    .eq("institution_id", institution.id)
    .eq("user_id", createdUserId);
  if (mfaAudit.error) throw mfaAudit.error;

  const baseline = vercelApi({
    deploymentHost,
    path: "/api/support/agent/metrics?days=7",
    accessToken,
  }).summary;

  const insertedRequests = await admin
    .from("support_requests")
    .insert([
      {
        institution_id: institution.id,
        idempotency_key_hash: randomBytes(32).toString("hex"),
        requester_type: "eleve",
        requester_first_name: "Test",
        requester_last_name: "Confirmation",
        beneficiary_type: "self",
        category: "ent",
        subject: "Classement fictif a confirmer",
        description: "Recette technique sans donnee reelle",
        preferred_channel: "web",
        assigned_team: "referent_numerique",
        subject_context: { fixtureRun: runId, identityStatus: "non_verifiee" },
      },
      {
        institution_id: institution.id,
        idempotency_key_hash: randomBytes(32).toString("hex"),
        requester_type: "parent",
        requester_first_name: "Test",
        requester_last_name: "Correction",
        beneficiary_type: "self",
        category: "ent",
        subject: "Classement fictif a corriger",
        description: "Recette technique sans donnee reelle",
        preferred_channel: "web",
        assigned_team: "referent_numerique",
        subject_context: { fixtureRun: runId, identityStatus: "non_verifiee" },
      },
    ])
    .select("id, public_code");
  if (insertedRequests.error || insertedRequests.data.length !== 2) {
    throw insertedRequests.error ?? new Error("Unable to create request fixtures");
  }
  createdRequestIds.push(...insertedRequests.data.map((request) => request.id));

  const insertedReviews = await admin.from("support_assistant_routing_reviews").insert(
    insertedRequests.data.map((request) => ({
      institution_id: institution.id,
      request_id: request.id,
      receipt_hash: randomBytes(32).toString("hex"),
      used_ai: false,
      model: null,
      initial_category: "ent",
      initial_service: "referent_numerique",
    }))
  );
  if (insertedReviews.error) throw insertedReviews.error;

  const firstDetail = vercelApi({
    deploymentHost,
    path: `/api/support/agent/requests/${insertedRequests.data[0].public_code}`,
    accessToken,
  });
  assert.equal(firstDetail.routingReview?.status, "pending");
  vercelApi({
    deploymentHost,
    path: `/api/support/agent/requests/${insertedRequests.data[0].public_code}`,
    method: "PATCH",
    accessToken,
    body: {
      expectedUpdatedAt: firstDetail.request.updatedAt,
      routingDecision: "confirmed",
    },
  });

  const secondDetail = vercelApi({
    deploymentHost,
    path: `/api/support/agent/requests/${insertedRequests.data[1].public_code}`,
    accessToken,
  });
  assert.equal(secondDetail.routingReview?.status, "pending");
  vercelApi({
    deploymentHost,
    path: `/api/support/agent/requests/${insertedRequests.data[1].public_code}`,
    method: "PATCH",
    accessToken,
    body: {
      expectedUpdatedAt: secondDetail.request.updatedAt,
      assignedTeam: "secretariat",
    },
  });

  const [confirmedDetail, correctedDetail] = [
    vercelApi({
      deploymentHost,
      path: `/api/support/agent/requests/${insertedRequests.data[0].public_code}`,
      accessToken,
    }),
    vercelApi({
      deploymentHost,
      path: `/api/support/agent/requests/${insertedRequests.data[1].public_code}`,
      accessToken,
    }),
  ];
  assert.equal(confirmedDetail.routingReview?.status, "confirmed");
  assert.equal(correctedDetail.routingReview?.status, "corrected");
  assert.equal(correctedDetail.request.assignedTeam, "secretariat");

  const afterDecision = vercelApi({
    deploymentHost,
    path: "/api/support/agent/metrics?days=7",
    accessToken,
  }).summary;
  assert.equal(afterDecision.routingReviewTotal, baseline.routingReviewTotal + 2);
  assert.equal(afterDecision.routingReviewPending, baseline.routingReviewPending);
  assert.equal(afterDecision.routingReviewConfirmed, baseline.routingReviewConfirmed + 1);
  assert.equal(afterDecision.routingReviewCorrected, baseline.routingReviewCorrected + 1);

  await deleteRequestFixtures();
  const afterCleanup = vercelApi({
    deploymentHost,
    path: "/api/support/agent/metrics?days=7",
    accessToken,
  }).summary;
  assert.equal(afterCleanup.routingReviewTotal, baseline.routingReviewTotal);
  assert.equal(afterCleanup.routingReviewConfirmed, baseline.routingReviewConfirmed);
  assert.equal(afterCleanup.routingReviewCorrected, baseline.routingReviewCorrected);

} finally {
  try {
    await deleteRequestFixtures();
  } catch {
    console.error("Fixture request cleanup failed");
    process.exitCode = 1;
  }
  if (createdUserId) {
    try {
      const membershipCleanup = await admin
        .from("institution_memberships")
        .delete()
        .eq("institution_id", institution.id)
        .eq("user_id", createdUserId);
      if (membershipCleanup.error) throw membershipCleanup.error;
    } catch {
      console.error("Fixture membership cleanup failed");
      process.exitCode = 1;
    }
    try {
      const userCleanup = await admin.auth.admin.deleteUser(createdUserId);
      if (userCleanup.error) throw userCleanup.error;
    } catch {
      console.error("Fixture account cleanup failed");
      process.exitCode = 1;
    }
  }
}

if (!process.exitCode) {
  console.log(JSON.stringify({
    target: "isolated_preview",
    confirmed: 1,
    corrected: 1,
    metrics: "verified",
    cleanup: "complete",
  }));
}
