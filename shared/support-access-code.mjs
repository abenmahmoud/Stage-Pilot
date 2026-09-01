import {
  createHash,
  createHmac,
  timingSafeEqual,
} from "node:crypto";

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{40,60}$/;
const TOKEN_HASH_PATTERN = /^[a-f0-9]{64}$/;
const CODE_PATTERN = /^[0-9]{6}$/;
const CODE_CONTEXT = "lyceegest:support-access-code:v1";

export function supportAccessCodeSecret(value) {
  if (
    typeof value !== "string"
    || Buffer.byteLength(value, "utf8") < 32
    || Buffer.byteLength(value, "utf8") > 1024
    || /[\u0000-\u001F\u007F]/.test(value)
  ) {
    throw new Error("support_access_code_secret_invalid");
  }
  return value;
}

function supportAccessTokenHash(value) {
  if (typeof value !== "string" || !TOKEN_HASH_PATTERN.test(value)) {
    throw new Error("support_access_token_hash_invalid");
  }
  return value;
}

export function supportAccessCodeFromTokenHash({ tokenHash, secret }) {
  const hash = supportAccessTokenHash(tokenHash);
  const key = supportAccessCodeSecret(secret);
  const digest = createHmac("sha256", key)
    .update(`${CODE_CONTEXT}:${hash}`, "utf8")
    .digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const value = digest.readUInt32BE(offset) & 0x7fffffff;
  return String(value % 1_000_000).padStart(6, "0");
}

export function supportAccessCodeFromToken({ token, secret }) {
  if (typeof token !== "string" || !TOKEN_PATTERN.test(token)) {
    throw new Error("support_access_token_invalid");
  }
  return supportAccessCodeFromTokenHash({
    tokenHash: createHash("sha256").update(token).digest("hex"),
    secret,
  });
}

export function supportAccessCodeMatches({ code, tokenHash, secret }) {
  if (typeof code !== "string" || !CODE_PATTERN.test(code)) {
    throw new Error("support_access_code_invalid");
  }
  const expected = supportAccessCodeFromTokenHash({ tokenHash, secret });
  return timingSafeEqual(Buffer.from(code, "ascii"), Buffer.from(expected, "ascii"));
}
