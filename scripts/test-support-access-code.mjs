import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  supportAccessCodeFromToken,
  supportAccessCodeFromTokenHash,
  supportAccessCodeMatches,
  supportAccessCodeSecret,
} from "../shared/support-access-code.mjs";
import { parseSupportAccessCodeInput } from "../shared/support-access-code-payload-policy.ts";

const route = await readFile(new URL("../api/support/access-code.ts", import.meta.url), "utf8");
const session = await readFile(new URL("../api/_shared/support-access-session.ts", import.meta.url), "utf8");
const vercelWorker = await readFile(new URL("../api/cron/support-worker.ts", import.meta.url), "utf8");
const vpsWorker = await readFile(new URL("../workers/support-email-worker.mjs", import.meta.url), "utf8");
const page = await readFile(new URL("../src/pages/prototype/LyceeConnectPrototype.tsx", import.meta.url), "utf8");

const token = "A".repeat(43);
const otherToken = "B".repeat(43);
const secret = "preview-access-code-secret-that-is-at-least-32-bytes";
const otherSecret = "other-preview-secret-that-is-also-at-least-32-bytes";

test("derives a deterministic six-digit code without storing plaintext", () => {
  const code = supportAccessCodeFromToken({ token, secret });
  assert.match(code, /^[0-9]{6}$/);
  assert.equal(supportAccessCodeFromToken({ token, secret }), code);
  assert.notEqual(supportAccessCodeFromToken({ token: otherToken, secret }), code);
  assert.notEqual(supportAccessCodeFromToken({ token, secret: otherSecret }), code);
  const tokenHash = createHash("sha256").update(token).digest("hex");
  assert.equal(supportAccessCodeMatches({
    code,
    tokenHash,
    secret,
  }), true);
  assert.equal(supportAccessCodeFromTokenHash({ tokenHash, secret }), code);
  assert.doesNotMatch(route, /code_hash|access_code_hash|\.set\(\{[\s\S]{0,200}code:\s*input\.code/);
});

test("rejects malformed tokens, hashes, codes and secrets", () => {
  assert.throws(() => supportAccessCodeSecret("short"), /secret_invalid/);
  assert.throws(() => supportAccessCodeSecret(`${secret}\n`), /secret_invalid/);
  assert.throws(() => supportAccessCodeFromToken({ token: "bad", secret }), /token_invalid/);
  assert.throws(
    () => supportAccessCodeFromTokenHash({ tokenHash: "A".repeat(64), secret }),
    /token_hash_invalid/
  );
  assert.throws(
    () => supportAccessCodeMatches({ code: "12345", tokenHash: "a".repeat(64), secret }),
    /code_invalid/
  );
});

test("accepts only the exact public input contract", () => {
  assert.deepEqual(
    parseSupportAccessCodeInput({ publicCode: " bc-2026-000123 ", code: " 123456 " }),
    { publicCode: "BC-2026-000123", code: "123456" }
  );
  for (const value of [
    null,
    [],
    { publicCode: "BC-2026-000123" },
    { publicCode: "BC-2026-000123", code: "123456", extra: true },
    { publicCode: "BC-2026-000123", code: 123456 },
    { publicCode: "BC-2026-00123", code: "123456" },
  ]) {
    assert.throws(() => parseSupportAccessCodeInput(value), /input_invalid/);
  }
});

test("keeps the public route bounded, generic and closed without its server secret", () => {
  assert.match(route, /if \(req\.method !== "POST"\) return methodNotAllowed/);
  assert.match(route, /SUPPORT_ACCESS_CODE_SECRET/);
  assert.match(route, /throw new HttpError\(503, "L’accès par code est momentanément indisponible\."\)/);
  assert.match(route, /enforceMagicTokenNetworkGuard\(req\)/);
  assert.match(route, /requireConfiguredInstitution\(\)/);
  assert.match(route, /bodyParser: \{ sizeLimit: "2kb" \}/);
  assert.match(route, /Le code est incorrect, expiré ou déjà utilisé\./);
  assert.doesNotMatch(route, /demande introuvable|dossier introuvable|email introuvable/i);
});

test("limits candidates and attempts before rotating a contact-only session", () => {
  assert.match(route, /MAX_CODE_ATTEMPTS = 5/);
  assert.match(route, /MAX_CODE_CANDIDATES = 5/);
  assert.match(route, /eq\(supportMagicTokens\.purpose, "support_access"\)/);
  assert.match(route, /gt\(supportMagicTokens\.expiresAt, now\)/);
  assert.match(route, /isNull\(supportMagicTokens\.usedAt\)/);
  assert.match(route, /isNotNull\(supportMagicTokens\.contactId\)/);
  assert.match(route, /lt\(supportMagicTokens\.attemptCount, MAX_CODE_ATTEMPTS\)/);
  assert.match(route, /Array\(MAX_CODE_CANDIDATES - candidates\.length\)/);
  assert.match(route, /\.map\(\(tokenHash\) => supportAccessCodeMatches/);
  assert.match(route, /return \{ ok: false as const \}/);
  assert.match(route, /verificationSource: "email_one_time_code"/);
  assert.match(session, /identityStatus: "contact_verifie"/);
  assert.doesNotMatch(`${route}\n${session}`, /identityStatus: "identite_confirmee"/);
});

test("validates the minimal response before issuing the session cookie", () => {
  const payload = route.indexOf("const payload = { request: { publicCode: result.publicCode } }");
  const validation = route.indexOf("isSupportMagicAccessPayload(payload, result.publicCode)", payload);
  const cookie = route.indexOf("setSupportSessionCookie(res, newSessionToken)", validation);
  const returned = route.indexOf("return payload", cookie);
  assert.ok(payload >= 0 && payload < validation && validation < cookie && cookie < returned);
  assert.doesNotMatch(route.slice(payload, returned), /tokenHash|contactId|newSessionToken[,:]/);
});

test("adds codes only to requester emails when the secret and contact exist", () => {
  for (const worker of [vercelWorker, vpsWorker]) {
    assert.match(worker, /if \(!secret \|\| !job\.contact_id\) return null/);
    assert.match(worker, /supportAccessCodeFromToken/);
    assert.match(worker, /Code (à|a) usage unique/);
    const agentStart = worker.indexOf('job.job_type === "notify_agent_request_created"');
    const replyStart = worker.indexOf('job.job_type === "send_requester_reply"', agentStart);
    assert.ok(agentStart >= 0 && replyStart > agentStart);
    assert.doesNotMatch(worker.slice(agentStart, replyStart), /requesterAccessCode\(/);
  }
});

test("keeps the browser entry closed by default and validates before visible state", () => {
  assert.match(page, /VITE_SUPPORT_ACCESS_CODE_ENABLED === "true"/);
  assert.match(page, /autoComplete="one-time-code"/);
  assert.match(page, /inputMode="numeric"/);
  const submit = page.indexOf("async function openRequestWithCode");
  const validation = page.indexOf("isSupportMagicAccessPayload(payload, publicCode)", submit);
  const state = page.indexOf("setSelectedCode(payload.request.publicCode)", validation);
  assert.ok(submit >= 0 && validation > submit && state > validation);
});
