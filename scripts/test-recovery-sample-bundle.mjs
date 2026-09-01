import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createRecoverySampleBundle,
  restoreRecoverySampleBundleToDirectory,
  verifyRecoverySampleBundle,
} from "../workers/recovery-sample-bundle.mjs";

const institutionId = "11111111-1111-4111-8111-111111111111";
const backupId = "22222222-2222-4222-8222-222222222222";
const createdAt = "2026-08-30T08:00:00.000Z";
const key = randomBytes(32);
const config = { version: "v1", key };
const databaseBytes = Buffer.from([
  0x50, 0x47, 0x44, 0x4d, 0x50, 0x00, 0x01, 0x02, 0x03, 0xff,
]);
const storageBytes = Buffer.from("Document strictement fictif pour la restauration.", "utf8");
const artifacts = [
  {
    kind: "database",
    sourcePath: "database/support-fixture.dump",
    mediaType: "application/octet-stream",
    bytes: databaseBytes,
  },
  {
    kind: "storage",
    sourcePath: "support-clean/fixture/document-test.pdf",
    mediaType: "application/pdf",
    bytes: storageBytes,
  },
];

const bundle = createRecoverySampleBundle({
  institutionId,
  backupId,
  createdAt,
  artifacts,
  config,
});
const secondBundle = createRecoverySampleBundle({
  institutionId,
  backupId: "33333333-3333-4333-8333-333333333333",
  createdAt,
  artifacts,
  config,
});

assert.equal(bundle.artifactCount, 2);
assert.equal(bundle.algorithm, "AES-256-GCM");
assert.notEqual(bundle.artifacts[0].iv, secondBundle.artifacts[0].iv);
assert.notEqual(bundle.artifacts[0].ciphertext, secondBundle.artifacts[0].ciphertext);
assert.doesNotMatch(
  JSON.stringify(bundle),
  /support-fixture|support-clean|Document strictement fictif|PGDMP/,
  "paths and content must stay encrypted"
);

const restored = verifyRecoverySampleBundle({
  bundle,
  expectedInstitutionId: institutionId,
  expectedBackupId: backupId,
  config,
});
assert.equal(restored.artifacts.length, 2);
assert.deepEqual(restored.artifacts[0].bytes, databaseBytes);
assert.deepEqual(restored.artifacts[1].bytes, storageBytes);
assert.equal(restored.artifacts[1].sourcePath, artifacts[1].sourcePath);

function expectRejected(candidate, pattern, overrides = {}) {
  assert.throws(
    () => verifyRecoverySampleBundle({
      bundle: candidate,
      expectedInstitutionId: institutionId,
      expectedBackupId: backupId,
      config,
      ...overrides,
    }),
    pattern
  );
}

expectRejected(bundle, /authentication_failed/, {
  config: { version: "v1", key: randomBytes(32) },
});
expectRejected(bundle, /institution_mismatch/, {
  expectedInstitutionId: "44444444-4444-4444-8444-444444444444",
});
expectRejected(bundle, /backup_id_mismatch/, {
  expectedBackupId: "55555555-5555-4555-8555-555555555555",
});
expectRejected(bundle, /key_version_mismatch/, {
  config: { version: "v2", key },
});
expectRejected({ ...bundle, schemaVersion: 2 }, /schema_unsupported/);
expectRejected({ ...bundle, unexpected: true }, /bundle_invalid/);

const removedArtifact = {
  ...bundle,
  artifacts: bundle.artifacts.slice(0, 1),
};
expectRejected(removedArtifact, /artifact_count_invalid/);

const reversedArtifacts = {
  ...bundle,
  artifacts: [...bundle.artifacts].reverse(),
};
expectRejected(reversedArtifacts, /artifact_order_invalid/);

const tamperedCiphertext = {
  ...bundle,
  artifacts: bundle.artifacts.map((artifact, index) => index === 1
    ? { ...artifact, ciphertext: `${artifact.ciphertext.slice(0, -4)}AAAA` }
    : artifact),
};
expectRejected(tamperedCiphertext, /authentication_failed/);

const tamperedKind = {
  ...bundle,
  artifacts: bundle.artifacts.map((artifact, index) => index === 0
    ? { ...artifact, kind: "storage" }
    : artifact),
};
expectRejected(tamperedKind, /authentication_failed|scope_incomplete/);

const malformedIv = {
  ...bundle,
  artifacts: bundle.artifacts.map((artifact, index) => index === 0
    ? { ...artifact, iv: "AAAA" }
    : artifact),
};
expectRejected(malformedIv, /envelope_invalid/);

const oversizedCiphertext = {
  ...bundle,
  artifacts: bundle.artifacts.map((artifact, index) => index === 0
    ? { ...artifact, plaintextBytes: 1, ciphertext: "A".repeat(5000) }
    : artifact),
};
expectRejected(oversizedCiphertext, /envelope_invalid/);

const duplicateArtifactId = {
  ...bundle,
  artifacts: bundle.artifacts.map((artifact, index) => index === 1
    ? { ...artifact, artifactId: bundle.artifacts[0].artifactId }
    : artifact),
};
expectRejected(duplicateArtifactId, /artifact_duplicate/);

const unknownArtifactField = {
  ...bundle,
  artifacts: bundle.artifacts.map((artifact, index) => index === 0
    ? { ...artifact, sourcePath: "clear/path-must-not-be-accepted" }
    : artifact),
};
expectRejected(unknownArtifactField, /artifact_invalid/);

assert.throws(
  () => createRecoverySampleBundle({
    institutionId,
    backupId,
    createdAt,
    artifacts: [artifacts[0], { ...artifacts[0] }],
    config,
  }),
  /source_path_duplicate/
);
assert.throws(
  () => createRecoverySampleBundle({
    institutionId,
    backupId,
    createdAt,
    artifacts: [artifacts[0], { ...artifacts[1], sourcePath: "../document.pdf" }],
    config,
  }),
  /source_path_invalid/
);
assert.throws(
  () => createRecoverySampleBundle({
    institutionId,
    backupId,
    createdAt,
    artifacts: [artifacts[0], { ...artifacts[1], sourcePath: "support-clean/document.pdf:secret" }],
    config,
  }),
  /source_path_invalid/
);
assert.throws(
  () => createRecoverySampleBundle({
    institutionId,
    backupId,
    createdAt,
    artifacts: [artifacts[0], { ...artifacts[1], sourcePath: "support-clean/NUL.pdf" }],
    config,
  }),
  /source_path_invalid/
);
assert.throws(
  () => createRecoverySampleBundle({
    institutionId,
    backupId,
    createdAt,
    artifacts: [artifacts[0], { ...artifacts[0], sourcePath: "database/second.dump" }],
    config,
  }),
  /scope_incomplete/
);
assert.throws(
  () => createRecoverySampleBundle({
    institutionId,
    backupId,
    createdAt: "2026-08-30",
    artifacts,
    config,
  }),
  /created_at_invalid/
);
assert.throws(
  () => createRecoverySampleBundle({
    institutionId,
    backupId,
    createdAt,
    artifacts,
    config: { version: "v1", key: Buffer.alloc(16) },
  }),
  /key_invalid/
);

const restoreParent = await mkdtemp(join(tmpdir(), "lyceegest-recovery-test-"));
try {
  const restoreName = "restore-safe-fixture";
  const receipt = await restoreRecoverySampleBundleToDirectory({
    bundle,
    expectedInstitutionId: institutionId,
    expectedBackupId: backupId,
    config,
    parentDirectory: restoreParent,
    restoreName,
  });
  const expectedAggregate = createHash("sha256")
    .update(
      `database\0${artifacts[0].sourcePath}\0${createHash("sha256").update(databaseBytes).digest("hex")}\0${databaseBytes.length}\n`,
      "utf8"
    )
    .update(
      `storage\0${artifacts[1].sourcePath}\0${createHash("sha256").update(storageBytes).digest("hex")}\0${storageBytes.length}\n`,
      "utf8"
    )
    .digest("hex");

  assert.equal(receipt.artifactCount, 2);
  assert.equal(receipt.databaseArtifactCount, 1);
  assert.equal(receipt.storageArtifactCount, 1);
  assert.equal(receipt.totalBytes, databaseBytes.length + storageBytes.length);
  assert.equal(receipt.aggregateSha256, expectedAggregate);
  assert.doesNotMatch(JSON.stringify(receipt), /support-fixture|support-clean|Document strictement fictif/);
  assert.deepEqual(
    await readFile(join(
      restoreParent,
      restoreName,
      "database",
      "database",
      "support-fixture.dump"
    )),
    databaseBytes
  );
  assert.deepEqual(
    await readFile(join(
      restoreParent,
      restoreName,
      "storage",
      "support-clean",
      "fixture",
      "document-test.pdf"
    )),
    storageBytes
  );

  await assert.rejects(
    restoreRecoverySampleBundleToDirectory({
      bundle,
      expectedInstitutionId: institutionId,
      expectedBackupId: backupId,
      config,
      parentDirectory: restoreParent,
      restoreName,
    }),
    /restore_target_exists/
  );
  assert.deepEqual(
    await readFile(join(
      restoreParent,
      restoreName,
      "database",
      "database",
      "support-fixture.dump"
    )),
    databaseBytes,
    "an existing restore must never be overwritten"
  );

  await assert.rejects(
    restoreRecoverySampleBundleToDirectory({
      bundle,
      expectedInstitutionId: institutionId,
      expectedBackupId: backupId,
      config,
      parentDirectory: restoreParent,
      restoreName: "../escape",
    }),
    /restore_name_invalid/
  );
  await assert.rejects(
    restoreRecoverySampleBundleToDirectory({
      bundle: tamperedCiphertext,
      expectedInstitutionId: institutionId,
      expectedBackupId: backupId,
      config,
      parentDirectory: restoreParent,
      restoreName: "restore-tampered-fixture",
    }),
    /authentication_failed/
  );
  assert.deepEqual(
    (await readdir(restoreParent)).sort(),
    [restoreName],
    "a rejected bundle must leave no directory or lock behind"
  );
} finally {
  await rm(restoreParent, { recursive: true, force: true, maxRetries: 2 });
}

console.log("recovery sample bundle: verification and isolated restore checks passed");
