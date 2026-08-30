import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import {
  encryptIdentityVaultPayload,
  verifyIdentityVaultKeyRetirement,
} from "../workers/identity-directory-vault.mjs";

const targetKey = randomBytes(32);
const targetConfig = { version: "v3", key: targetKey };
const people = [
  {
    id: "901",
    institutionId: "11111111-1111-4111-8111-111111111111",
    importId: "22222222-2222-4222-8222-222222222222",
    personRef: "TEST-STUDENT-901",
    value: {
      firstName: "CamilleTest",
      lastName: "MartinTest",
      academicEmail: "camille@example.test",
      personalEmail: "",
      phone: "+33600000901",
    },
  },
  {
    id: "902",
    institutionId: "11111111-1111-4111-8111-111111111111",
    importId: "22222222-2222-4222-8222-222222222222",
    personRef: "TEST-STAFF-902",
    value: {
      firstName: "MorganTest",
      lastName: "DurandTest",
      academicEmail: "morgan@example.test",
      personalEmail: "",
      phone: "",
    },
  },
];

const rows = people.map(({ value, ...context }) => ({
  ...context,
  envelope: encryptIdentityVaultPayload({ value, ...context, config: targetConfig }),
}));
const retiredEnvironment = {
  IDENTITY_DIRECTORY_ENCRYPTION_KEY_VERSION: "v3",
  IDENTITY_DIRECTORY_ENCRYPTION_KEY_V3: targetKey.toString("base64"),
};

const proof = verifyIdentityVaultKeyRetirement({
  rows,
  institutionId: people[0].institutionId,
  importId: people[0].importId,
  targetConfig,
  retiredVersions: ["v2", "v1"],
  env: retiredEnvironment,
});
assert.deepEqual(proof.retiredVersions, ["v1", "v2"]);
assert.equal(proof.targetVersion, "v3");
assert.equal(proof.verifiedCount, 2);
assert.match(proof.evidenceDigest, /^[a-f0-9]{64}$/);
assert.doesNotMatch(
  JSON.stringify(proof),
  /CamilleTest|MartinTest|MorganTest|DurandTest|example\.test|33600000901/
);

assert.throws(
  () => verifyIdentityVaultKeyRetirement({
    rows,
    institutionId: people[0].institutionId,
    importId: people[0].importId,
    targetConfig,
    retiredVersions: ["v1", "v2"],
    env: { ...retiredEnvironment, IDENTITY_DIRECTORY_ENCRYPTION_KEY_V1: randomBytes(32).toString("base64") },
  }),
  /retired_key_still_available/
);
assert.throws(
  () => verifyIdentityVaultKeyRetirement({
    rows: [{ ...rows[0], envelope: { ...rows[0].envelope, keyVersion: "v2" } }],
    institutionId: people[0].institutionId,
    importId: people[0].importId,
    targetConfig,
    retiredVersions: ["v1", "v2"],
    env: retiredEnvironment,
  }),
  /rotation_incomplete/
);
assert.throws(
  () => verifyIdentityVaultKeyRetirement({
    rows: [{
      ...rows[0],
      envelope: {
        ...rows[0].envelope,
        ciphertext: `${rows[0].envelope.ciphertext.slice(0, -4)}AAAA`,
      },
    }],
    institutionId: people[0].institutionId,
    importId: people[0].importId,
    targetConfig,
    retiredVersions: ["v1", "v2"],
    env: retiredEnvironment,
  }),
  /authenticate|Unsupported state/i
);
assert.throws(
  () => verifyIdentityVaultKeyRetirement({
    rows: [rows[0], { ...rows[1], id: rows[0].id }],
    institutionId: people[0].institutionId,
    importId: people[0].importId,
    targetConfig,
    retiredVersions: ["v1", "v2"],
    env: retiredEnvironment,
  }),
  /row_duplicate/
);
for (const retiredVersions of [["v1", "v1"], ["v3"], ["v4"], []]) {
  assert.throws(
    () => verifyIdentityVaultKeyRetirement({
      rows,
      institutionId: people[0].institutionId,
      importId: people[0].importId,
      targetConfig,
      retiredVersions,
      env: retiredEnvironment,
    }),
    /retired_versions_invalid/
  );
}
assert.throws(
  () => verifyIdentityVaultKeyRetirement({
    rows: [{ ...rows[0], clearName: "forbidden" }],
    institutionId: people[0].institutionId,
    importId: people[0].importId,
    targetConfig,
    retiredVersions: ["v1", "v2"],
    env: retiredEnvironment,
  }),
  /retirement_row_invalid/
);
assert.throws(
  () => verifyIdentityVaultKeyRetirement({
    rows,
    institutionId: people[0].institutionId,
    importId: people[0].importId,
    targetConfig,
    retiredVersions: ["v1", "v2"],
    env: retiredEnvironment,
    batchLimit: 1,
  }),
  /retirement_batch_size_invalid/
);

assert.throws(
  () => verifyIdentityVaultKeyRetirement({
    rows,
    institutionId: people[0].institutionId,
    importId: "33333333-3333-4333-8333-333333333333",
    targetConfig,
    retiredVersions: ["v1", "v2"],
    env: retiredEnvironment,
  }),
  /retirement_scope_mismatch/
);

console.log("identity vault retirement: 14/14 checks passed");
