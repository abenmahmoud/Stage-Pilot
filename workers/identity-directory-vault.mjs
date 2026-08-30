import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export const IDENTITY_VAULT_SCHEMA_VERSION = 1;
export const IDENTITY_VAULT_ROTATION_MAX_ROWS = 250;

function exactKeys(value, keys, code) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(code);
  }
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new Error(code);
  }
  return value;
}

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

function rotationRowId(value) {
  if (
    (typeof value === "number" && Number.isSafeInteger(value) && value > 0) ||
    (typeof value === "string" && /^[1-9][0-9]{0,18}$/.test(value))
  ) {
    return value;
  }
  throw new Error("identity_vault_rotation_row_invalid");
}

export function rotateIdentityVaultBatch({
  rows,
  targetConfig,
  env = process.env,
  batchLimit = IDENTITY_VAULT_ROTATION_MAX_ROWS,
}) {
  if (
    !Number.isInteger(batchLimit) ||
    batchLimit < 1 ||
    batchLimit > IDENTITY_VAULT_ROTATION_MAX_ROWS
  ) {
    throw new Error("identity_vault_rotation_batch_limit_invalid");
  }
  if (!Array.isArray(rows) || rows.length < 1 || rows.length > batchLimit) {
    throw new Error("identity_vault_rotation_batch_size_invalid");
  }

  const targetVersion = keyVersion(targetConfig?.version);
  const normalizedTargetConfig = {
    version: targetVersion,
    key: Buffer.isBuffer(targetConfig?.key)
      ? targetConfig.key
      : encryptionKey(targetConfig?.key),
  };
  if (normalizedTargetConfig.key.length !== 32) {
    throw new Error("identity_vault_key_invalid");
  }

  const rowIds = new Set();
  const normalizedRows = rows.map((input) => {
    const row = exactKeys(input, [
      "id",
      "institutionId",
      "importId",
      "personRef",
      "envelope",
    ], "identity_vault_rotation_row_invalid");
    const id = rotationRowId(row.id);
    const idKey = String(id);
    if (rowIds.has(idKey)) throw new Error("identity_vault_rotation_row_duplicate");
    rowIds.add(idKey);
    const envelope = exactKeys(row.envelope, [
      "keyVersion",
      "payloadSchema",
      "iv",
      "authTag",
      "ciphertext",
    ], "identity_vault_rotation_envelope_invalid");
    aad({
      institutionId: row.institutionId,
      importId: row.importId,
      personRef: row.personRef,
      version: keyVersion(envelope.keyVersion),
    });
    if (envelope.payloadSchema !== IDENTITY_VAULT_SCHEMA_VERSION) {
      throw new Error("identity_vault_schema_unsupported");
    }
    return {
      id,
      institutionId: row.institutionId,
      importId: row.importId,
      personRef: row.personRef,
      envelope,
    };
  });

  const rotatedRows = normalizedRows.map((row) => {
    const envelope = rotateIdentityVaultEnvelope({
      envelope: row.envelope,
      institutionId: row.institutionId,
      importId: row.importId,
      personRef: row.personRef,
      targetConfig: normalizedTargetConfig,
      env,
    });
    return {
      id: row.id,
      institutionId: row.institutionId,
      importId: row.importId,
      personRef: row.personRef,
      envelope,
    };
  });

  const sourceVersions = {};
  for (const row of normalizedRows) {
    sourceVersions[row.envelope.keyVersion] = (sourceVersions[row.envelope.keyVersion] ?? 0) + 1;
  }
  return {
    targetVersion,
    rotatedCount: rotatedRows.length,
    sourceVersions: Object.fromEntries(Object.entries(sourceVersions).sort(([left], [right]) => left.localeCompare(right))),
    rows: rotatedRows,
  };
}

export function verifyIdentityVaultKeyRetirement({
  rows,
  institutionId,
  importId,
  targetConfig,
  retiredVersions,
  env = process.env,
  batchLimit = IDENTITY_VAULT_ROTATION_MAX_ROWS,
}) {
  if (
    !Number.isInteger(batchLimit) ||
    batchLimit < 1 ||
    batchLimit > IDENTITY_VAULT_ROTATION_MAX_ROWS
  ) {
    throw new Error("identity_vault_retirement_batch_limit_invalid");
  }
  if (!Array.isArray(rows) || rows.length < 1 || rows.length > batchLimit) {
    throw new Error("identity_vault_retirement_batch_size_invalid");
  }

  const targetVersion = keyVersion(targetConfig?.version);
  aad({ institutionId, importId, personRef: "retirement-scope", version: targetVersion });
  const targetKey = Buffer.isBuffer(targetConfig?.key)
    ? targetConfig.key
    : encryptionKey(targetConfig?.key);
  if (targetKey.length !== 32) throw new Error("identity_vault_key_invalid");

  if (!Array.isArray(retiredVersions) || retiredVersions.length < 1 || retiredVersions.length > 20) {
    throw new Error("identity_vault_retired_versions_invalid");
  }
  const normalizedRetiredVersions = retiredVersions.map(keyVersion);
  if (new Set(normalizedRetiredVersions).size !== normalizedRetiredVersions.length) {
    throw new Error("identity_vault_retired_versions_invalid");
  }
  const targetNumber = Number.parseInt(targetVersion.slice(1), 10);
  for (const version of normalizedRetiredVersions) {
    if (Number.parseInt(version.slice(1), 10) >= targetNumber) {
      throw new Error("identity_vault_retired_versions_invalid");
    }
    const keyName = `IDENTITY_DIRECTORY_ENCRYPTION_KEY_${version.toUpperCase()}`;
    if (typeof env[keyName] === "string" && env[keyName].trim().length > 0) {
      throw new Error("identity_vault_retired_key_still_available");
    }
  }

  const rowIds = new Set();
  const evidence = createHash("sha256");
  for (const input of rows) {
    const row = exactKeys(input, [
      "id",
      "institutionId",
      "importId",
      "personRef",
      "envelope",
    ], "identity_vault_retirement_row_invalid");
    const id = rotationRowId(row.id);
    const idKey = String(id);
    if (rowIds.has(idKey)) throw new Error("identity_vault_retirement_row_duplicate");
    rowIds.add(idKey);
    if (row.institutionId !== institutionId || row.importId !== importId) {
      throw new Error("identity_vault_retirement_scope_mismatch");
    }
    const envelope = exactKeys(row.envelope, [
      "keyVersion",
      "payloadSchema",
      "iv",
      "authTag",
      "ciphertext",
    ], "identity_vault_retirement_envelope_invalid");
    if (keyVersion(envelope.keyVersion) !== targetVersion) {
      throw new Error("identity_vault_rotation_incomplete");
    }
    decryptIdentityVaultPayload({
      envelope,
      institutionId: row.institutionId,
      importId: row.importId,
      personRef: row.personRef,
      key: targetKey,
    });
    evidence.update(JSON.stringify([
      idKey,
      row.institutionId,
      row.importId,
      row.personRef,
      envelope.keyVersion,
      envelope.payloadSchema,
      envelope.iv,
      envelope.authTag,
      envelope.ciphertext,
    ]));
  }

  return {
    targetVersion,
    verifiedCount: rows.length,
    retiredVersions: [...normalizedRetiredVersions].sort((left, right) =>
      Number.parseInt(left.slice(1), 10) - Number.parseInt(right.slice(1), 10)
    ),
    evidenceDigest: evidence.digest("hex"),
  };
}
