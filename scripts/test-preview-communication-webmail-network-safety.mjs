import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  assertCommunicationWebmailNetworkPreviewSecrets,
  assertCommunicationWebmailNetworkPreviewTarget,
} from "./communication-webmail-network-preview-target.mjs";
import {
  COMMUNICATION_WEBMAIL_FIXTURE_PURPOSE,
  createCommunicationWebmailFixtureProof,
  verifyCommunicationWebmailFixtureChallenge,
} from "./communication-webmail-network-fixture-proof.mjs";

const host = "lyceegest-webmail-fixture-a1b2c3d4-safe-scol.vercel.app";
const runId = "webmail-network-20260902-abcdef123456";
const endpoint = `https://${host}/api/communications/deliveries`;

function validTarget(overrides = {}) {
  return {
    endpoint,
    expectedHost: host,
    runId,
    confirmation: `${runId}@${host}`,
    previewOnly: true,
    ...overrides,
  };
}

function validSecrets(overrides = {}) {
  return {
    bearerToken: "a".repeat(43),
    deliverySecret: "b".repeat(43),
    receiptSecret: "c".repeat(43),
    proofSecret: "d".repeat(43),
    ...overrides,
  };
}

test("accepts only the separately named Vercel fixture and exact recipe confirmation", () => {
  assert.deepEqual(assertCommunicationWebmailNetworkPreviewTarget(validTarget()), {
    endpoint,
    challengeEndpoint: `https://${host}/api/fixture/challenge`,
    expectedHost: host,
    runId,
  });
  for (const current of [
    validTarget({ previewOnly: false }),
    validTarget({ confirmation: "wrong" }),
    validTarget({ runId: "webmail-network-current" }),
    validTarget({ expectedHost: "gestion.lycee-blaise-cendrars-sevran.fr" }),
    validTarget({ expectedHost: "lyceegest-git-codex-lycee-connect-prototype-safe-scol.vercel.app" }),
    validTarget({ endpoint: `http://${host}/api/communications/deliveries` }),
    validTarget({ endpoint: `https://${host}/api/communications/deliveries?mode=test` }),
    validTarget({ endpoint: `https://user:password@${host}/api/communications/deliveries` }),
    validTarget({ endpoint: `https://${host}/api/other` }),
    validTarget({ endpoint: "https://127.0.0.1/api/communications/deliveries" }),
  ]) {
    assert.throws(() => assertCommunicationWebmailNetworkPreviewTarget(current));
  }
});

test("requires four distinct random-looking ephemeral secrets", () => {
  assert.deepEqual(assertCommunicationWebmailNetworkPreviewSecrets(validSecrets()), validSecrets());
  assert.throws(() => assertCommunicationWebmailNetworkPreviewSecrets(validSecrets({ bearerToken: "short" })));
  assert.throws(() => assertCommunicationWebmailNetworkPreviewSecrets(validSecrets({ proofSecret: "secret".repeat(10) })));
  assert.throws(() => assertCommunicationWebmailNetworkPreviewSecrets(validSecrets({ receiptSecret: "b".repeat(43) })));
  assert.throws(() => assertCommunicationWebmailNetworkPreviewSecrets({ ...validSecrets(), extra: "e".repeat(43) }));
});

test("accepts only a fresh challenge proof bound to the run", () => {
  const now = new Date("2026-09-02T08:00:00.000Z");
  const challenge = "challenge-" + "a".repeat(43);
  const expiresAt = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
  const proofSecret = "d".repeat(43);
  const value = {
    v: 1,
    purpose: COMMUNICATION_WEBMAIL_FIXTURE_PURPOSE,
    runId,
    challenge,
    expiresAt,
    proof: createCommunicationWebmailFixtureProof({ runId, challenge, expiresAt, proofSecret }),
  };
  assert.deepEqual(verifyCommunicationWebmailFixtureChallenge({
    value, runId, challenge, proofSecret, now,
  }), { expiresAt });
  assert.throws(() => verifyCommunicationWebmailFixtureChallenge({
    value: { ...value, challenge: `${challenge}x` }, runId, challenge, proofSecret, now,
  }), /challenge_invalid/);
  assert.throws(() => verifyCommunicationWebmailFixtureChallenge({
    value: { ...value, proof: `${value.proof}x` }, runId, challenge, proofSecret, now,
  }), /proof_invalid/);
  assert.throws(() => verifyCommunicationWebmailFixtureChallenge({
    value: { ...value, extra: true }, runId, challenge, proofSecret, now,
  }), /challenge_invalid/);
  const lateExpiry = new Date(now.getTime() + 25 * 60 * 60 * 1000).toISOString();
  assert.throws(() => verifyCommunicationWebmailFixtureChallenge({
    value: {
      ...value,
      expiresAt: lateExpiry,
      proof: createCommunicationWebmailFixtureProof({ runId, challenge, expiresAt: lateExpiry, proofSecret }),
    },
    runId,
    challenge,
    proofSecret,
    now,
  }), /expiry_invalid/);
});

test("fails before network access when the explicit environment is absent", () => {
  const result = spawnSync(process.execPath, [
    "--import", new URL("./ts-test-resolver.mjs", import.meta.url).href,
    "--experimental-strip-types",
    fileURLToPath(new URL("./test-preview-communication-webmail-network.mjs", import.meta.url)),
    "--preview-only",
  ], {
    encoding: "utf8",
    timeout: 10_000,
    windowsHide: true,
    env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot },
  });
  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, /webmail_fixture_(?:host|target)_invalid/);
});

test("keeps the real network recipe out of the permanent security gate", () => {
  const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.match(packageJson.scripts["recipe:preview-communication-webmail-network"], /--preview-only/);
  assert.match(
    packageJson.scripts["test:preview-security-gate"],
    /test:preview-communication-webmail-network-safety/
  );
  assert.doesNotMatch(
    packageJson.scripts["test:preview-security-gate"],
    /recipe:preview-communication-webmail-network/
  );
});
