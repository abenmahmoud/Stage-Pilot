import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export const IDENTITY_VAULT_SCHEMA_VERSION = 1;

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

function encryptionKey(value) {
  const key = base64Bytes(value, {
    code: "identity_vault_key_invalid",
    exactBytes: 32,
  });
  return key;
}

function keyVersion(value) {
  if (typeof value !== "string" || !/^v[1-9][0-9]{0,3}$/.test(value)) {
    throw new Error("identity_vault_key_version_invalid");
  }
  return value;
}

function payload(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("identity_vault_payload_invalid");
  }
  const normalized = {};
  for (const field of ["firstName", "lastName", "academicEmail", "personalEmail", "phone"]) {
    const entry = value[field];
    if (typeof entry !== "string" || entry.length > 500) {
      throw new Error("identity_vault_payload_invalid");
    }
    normalized[field] = entry;
  }
  return normalized;
}

function aad({ institutionId, importId, personRef, version }) {
  for (const entry of [institutionId, importId, personRef]) {
    if (typeof entry !== "string" || entry.length < 3 || entry.length > 200) {
      throw new Error("identity_vault_context_invalid");
    }
  }
  return Buffer.from(
    `lyceegest:identity-vault:${IDENTITY_VAULT_SCHEMA_VERSION}:${version}:${institutionId}:${importId}:${personRef}`,
    "utf8"
  );
}

export function identityVaultConfig(env = process.env) {
  const version = keyVersion(env.IDENTITY_DIRECTORY_ENCRYPTION_KEY_VERSION);
  return { version, key: identityVaultKeyForVersion(version, env) };
}

export function identityVaultKeyForVersion(versionValue, env = process.env) {
  const version = keyVersion(versionValue);
  const encodedKey = env[`IDENTITY_DIRECTORY_ENCRYPTION_KEY_${version.toUpperCase()}`];
  return encryptionKey(encodedKey);
}

export function encryptIdentityVaultPayload({
  value,
  institutionId,
  importId,
  personRef,
  config,
}) {
  const version = keyVersion(config?.version);
  const key = Buffer.isBuffer(config?.key)
    ? config.key
    : encryptionKey(config?.key);
  if (key.length !== 32) throw new Error("identity_vault_key_invalid");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(aad({ institutionId, importId, personRef, version }));
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(payload(value)), "utf8"),
    cipher.final(),
  ]);
  return {
    keyVersion: version,
    payloadSchema: IDENTITY_VAULT_SCHEMA_VERSION,
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
}

export function decryptIdentityVaultPayload({
  envelope,
  institutionId,
  importId,
  personRef,
  key,
}) {
  if (envelope?.payloadSchema !== IDENTITY_VAULT_SCHEMA_VERSION) {
    throw new Error("identity_vault_schema_unsupported");
  }
  const version = keyVersion(envelope.keyVersion);
  const decodedKey = Buffer.isBuffer(key) ? key : encryptionKey(key);
  if (decodedKey.length !== 32) throw new Error("identity_vault_key_invalid");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    decodedKey,
    base64Bytes(envelope.iv, {
      code: "identity_vault_envelope_invalid",
      exactBytes: 12,
    })
  );
  decipher.setAAD(aad({ institutionId, importId, personRef, version }));
  decipher.setAuthTag(base64Bytes(envelope.authTag, {
    code: "identity_vault_envelope_invalid",
    exactBytes: 16,
  }));
  const plaintext = Buffer.concat([
    decipher.update(base64Bytes(envelope.ciphertext, {
      code: "identity_vault_envelope_invalid",
      maxBytes: 6144,
    })),
    decipher.final(),
  ]).toString("utf8");
  return payload(JSON.parse(plaintext));
}

export function rotateIdentityVaultEnvelope({
  envelope,
  institutionId,
  importId,
  personRef,
  targetConfig,
  env = process.env,
}) {
  const sourceVersion = keyVersion(envelope?.keyVersion);
  const targetVersion = keyVersion(targetConfig?.version);
  if (sourceVersion === targetVersion) {
    throw new Error("identity_vault_rotation_not_required");
  }
  if (
    Number.parseInt(targetVersion.slice(1), 10) <
    Number.parseInt(sourceVersion.slice(1), 10)
  ) {
    throw new Error("identity_vault_rotation_target_invalid");
  }

  const value = decryptIdentityVaultPayload({
    envelope,
    institutionId,
    importId,
    personRef,
    key: identityVaultKeyForVersion(sourceVersion, env),
  });
  return encryptIdentityVaultPayload({
    value,
    institutionId,
    importId,
    personRef,
    config: targetConfig,
  });
}
