import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import {
  decryptIdentityVaultPayload,
  encryptIdentityVaultPayload,
  rotateIdentityVaultBatch,
  verifyIdentityVaultKeyRetirement,
  verifyIdentityVaultRecoverySnapshot,
} from "../workers/identity-directory-vault.mjs";
import {
  createRecoverySampleBundle,
  verifyRecoverySampleBundle,
} from "../workers/recovery-sample-bundle.mjs";

const institutionId = "11111111-1111-4111-8111-111111111111";
const importId = "22222222-2222-4222-8222-222222222222";
const backupId = "33333333-3333-4333-8333-333333333333";
const vaultKeys = {
  v1: randomBytes(32),
  v2: randomBytes(32),
  v3: randomBytes(32),
};
const vaultEnvironment = {
  IDENTITY_DIRECTORY_ENCRYPTION_KEY_V1: vaultKeys.v1.toString("base64"),
  IDENTITY_DIRECTORY_ENCRYPTION_KEY_V2: vaultKeys.v2.toString("base64"),
  IDENTITY_DIRECTORY_ENCRYPTION_KEY_V3: vaultKeys.v3.toString("base64"),
};
const people = [
  {
    id: "701",
    personRef: "TEST-STUDENT-701",
    keyVersion: "v1",
    value: {
      firstName: "CamilleTest",
      lastName: "MartinTest",
      academicEmail: "camille@example.test",
      personalEmail: "",
      phone: "+33600000701",
    },
  },
  {
    id: "702",
    personRef: "TEST-GUARDIAN-702",
    keyVersion: "v1",
    value: {
      firstName: "MorganTest",
      lastName: "DurandTest",
      academicEmail: "",
      personalEmail: "morgan@example.test",
      phone: "+33600000702",
    },
  },
  {
    id: "703",
    personRef: "TEST-STAFF-703",
    keyVersion: "v2",
    value: {
      firstName: "AlexTest",
      lastName: "BernardTest",
      academicEmail: "alex@example.test",
      personalEmail: "",
      phone: "",
    },
  },
];

const rows = people.map(({ keyVersion, value, ...person }) => ({
  ...person,
  institutionId,
  importId,
  envelope: encryptIdentityVaultPayload({
    value,
    institutionId,
    importId,
    personRef: person.personRef,
    config: { version: keyVersion, key: vaultKeys[keyVersion] },
  }),
}));
const beforeBackup = verifyIdentityVaultRecoverySnapshot({
  rows,
  institutionId,
  importId,
  env: vaultEnvironment,
});
assert.deepEqual(beforeBackup.keyVersions, { v1: 2, v2: 1 });
assert.equal(beforeBackup.verifiedCount, 3);
assert.match(beforeBackup.evidenceDigest, /^[a-f0-9]{64}$/);

const databasePayload = Buffer.from(JSON.stringify({
  schemaVersion: 1,
  institutionId,
  importId,
  rows,
}), "utf8");
assert.doesNotMatch(
  databasePayload.toString("utf8"),
  /CamilleTest|MartinTest|MorganTest|DurandTest|AlexTest|BernardTest|example\.test|3360000070/
);

const backupConfig = { version: "v7", key: randomBytes(32) };
const bundle = createRecoverySampleBundle({
  institutionId,
  backupId,
  createdAt: "2026-08-31T04:00:00.000Z",
  config: backupConfig,
  artifacts: [
    {
      kind: "database",
      sourcePath: "database/identity-vault-fixture.json",
      mediaType: "application/json",
      bytes: databasePayload,
    },
    {
      kind: "storage",
      sourcePath: "identity-directory/fixture/source.pdf",
      mediaType: "application/pdf",
      bytes: Buffer.from("%PDF-1.7\nDocument annuaire strictement fictif.\n%%EOF", "utf8"),
    },
  ],
});
assert.doesNotMatch(
  JSON.stringify(bundle),
  /identity-vault-fixture|identity-directory\/fixture|Document annuaire|CamilleTest|example\.test/
);

const restoredBundle = verifyRecoverySampleBundle({
  bundle,
  expectedInstitutionId: institutionId,
  expectedBackupId: backupId,
  config: backupConfig,
});
const restoredDatabase = restoredBundle.artifacts.find((artifact) => artifact.kind === "database");
assert.ok(restoredDatabase, "The encrypted database artifact must be restored");
const restoredSnapshot = JSON.parse(restoredDatabase.bytes.toString("utf8"));
assert.deepEqual(
  Object.keys(restoredSnapshot).sort(),
  ["importId", "institutionId", "rows", "schemaVersion"]
);
assert.equal(restoredSnapshot.schemaVersion, 1);
assert.equal(restoredSnapshot.institutionId, institutionId);
assert.equal(restoredSnapshot.importId, importId);

const afterRestore = verifyIdentityVaultRecoverySnapshot({
  rows: restoredSnapshot.rows,
  institutionId,
  importId,
  env: vaultEnvironment,
});
assert.deepEqual(afterRestore, beforeBackup);
assert.deepEqual(
  verifyIdentityVaultRecoverySnapshot({
    rows: [...restoredSnapshot.rows].reverse(),
    institutionId,
    importId,
    env: vaultEnvironment,
  }),
  beforeBackup
);

const rotated = rotateIdentityVaultBatch({
  rows: restoredSnapshot.rows,
  targetConfig: { version: "v3", key: vaultKeys.v3 },
  env: vaultEnvironment,
});
assert.equal(rotated.rotatedCount, 3);
assert.deepEqual(rotated.sourceVersions, { v1: 2, v2: 1 });
const retirementEnvironment = {
  IDENTITY_DIRECTORY_ENCRYPTION_KEY_V3: vaultKeys.v3.toString("base64"),
};
const afterRotation = verifyIdentityVaultRecoverySnapshot({
  rows: rotated.rows,
  institutionId,
  importId,
  env: retirementEnvironment,
});
assert.deepEqual(afterRotation.keyVersions, { v3: 3 });
const retirement = verifyIdentityVaultKeyRetirement({
  rows: rotated.rows,
  institutionId,
  importId,
  targetConfig: { version: "v3", key: vaultKeys.v3 },
  retiredVersions: ["v1", "v2"],
  env: retirementEnvironment,
});
assert.equal(retirement.verifiedCount, 3);
assert.deepEqual(retirement.retiredVersions, ["v1", "v2"]);
for (const [index, row] of rotated.rows.entries()) {
  assert.deepEqual(
    decryptIdentityVaultPayload({
      envelope: row.envelope,
      institutionId,
      importId,
      personRef: row.personRef,
      key: vaultKeys.v3,
    }),
    people[index].value
  );
}

assert.throws(
  () => verifyIdentityVaultRecoverySnapshot({
    rows,
    institutionId,
    importId,
    env: { IDENTITY_DIRECTORY_ENCRYPTION_KEY_V1: vaultEnvironment.IDENTITY_DIRECTORY_ENCRYPTION_KEY_V1 },
  }),
  /key_invalid/
);
assert.throws(
  () => verifyIdentityVaultRecoverySnapshot({
    rows: [{ ...rows[0], clearName: "forbidden" }],
    institutionId,
    importId,
    env: vaultEnvironment,
  }),
  /recovery_row_invalid/
);
assert.throws(
  () => verifyIdentityVaultRecoverySnapshot({
    rows: [rows[0], { ...rows[1], id: rows[0].id }],
    institutionId,
    importId,
    env: vaultEnvironment,
  }),
  /recovery_row_duplicate/
);
assert.throws(
  () => verifyIdentityVaultRecoverySnapshot({
    rows: [{ ...rows[0], institutionId: "44444444-4444-4444-8444-444444444444" }],
    institutionId,
    importId,
    env: vaultEnvironment,
  }),
  /recovery_scope_mismatch/
);
assert.throws(
  () => verifyIdentityVaultRecoverySnapshot({
    rows: [{
      ...rows[0],
      envelope: {
        ...rows[0].envelope,
        ciphertext: `${rows[0].envelope.ciphertext.slice(0, -4)}AAAA`,
      },
    }],
    institutionId,
    importId,
    env: vaultEnvironment,
  }),
  /authenticate|Unsupported state/i
);
assert.throws(
  () => verifyIdentityVaultRecoverySnapshot({
    rows: [],
    institutionId,
    importId,
    env: vaultEnvironment,
  }),
  /recovery_batch_size_invalid/
);
assert.throws(
  () => verifyIdentityVaultRecoverySnapshot({
    rows,
    institutionId,
    importId,
    env: vaultEnvironment,
    batchLimit: 2,
  }),
  /recovery_batch_size_invalid/
);
assert.throws(
  () => verifyRecoverySampleBundle({
    bundle,
    expectedInstitutionId: institutionId,
    expectedBackupId: backupId,
    config: { version: "v7", key: randomBytes(32) },
  }),
  /authentication_failed/
);

console.log("identity vault recovery: backup, restore, rotation and retirement verified");
