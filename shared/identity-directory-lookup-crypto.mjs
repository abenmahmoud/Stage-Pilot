import {
  constants,
  createCipheriv,
  createDecipheriv,
  createPrivateKey,
  createPublicKey,
  privateDecrypt,
  publicEncrypt,
  randomBytes,
} from "node:crypto";

export const IDENTITY_LOOKUP_SCHEMA_VERSION = 1;
export const IDENTITY_LOOKUP_TTL_SECONDS = 300;

function base64Bytes(value, { code, exactBytes, minBytes = 1, maxBytes = 8192 }) {
  if (typeof value !== "string" || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    throw new Error(code);
  }
  const bytes = Buffer.from(value, "base64");
  if (
    bytes.toString("base64") !== value ||
    (exactBytes !== undefined && bytes.length !== exactBytes) ||
    bytes.length < minBytes ||
    bytes.length > maxBytes
  ) {
    throw new Error(code);
  }
  return bytes;
}

function keyVersion(value) {
  if (typeof value !== "string" || !/^v[1-9][0-9]{0,3}$/.test(value)) {
    throw new Error("identity_lookup_key_version_invalid");
  }
  return value;
}

function contextValue(value) {
  if (typeof value !== "string" || value.length < 3 || value.length > 200) {
    throw new Error("identity_lookup_context_invalid");
  }
  return value;
}

function aesKey(value, code = "identity_lookup_key_invalid") {
  if (Buffer.isBuffer(value)) {
    if (value.length !== 32) throw new Error(code);
    return value;
  }
  return base64Bytes(value, { code, exactBytes: 32 });
}

function publicKey(encoded) {
  const key = createPublicKey({
    key: base64Bytes(encoded, {
      code: "identity_lookup_public_key_invalid",
      minBytes: 256,
      maxBytes: 2048,
    }),
    format: "der",
    type: "spki",
  });
  if (key.asymmetricKeyType !== "rsa" || (key.asymmetricKeyDetails?.modulusLength ?? 0) < 2048) {
    throw new Error("identity_lookup_public_key_invalid");
  }
  return key;
}

function privateKey(encoded) {
  const key = createPrivateKey({
    key: base64Bytes(encoded, {
      code: "identity_lookup_private_key_invalid",
      minBytes: 800,
      maxBytes: 8192,
    }),
    format: "der",
    type: "pkcs8",
  });
  if (key.asymmetricKeyType !== "rsa" || (key.asymmetricKeyDetails?.modulusLength ?? 0) < 2048) {
    throw new Error("identity_lookup_private_key_invalid");
  }
  return key;
}

function requestAad({ requestId, institutionId, actorId, keyVersion: version }) {
  return Buffer.from(
    `lyceegest:identity-lookup:request:${IDENTITY_LOOKUP_SCHEMA_VERSION}:${keyVersion(version)}:${contextValue(requestId)}:${contextValue(institutionId)}:${contextValue(actorId)}`,
    "utf8"
  );
}

function responseAad({ requestId, institutionId, actorId }) {
  return Buffer.from(
    `lyceegest:identity-lookup:response:${IDENTITY_LOOKUP_SCHEMA_VERSION}:${contextValue(requestId)}:${contextValue(institutionId)}:${contextValue(actorId)}`,
    "utf8"
  );
}

function receiptAad() {
  return Buffer.from(`lyceegest:identity-lookup:receipt:${IDENTITY_LOOKUP_SCHEMA_VERSION}`, "utf8");
}

function jsonBytes(value, code) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(code);
  const bytes = Buffer.from(JSON.stringify(value), "utf8");
  if (bytes.length < 2 || bytes.length > 4096) throw new Error(code);
  return bytes;
}

function encryptAes(value, key, aad, code) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", aesKey(key, code), iv);
  cipher.setAAD(aad);
  const ciphertext = Buffer.concat([cipher.update(jsonBytes(value, code)), cipher.final()]);
  return {
    schema: IDENTITY_LOOKUP_SCHEMA_VERSION,
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
}

function decryptAes(envelope, key, aad, code) {
  if (envelope?.schema !== IDENTITY_LOOKUP_SCHEMA_VERSION) throw new Error(code);
  const decipher = createDecipheriv(
    "aes-256-gcm",
    aesKey(key, code),
    base64Bytes(envelope.iv, { code, exactBytes: 12 })
  );
  decipher.setAAD(aad);
  decipher.setAuthTag(base64Bytes(envelope.authTag, { code, exactBytes: 16 }));
  const plaintext = Buffer.concat([
    decipher.update(base64Bytes(envelope.ciphertext, { code, maxBytes: 6144 })),
    decipher.final(),
  ]);
  if (plaintext.length > 4096) throw new Error(code);
  const value = JSON.parse(plaintext.toString("utf8"));
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(code);
  return value;
}

export function identityLookupApiConfig(env = process.env) {
  const version = keyVersion(env.IDENTITY_DIRECTORY_LOOKUP_KEY_VERSION);
  const encodedPublicKey = env[`IDENTITY_DIRECTORY_LOOKUP_PUBLIC_KEY_${version.toUpperCase()}`];
  return {
    keyVersion: version,
    publicKey: publicKey(encodedPublicKey),
    receiptKey: aesKey(
      env.IDENTITY_DIRECTORY_LOOKUP_RECEIPT_SECRET,
      "identity_lookup_receipt_key_invalid"
    ),
  };
}

export function identityLookupWorkerConfig(env = process.env) {
  const version = keyVersion(env.IDENTITY_DIRECTORY_LOOKUP_KEY_VERSION);
  const encodedPrivateKey = env[`IDENTITY_DIRECTORY_LOOKUP_PRIVATE_KEY_${version.toUpperCase()}`];
  return { keyVersion: version, privateKey: privateKey(encodedPrivateKey) };
}

export function encryptIdentityLookupRequest({
  value,
  requestId,
  institutionId,
  actorId,
  config,
}) {
  const transportKey = randomBytes(32);
  const encrypted = encryptAes(
    value,
    transportKey,
    requestAad({ requestId, institutionId, actorId, keyVersion: config.keyVersion }),
    "identity_lookup_request_invalid"
  );
  return {
    keyVersion: keyVersion(config.keyVersion),
    wrappedKey: publicEncrypt(
      {
        key: config.publicKey,
        oaepHash: "sha256",
        padding: constants.RSA_PKCS1_OAEP_PADDING,
      },
      transportKey
    ).toString("base64"),
    ...encrypted,
  };
}

export function decryptIdentityLookupRequest({
  envelope,
  requestId,
  institutionId,
  actorId,
  privateKey: decryptionKey,
}) {
  const transportKey = privateDecrypt(
    {
      key: decryptionKey,
      oaepHash: "sha256",
      padding: constants.RSA_PKCS1_OAEP_PADDING,
    },
    base64Bytes(envelope.wrappedKey, {
      code: "identity_lookup_request_invalid",
      minBytes: 256,
      maxBytes: 1024,
    })
  );
  return decryptAes(
    envelope,
    transportKey,
    requestAad({ requestId, institutionId, actorId, keyVersion: envelope.keyVersion }),
    "identity_lookup_request_invalid"
  );
}

export function encryptIdentityLookupResult({ value, responseKey, requestId, institutionId, actorId }) {
  return encryptAes(
    value,
    responseKey,
    responseAad({ requestId, institutionId, actorId }),
    "identity_lookup_result_invalid"
  );
}

export function decryptIdentityLookupResult({ envelope, responseKey, requestId, institutionId, actorId }) {
  return decryptAes(
    envelope,
    responseKey,
    responseAad({ requestId, institutionId, actorId }),
    "identity_lookup_result_invalid"
  );
}

export function sealIdentityLookupReceipt(value, receiptKey) {
  const envelope = encryptAes(
    value,
    receiptKey,
    receiptAad(),
    "identity_lookup_receipt_invalid"
  );
  return [
    `v${IDENTITY_LOOKUP_SCHEMA_VERSION}`,
    Buffer.from(envelope.iv, "base64").toString("base64url"),
    Buffer.from(envelope.authTag, "base64").toString("base64url"),
    Buffer.from(envelope.ciphertext, "base64").toString("base64url"),
  ].join(".");
}

export function openIdentityLookupReceipt(token, receiptKey) {
  if (typeof token !== "string" || token.length < 80 || token.length > 2048) {
    throw new Error("identity_lookup_receipt_invalid");
  }
  const parts = token.split(".");
  if (parts.length !== 4 || parts[0] !== `v${IDENTITY_LOOKUP_SCHEMA_VERSION}`) {
    throw new Error("identity_lookup_receipt_invalid");
  }
  return decryptAes(
    {
      schema: IDENTITY_LOOKUP_SCHEMA_VERSION,
      iv: Buffer.from(parts[1], "base64url").toString("base64"),
      authTag: Buffer.from(parts[2], "base64url").toString("base64"),
      ciphertext: Buffer.from(parts[3], "base64url").toString("base64"),
    },
    receiptKey,
    receiptAad(),
    "identity_lookup_receipt_invalid"
  );
}
