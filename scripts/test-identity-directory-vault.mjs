import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import {
  decryptIdentityVaultPayload,
  encryptIdentityVaultPayload,
  identityVaultConfig,
  IDENTITY_VAULT_ROTATION_MAX_ROWS,
  rotateIdentityVaultBatch,
  rotateIdentityVaultEnvelope,
} from "../workers/identity-directory-vault.mjs";

const institutionId = "11111111-1111-4111-8111-111111111111";
const importId = "22222222-2222-4222-8222-222222222222";
const personRef = "TEST-STUDENT-001";
const key = randomBytes(32);
const alternateKey = randomBytes(32);
const rotatedKey = randomBytes(32);
const batchTargetKey = randomBytes(32);
const value = {
  firstName: "CamilleTest",
  lastName: "MartinTest",
  academicEmail: "camille@example.test",
  personalEmail: "",
  phone: "+33600000001",
};

const configured = identityVaultConfig({
  IDENTITY_DIRECTORY_ENCRYPTION_KEY_VERSION: "v1",
  IDENTITY_DIRECTORY_ENCRYPTION_KEY_V1: key.toString("base64"),
});
assert.equal(configured.version, "v1");
assert.deepEqual(configured.key, key);

const first = encryptIdentityVaultPayload({
  value,
  institutionId,
  importId,
  personRef,
  config: configured,
});
const second = encryptIdentityVaultPayload({
  value,
  institutionId,
  importId,
  personRef,
  config: configured,
});
assert.notEqual(first.iv, second.iv, "each encrypted row needs a unique nonce");
assert.doesNotMatch(JSON.stringify(first), /CamilleTest|MartinTest|example\.test|33600000001/);
assert.deepEqual(
  decryptIdentityVaultPayload({ envelope: first, institutionId, importId, personRef, key }),
  value
);

assert.throws(
  () => decryptIdentityVaultPayload({
    envelope: first,
    institutionId,
    importId,
    personRef: "TEST-STUDENT-002",
    key,
  }),
  /authenticate|Unsupported state/i,
  "ciphertext must be bound to the person reference"
);
assert.throws(
  () => decryptIdentityVaultPayload({
    envelope: { ...first, ciphertext: `${first.ciphertext.slice(0, -4)}AAAA` },
    institutionId,
    importId,
    personRef,
    key,
  }),
  /authenticate|Unsupported state/i,
  "tampering must be detected"
);
assert.throws(
  () => decryptIdentityVaultPayload({
    envelope: first,
    institutionId,
    importId,
    personRef,
    key: alternateKey,
  }),
  /authenticate|Unsupported state/i,
  "a different key must not decrypt the payload"
);
assert.throws(
  () => decryptIdentityVaultPayload({
    envelope: { ...first, iv: "AAAA" },
    institutionId,
    importId,
    personRef,
    key,
  }),
  /identity_vault_envelope_invalid/,
  "a malformed envelope must be rejected before decryption"
);
assert.throws(
  () => identityVaultConfig({
    IDENTITY_DIRECTORY_ENCRYPTION_KEY_VERSION: "v0",
    IDENTITY_DIRECTORY_ENCRYPTION_KEY_V0: key.toString("base64"),
  }),
  /key_version_invalid/
);
assert.throws(
  () => identityVaultConfig({
    IDENTITY_DIRECTORY_ENCRYPTION_KEY_VERSION: "v2",
    IDENTITY_DIRECTORY_ENCRYPTION_KEY_V2: "not-a-key",
  }),
  /key_invalid/
);

const rotationEnvironment = {
  IDENTITY_DIRECTORY_ENCRYPTION_KEY_VERSION: "v2",
  IDENTITY_DIRECTORY_ENCRYPTION_KEY_V1: key.toString("base64"),
  IDENTITY_DIRECTORY_ENCRYPTION_KEY_V2: rotatedKey.toString("base64"),
};
const rotated = rotateIdentityVaultEnvelope({
  envelope: first,
  institutionId,
  importId,
  personRef,
  targetConfig: identityVaultConfig(rotationEnvironment),
  env: rotationEnvironment,
});
assert.equal(rotated.keyVersion, "v2");
assert.notEqual(rotated.iv, first.iv, "rotation must generate a fresh nonce");
assert.doesNotMatch(JSON.stringify(rotated), /CamilleTest|MartinTest|example\.test|33600000001/);
assert.deepEqual(
  decryptIdentityVaultPayload({
    envelope: rotated,
    institutionId,
    importId,
    personRef,
    key: rotatedKey,
  }),
  value
);
assert.throws(
  () => decryptIdentityVaultPayload({
    envelope: rotated,
    institutionId,
    importId,
    personRef,
    key,
  }),
  /authenticate|Unsupported state/i,
  "the retired key must not decrypt a rotated envelope"
);
assert.throws(
  () => rotateIdentityVaultEnvelope({
    envelope: rotated,
    institutionId,
    importId,
    personRef,
    targetConfig: identityVaultConfig(rotationEnvironment),
    env: rotationEnvironment,
  }),
  /rotation_not_required/
);
assert.throws(
  () => rotateIdentityVaultEnvelope({
    envelope: first,
    institutionId,
    importId,
    personRef,
    targetConfig: identityVaultConfig(rotationEnvironment),
    env: {
      IDENTITY_DIRECTORY_ENCRYPTION_KEY_VERSION: "v2",
      IDENTITY_DIRECTORY_ENCRYPTION_KEY_V2: rotatedKey.toString("base64"),
    },
  }),
  /key_invalid/,
  "rotation must fail closed while the source key is unavailable"
);
assert.throws(
  () => rotateIdentityVaultEnvelope({
    envelope: rotated,
    institutionId,
    importId,
    personRef,
    targetConfig: configured,
    env: rotationEnvironment,
  }),
  /rotation_target_invalid/,
  "rotation must never downgrade the key version"
);

const batchEnvironment = {
  IDENTITY_DIRECTORY_ENCRYPTION_KEY_VERSION: "v3",
  IDENTITY_DIRECTORY_ENCRYPTION_KEY_V1: key.toString("base64"),
  IDENTITY_DIRECTORY_ENCRYPTION_KEY_V2: rotatedKey.toString("base64"),
  IDENTITY_DIRECTORY_ENCRYPTION_KEY_V3: batchTargetKey.toString("base64"),
};
const secondContext = {
  institutionId,
  importId: "33333333-3333-4333-8333-333333333333",
  personRef: "TEST-STAFF-002",
};
const secondValue = {
  firstName: "MorganTest",
  lastName: "DurandTest",
  academicEmail: "morgan@example.test",
  personalEmail: "",
  phone: "",
};
const v2Envelope = encryptIdentityVaultPayload({
  value: secondValue,
  ...secondContext,
  config: { version: "v2", key: rotatedKey },
});
const batchRows = [
  { id: "101", institutionId, importId, personRef, envelope: first },
  { id: "102", ...secondContext, envelope: v2Envelope },
];
const batch = rotateIdentityVaultBatch({
  rows: batchRows,
  targetConfig: identityVaultConfig(batchEnvironment),
  env: batchEnvironment,
});
assert.equal(batch.rotatedCount, 2);
assert.equal(batch.targetVersion, "v3");
assert.deepEqual(batch.sourceVersions, { v1: 1, v2: 1 });
assert.deepEqual(batch.rows.map((row) => row.id), ["101", "102"]);
assert.notEqual(batch.rows[0].envelope.iv, first.iv);
assert.notEqual(batch.rows[1].envelope.iv, v2Envelope.iv);
assert.doesNotMatch(
  JSON.stringify(batch),
  /CamilleTest|MartinTest|MorganTest|DurandTest|example\.test|33600000001/
);
assert.deepEqual(
  decryptIdentityVaultPayload({
    envelope: batch.rows[0].envelope,
    institutionId,
    importId,
    personRef,
    key: batchTargetKey,
  }),
  value
);
assert.deepEqual(
  decryptIdentityVaultPayload({
    envelope: batch.rows[1].envelope,
    ...secondContext,
    key: batchTargetKey,
  }),
  secondValue
);
assert.throws(
  () => rotateIdentityVaultBatch({
    rows: batchRows,
    targetConfig: identityVaultConfig(batchEnvironment),
    env: { ...batchEnvironment, IDENTITY_DIRECTORY_ENCRYPTION_KEY_V1: randomBytes(32).toString("base64") },
  }),
  /authenticate|Unsupported state/i
);
assert.throws(
  () => rotateIdentityVaultBatch({
    rows: [{ ...batch.rows[0], envelope: batch.rows[0].envelope }],
    targetConfig: identityVaultConfig(batchEnvironment),
    env: batchEnvironment,
  }),
  /rotation_not_required/
);
assert.throws(
  () => rotateIdentityVaultBatch({
    rows: [batchRows[0], { ...batchRows[1], id: batchRows[0].id }],
    targetConfig: identityVaultConfig(batchEnvironment),
    env: batchEnvironment,
  }),
  /row_duplicate/
);
assert.throws(
  () => rotateIdentityVaultBatch({
    rows: Array.from({ length: IDENTITY_VAULT_ROTATION_MAX_ROWS + 1 }, () => batchRows[0]),
    targetConfig: identityVaultConfig(batchEnvironment),
    env: batchEnvironment,
  }),
  /batch_size_invalid/
);
assert.throws(
  () => rotateIdentityVaultBatch({
    rows: batchRows,
    batchLimit: 1,
    targetConfig: identityVaultConfig(batchEnvironment),
    env: batchEnvironment,
  }),
  /batch_size_invalid/
);
assert.throws(
  () => rotateIdentityVaultBatch({
    rows: [{ ...batchRows[0], clearName: "forbidden" }],
    targetConfig: identityVaultConfig(batchEnvironment),
    env: batchEnvironment,
  }),
  /row_invalid/
);
assert.throws(
  () => rotateIdentityVaultBatch({
    rows: [{ ...batchRows[0], envelope: { ...first, clearName: "forbidden" } }],
    targetConfig: identityVaultConfig(batchEnvironment),
    env: batchEnvironment,
  }),
  /envelope_invalid/
);
assert.throws(
  () => rotateIdentityVaultBatch({
    rows: [batchRows[1]],
    targetConfig: configured,
    env: batchEnvironment,
  }),
  /rotation_target_invalid/
);
assert.throws(
  () => rotateIdentityVaultBatch({
    rows: batchRows,
    batchLimit: IDENTITY_VAULT_ROTATION_MAX_ROWS + 1,
    targetConfig: identityVaultConfig(batchEnvironment),
    env: batchEnvironment,
  }),
  /batch_limit_invalid/
);

console.log("identity directory vault: 37/37 checks passed");
