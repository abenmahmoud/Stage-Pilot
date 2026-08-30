import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import {
  decryptIdentityVaultPayload,
  encryptIdentityVaultPayload,
  identityVaultConfig,
  rotateIdentityVaultEnvelope,
} from "../workers/identity-directory-vault.mjs";

const institutionId = "11111111-1111-4111-8111-111111111111";
const importId = "22222222-2222-4222-8222-222222222222";
const personRef = "TEST-STUDENT-001";
const key = randomBytes(32);
const alternateKey = randomBytes(32);
const rotatedKey = randomBytes(32);
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

console.log("identity directory vault: 19/19 checks passed");
