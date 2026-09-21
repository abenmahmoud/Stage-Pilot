import {
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from "node:crypto";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CODE_PATTERN = /^\d{8}$/;
const HASH_PATTERN = /^[a-f0-9]{64}$/;
const CODE_CONTEXT = "lyceegest:equipment-external-code:v1";
const SESSION_CONTEXT = "lyceegest:equipment-external-session:v1";

export function equipmentExternalSecret(value) {
  if (
    typeof value !== "string"
    || Buffer.byteLength(value, "utf8") < 32
    || Buffer.byteLength(value, "utf8") > 1024
    || /[\u0000-\u001F\u007F]/.test(value)
  ) {
    throw new Error("equipment_external_secret_invalid");
  }
  return value;
}

function grantId(value) {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    throw new Error("equipment_external_grant_invalid");
  }
  return value.toLowerCase();
}

function accessCode(value) {
  if (typeof value !== "string" || !CODE_PATTERN.test(value)) {
    throw new Error("equipment_external_code_invalid");
  }
  return value;
}

export function generateEquipmentExternalCode() {
  return String(randomInt(0, 100_000_000)).padStart(8, "0");
}

export function equipmentExternalCodeHash({ grantId: rawGrantId, code, secret }) {
  const normalizedGrantId = grantId(rawGrantId);
  const normalizedCode = accessCode(code);
  const key = equipmentExternalSecret(secret);
  return createHmac("sha256", key)
    .update(`${CODE_CONTEXT}:${normalizedGrantId}:${normalizedCode}`, "utf8")
    .digest("hex");
}

export function equipmentExternalCodeMatches({ grantId: rawGrantId, code, codeHash, secret }) {
  if (typeof codeHash !== "string" || !HASH_PATTERN.test(codeHash)) return false;
  let actual;
  try {
    actual = equipmentExternalCodeHash({ grantId: rawGrantId, code, secret });
  } catch {
    actual = "0".repeat(64);
  }
  return timingSafeEqual(Buffer.from(actual, "ascii"), Buffer.from(codeHash, "ascii"));
}

function signSessionPayload(payload, secret) {
  return createHmac("sha256", equipmentExternalSecret(secret))
    .update(`${SESSION_CONTEXT}:${payload}`, "utf8")
    .digest("base64url");
}

export function createEquipmentExternalSession({ grantId: rawGrantId, expiresAt, secret, nonce }) {
  const normalizedGrantId = grantId(rawGrantId);
  const expiry = expiresAt instanceof Date ? expiresAt.getTime() : Number(expiresAt);
  if (!Number.isSafeInteger(expiry) || expiry <= Date.now() || expiry > Date.now() + 24 * 60 * 60 * 1000) {
    throw new Error("equipment_external_session_expiry_invalid");
  }
  const normalizedNonce = typeof nonce === "string" && /^[A-Za-z0-9_-]{22,60}$/.test(nonce)
    ? nonce
    : randomBytes(18).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ v: 1, grantId: normalizedGrantId, exp: expiry, nonce: normalizedNonce }), "utf8").toString("base64url");
  return `${payload}.${signSessionPayload(payload, secret)}`;
}

export function verifyEquipmentExternalSession({ token, secret, now = Date.now() }) {
  if (typeof token !== "string" || token.length < 80 || token.length > 600) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, signature] = parts;
  const expected = signSessionPayload(payload, secret);
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (
      parsed?.v !== 1
      || typeof parsed.grantId !== "string"
      || !UUID_PATTERN.test(parsed.grantId)
      || !Number.isSafeInteger(parsed.exp)
      || parsed.exp <= now
      || typeof parsed.nonce !== "string"
      || !/^[A-Za-z0-9_-]{22,60}$/.test(parsed.nonce)
    ) return null;
    return { grantId: parsed.grantId.toLowerCase(), expiresAt: new Date(parsed.exp) };
  } catch {
    return null;
  }
}
