import { createHmac, timingSafeEqual } from "node:crypto";

export const COMMUNICATION_WEBMAIL_FIXTURE_PURPOSE = "lyceegest-webmail-network-fixture";
const MAX_FIXTURE_LIFETIME_MS = 24 * 60 * 60 * 1000;
const RESPONSE_FIELDS = new Set(["v", "purpose", "runId", "challenge", "expiresAt", "proof"]);

function exactResponse(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("webmail_fixture_challenge_invalid");
  }
  const keys = Object.keys(value);
  if (keys.length !== RESPONSE_FIELDS.size || keys.some((key) => !RESPONSE_FIELDS.has(key))) {
    throw new Error("webmail_fixture_challenge_invalid");
  }
  return value;
}

export function createCommunicationWebmailFixtureProof(input) {
  return createHmac("sha256", input.proofSecret)
    .update("lyceegest-webmail-fixture-v1\0")
    .update(input.runId)
    .update("\0")
    .update(input.challenge)
    .update("\0")
    .update(input.expiresAt)
    .digest("base64url");
}

function equalProof(left, right) {
  if (typeof left !== "string" || typeof right !== "string") return false;
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

export function verifyCommunicationWebmailFixtureChallenge(input) {
  const response = exactResponse(input.value);
  if (
    response.v !== 1 ||
    response.purpose !== COMMUNICATION_WEBMAIL_FIXTURE_PURPOSE ||
    response.runId !== input.runId ||
    response.challenge !== input.challenge ||
    typeof response.expiresAt !== "string"
  ) {
    throw new Error("webmail_fixture_challenge_invalid");
  }
  const nowMs = input.now.getTime();
  const expiresAt = Date.parse(response.expiresAt);
  if (
    !Number.isFinite(nowMs) ||
    !Number.isFinite(expiresAt) ||
    new Date(expiresAt).toISOString() !== response.expiresAt ||
    expiresAt <= nowMs ||
    expiresAt > nowMs + MAX_FIXTURE_LIFETIME_MS
  ) {
    throw new Error("webmail_fixture_expiry_invalid");
  }
  const expectedProof = createCommunicationWebmailFixtureProof({
    runId: input.runId,
    challenge: input.challenge,
    expiresAt: response.expiresAt,
    proofSecret: input.proofSecret,
  });
  if (!equalProof(response.proof, expectedProof)) {
    throw new Error("webmail_fixture_proof_invalid");
  }
  return { expiresAt: response.expiresAt };
}

