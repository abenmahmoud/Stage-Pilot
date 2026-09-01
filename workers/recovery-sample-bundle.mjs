import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  hkdfSync,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import {
  lstat,
  mkdir,
  mkdtemp,
  open,
  readFile,
  realpath,
  rename,
  rm,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import {
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
} from "node:path";

export const RECOVERY_SAMPLE_SCHEMA_VERSION = 1;
export const RECOVERY_SAMPLE_MAX_ARTIFACTS = 64;
export const RECOVERY_SAMPLE_MAX_ARTIFACT_BYTES = 8 * 1024 * 1024;
export const RECOVERY_SAMPLE_MAX_TOTAL_BYTES = 32 * 1024 * 1024;

const FORMAT = "lyceegest-recovery-sample";
const ALGORITHM = "AES-256-GCM";
const ARTIFACT_KINDS = new Set(["database", "storage"]);

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

function identifier(value, code) {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_-]{7,127}$/.test(value)) {
    throw new Error(code);
  }
  return value;
}

function keyVersion(value) {
  if (typeof value !== "string" || !/^v[1-9][0-9]{0,3}$/.test(value)) {
    throw new Error("recovery_sample_key_version_invalid");
  }
  return value;
}

function base64Bytes(value, { code, exactBytes, maxBytes = RECOVERY_SAMPLE_MAX_ARTIFACT_BYTES * 2 }) {
  if (typeof value !== "string" || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    throw new Error(code);
  }
  const bytes = Buffer.from(value, "base64");
  if (
    bytes.toString("base64") !== value ||
    (exactBytes !== undefined && bytes.length !== exactBytes) ||
    bytes.length > maxBytes
  ) {
    throw new Error(code);
  }
  return bytes;
}

function encryptionKey(value) {
  const key = Buffer.isBuffer(value)
    ? value
    : base64Bytes(value, { code: "recovery_sample_key_invalid", exactBytes: 32 });
  if (key.length !== 32) throw new Error("recovery_sample_key_invalid");
  return key;
}

function isoInstant(value) {
  if (typeof value !== "string") throw new Error("recovery_sample_created_at_invalid");
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) {
    throw new Error("recovery_sample_created_at_invalid");
  }
  return value;
}

function artifactKind(value) {
  if (!ARTIFACT_KINDS.has(value)) throw new Error("recovery_sample_artifact_kind_invalid");
  return value;
}

function sourcePath(value) {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > 500 ||
    value.startsWith("/") ||
    value.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    throw new Error("recovery_sample_source_path_invalid");
  }
  const segments = value.split("/");
  if (segments.some((segment) => (
    segment === "" ||
    segment === "." ||
    segment === ".." ||
    /[<>:"|?*]/.test(segment) ||
    /[. ]$/.test(segment) ||
    /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i.test(segment)
  ))) {
    throw new Error("recovery_sample_source_path_invalid");
  }
  return value;
}

function restoreDirectoryName(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_-]{7,127}$/.test(value)) {
    throw new Error("recovery_sample_restore_name_invalid");
  }
  return value;
}

function assertInsideDirectory(parentDirectory, candidatePath, code) {
  const pathFromParent = relative(parentDirectory, candidatePath);
  if (
    pathFromParent === "" ||
    pathFromParent === ".." ||
    pathFromParent.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) ||
    isAbsolute(pathFromParent)
  ) {
    throw new Error(code);
  }
}

async function pathExists(candidatePath) {
  try {
    await lstat(candidatePath);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

async function removeOwnedTemporaryDirectory(parentDirectory, temporaryDirectory) {
  if (!temporaryDirectory) return;
  assertInsideDirectory(
    parentDirectory,
    temporaryDirectory,
    "recovery_sample_temporary_path_invalid"
  );
  const pathFromParent = relative(parentDirectory, temporaryDirectory);
  if (
    pathFromParent.includes("/") ||
    pathFromParent.includes("\\") ||
    !pathFromParent.startsWith(".lyceegest-restore-")
  ) {
    throw new Error("recovery_sample_temporary_path_invalid");
  }
  await rm(temporaryDirectory, { recursive: true, force: true, maxRetries: 2 });
}

function mediaType(value) {
  if (
    typeof value !== "string" ||
    value.length > 100 ||
    !/^[a-z0-9][a-z0-9.+-]*\/[a-z0-9][a-z0-9.+-]*$/i.test(value)
  ) {
    throw new Error("recovery_sample_media_type_invalid");
  }
  return value.toLowerCase();
}

function artifactBytes(value) {
  const bytes = Buffer.isBuffer(value)
    ? value
    : value instanceof Uint8Array
      ? Buffer.from(value.buffer, value.byteOffset, value.byteLength)
      : typeof value === "string"
        ? Buffer.from(value, "utf8")
        : null;
  if (!bytes || bytes.length < 1 || bytes.length > RECOVERY_SAMPLE_MAX_ARTIFACT_BYTES) {
    throw new Error("recovery_sample_artifact_size_invalid");
  }
  return Buffer.from(bytes);
}

function maxCiphertextBytes(plaintextBytes) {
  return Math.ceil(plaintextBytes / 3) * 4 + 2048;
}

function assertBoundedBase64Text(value, maxDecodedBytes) {
  if (
    typeof value !== "string" ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(value) ||
    value.length > Math.ceil(maxDecodedBytes / 3) * 4
  ) {
    throw new Error("recovery_sample_envelope_invalid");
  }
}

function artifactAad(bundle, artifact) {
  return Buffer.from(
    [
      FORMAT,
      bundle.schemaVersion,
      bundle.institutionId,
      bundle.backupId,
      bundle.createdAt,
      bundle.keyVersion,
      bundle.artifactCount,
      artifact.index,
      artifact.artifactId,
      artifact.kind,
      artifact.plaintextBytes,
    ].join(":"),
    "utf8"
  );
}

function manifestPayload(bundle) {
  return {
    schemaVersion: bundle.schemaVersion,
    format: bundle.format,
    institutionId: bundle.institutionId,
    backupId: bundle.backupId,
    createdAt: bundle.createdAt,
    keyVersion: bundle.keyVersion,
    algorithm: bundle.algorithm,
    artifactCount: bundle.artifactCount,
    artifacts: bundle.artifacts.map((artifact) => ({
      artifactId: artifact.artifactId,
      kind: artifact.kind,
      index: artifact.index,
      plaintextBytes: artifact.plaintextBytes,
      iv: artifact.iv,
      authTag: artifact.authTag,
      ciphertext: artifact.ciphertext,
    })),
  };
}

function manifestKey(key, bundle) {
  return Buffer.from(hkdfSync(
    "sha256",
    key,
    Buffer.from(`${bundle.institutionId}:${bundle.backupId}`, "utf8"),
    Buffer.from(`${FORMAT}:manifest:${RECOVERY_SAMPLE_SCHEMA_VERSION}`, "utf8"),
    32
  ));
}

function manifestMac(bundle, key) {
  return createHmac("sha256", manifestKey(key, bundle))
    .update(JSON.stringify(manifestPayload(bundle)), "utf8")
    .digest();
}

function assertArtifactCoverage(artifacts) {
  const kinds = new Set(artifacts.map((artifact) => artifact.kind));
  if (!kinds.has("database") || !kinds.has("storage")) {
    throw new Error("recovery_sample_scope_incomplete");
  }
}

function validatePublicBundle(value) {
  const bundle = exactKeys(value, [
    "schemaVersion",
    "format",
    "institutionId",
    "backupId",
    "createdAt",
    "keyVersion",
    "algorithm",
    "artifactCount",
    "artifacts",
    "manifestMac",
  ], "recovery_sample_bundle_invalid");
  if (bundle.schemaVersion !== RECOVERY_SAMPLE_SCHEMA_VERSION || bundle.format !== FORMAT) {
    throw new Error("recovery_sample_schema_unsupported");
  }
  identifier(bundle.institutionId, "recovery_sample_institution_invalid");
  identifier(bundle.backupId, "recovery_sample_backup_id_invalid");
  isoInstant(bundle.createdAt);
  keyVersion(bundle.keyVersion);
  if (bundle.algorithm !== ALGORITHM) throw new Error("recovery_sample_algorithm_unsupported");
  if (
    !Number.isInteger(bundle.artifactCount) ||
    bundle.artifactCount < 2 ||
    bundle.artifactCount > RECOVERY_SAMPLE_MAX_ARTIFACTS ||
    !Array.isArray(bundle.artifacts) ||
    bundle.artifacts.length !== bundle.artifactCount
  ) {
    throw new Error("recovery_sample_artifact_count_invalid");
  }
  const artifactIds = new Set();
  let totalBytes = 0;
  let totalCiphertextBytes = 0;
  bundle.artifacts.forEach((entry, index) => {
    const artifact = exactKeys(entry, [
      "artifactId",
      "kind",
      "index",
      "plaintextBytes",
      "iv",
      "authTag",
      "ciphertext",
    ], "recovery_sample_artifact_invalid");
    identifier(artifact.artifactId, "recovery_sample_artifact_id_invalid");
    if (artifactIds.has(artifact.artifactId)) throw new Error("recovery_sample_artifact_duplicate");
    artifactIds.add(artifact.artifactId);
    artifactKind(artifact.kind);
    if (artifact.index !== index) throw new Error("recovery_sample_artifact_order_invalid");
    if (
      !Number.isInteger(artifact.plaintextBytes) ||
      artifact.plaintextBytes < 1 ||
      artifact.plaintextBytes > RECOVERY_SAMPLE_MAX_ARTIFACT_BYTES
    ) {
      throw new Error("recovery_sample_artifact_size_invalid");
    }
    totalBytes += artifact.plaintextBytes;
    base64Bytes(artifact.iv, { code: "recovery_sample_envelope_invalid", exactBytes: 12 });
    base64Bytes(artifact.authTag, { code: "recovery_sample_envelope_invalid", exactBytes: 16 });
    assertBoundedBase64Text(artifact.ciphertext, maxCiphertextBytes(artifact.plaintextBytes));
  });
  if (totalBytes > RECOVERY_SAMPLE_MAX_TOTAL_BYTES) {
    throw new Error("recovery_sample_total_size_invalid");
  }
  for (const artifact of bundle.artifacts) {
    const ciphertext = base64Bytes(artifact.ciphertext, {
      code: "recovery_sample_envelope_invalid",
      maxBytes: maxCiphertextBytes(artifact.plaintextBytes),
    });
    totalCiphertextBytes += ciphertext.length;
  }
  if (totalCiphertextBytes > maxCiphertextBytes(totalBytes) + bundle.artifactCount * 2048) {
    throw new Error("recovery_sample_total_size_invalid");
  }
  assertArtifactCoverage(bundle.artifacts);
  base64Bytes(bundle.manifestMac, { code: "recovery_sample_manifest_invalid", exactBytes: 32 });
  return bundle;
}

export function createRecoverySampleBundle({
  institutionId,
  backupId,
  createdAt,
  artifacts,
  config,
}) {
  const normalizedInstitutionId = identifier(institutionId, "recovery_sample_institution_invalid");
  const normalizedBackupId = identifier(backupId, "recovery_sample_backup_id_invalid");
  const normalizedCreatedAt = isoInstant(createdAt);
  const version = keyVersion(config?.version);
  const key = encryptionKey(config?.key);
  if (!Array.isArray(artifacts) || artifacts.length < 2 || artifacts.length > RECOVERY_SAMPLE_MAX_ARTIFACTS) {
    throw new Error("recovery_sample_artifact_count_invalid");
  }

  const paths = new Set();
  let totalBytes = 0;
  const normalizedArtifacts = artifacts.map((entry) => {
    exactKeys(entry, ["kind", "sourcePath", "mediaType", "bytes"], "recovery_sample_artifact_invalid");
    const kind = artifactKind(entry.kind);
    const path = sourcePath(entry.sourcePath);
    const pathKey = `${kind}:${path}`;
    if (paths.has(pathKey)) throw new Error("recovery_sample_source_path_duplicate");
    paths.add(pathKey);
    const bytes = artifactBytes(entry.bytes);
    totalBytes += bytes.length;
    return { kind, sourcePath: path, mediaType: mediaType(entry.mediaType), bytes };
  });
  if (totalBytes > RECOVERY_SAMPLE_MAX_TOTAL_BYTES) {
    throw new Error("recovery_sample_total_size_invalid");
  }
  assertArtifactCoverage(normalizedArtifacts);

  const bundle = {
    schemaVersion: RECOVERY_SAMPLE_SCHEMA_VERSION,
    format: FORMAT,
    institutionId: normalizedInstitutionId,
    backupId: normalizedBackupId,
    createdAt: normalizedCreatedAt,
    keyVersion: version,
    algorithm: ALGORITHM,
    artifactCount: normalizedArtifacts.length,
    artifacts: [],
  };

  const artifactIds = new Set();
  bundle.artifacts = normalizedArtifacts.map((artifact, index) => {
    let artifactId;
    do {
      artifactId = randomBytes(16).toString("hex");
    } while (artifactIds.has(artifactId));
    artifactIds.add(artifactId);
    const publicArtifact = {
      artifactId,
      kind: artifact.kind,
      index,
      plaintextBytes: artifact.bytes.length,
    };
    const payload = Buffer.from(JSON.stringify({
      sourcePath: artifact.sourcePath,
      mediaType: artifact.mediaType,
      sha256: createHash("sha256").update(artifact.bytes).digest("hex"),
      bytes: artifact.bytes.toString("base64"),
    }), "utf8");
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    cipher.setAAD(artifactAad(bundle, publicArtifact));
    const ciphertext = Buffer.concat([cipher.update(payload), cipher.final()]);
    return {
      ...publicArtifact,
      iv: iv.toString("base64"),
      authTag: cipher.getAuthTag().toString("base64"),
      ciphertext: ciphertext.toString("base64"),
    };
  });

  return {
    ...bundle,
    manifestMac: manifestMac(bundle, key).toString("base64"),
  };
}

export function verifyRecoverySampleBundle({
  bundle: input,
  expectedInstitutionId,
  expectedBackupId,
  config,
}) {
  const bundle = validatePublicBundle(input);
  const institutionId = identifier(expectedInstitutionId, "recovery_sample_institution_invalid");
  const backupId = identifier(expectedBackupId, "recovery_sample_backup_id_invalid");
  if (bundle.institutionId !== institutionId) throw new Error("recovery_sample_institution_mismatch");
  if (bundle.backupId !== backupId) throw new Error("recovery_sample_backup_id_mismatch");
  const version = keyVersion(config?.version);
  if (version !== bundle.keyVersion) throw new Error("recovery_sample_key_version_mismatch");
  const key = encryptionKey(config?.key);
  const suppliedMac = base64Bytes(bundle.manifestMac, {
    code: "recovery_sample_manifest_invalid",
    exactBytes: 32,
  });
  const expectedMac = manifestMac(bundle, key);
  if (!timingSafeEqual(suppliedMac, expectedMac)) {
    throw new Error("recovery_sample_authentication_failed");
  }

  const restored = [];
  const paths = new Set();
  for (const artifact of bundle.artifacts) {
    let payload;
    try {
      const decipher = createDecipheriv(
        "aes-256-gcm",
        key,
        base64Bytes(artifact.iv, { code: "recovery_sample_envelope_invalid", exactBytes: 12 })
      );
      decipher.setAAD(artifactAad(bundle, artifact));
      decipher.setAuthTag(base64Bytes(artifact.authTag, {
        code: "recovery_sample_envelope_invalid",
        exactBytes: 16,
      }));
      const plaintext = Buffer.concat([
        decipher.update(base64Bytes(artifact.ciphertext, {
          code: "recovery_sample_envelope_invalid",
          maxBytes: maxCiphertextBytes(artifact.plaintextBytes),
        })),
        decipher.final(),
      ]).toString("utf8");
      payload = exactKeys(JSON.parse(plaintext), [
        "sourcePath",
        "mediaType",
        "sha256",
        "bytes",
      ], "recovery_sample_payload_invalid");
    } catch {
      throw new Error("recovery_sample_authentication_failed");
    }

    const path = sourcePath(payload.sourcePath);
    const pathKey = `${artifact.kind}:${path}`;
    if (paths.has(pathKey)) throw new Error("recovery_sample_source_path_duplicate");
    paths.add(pathKey);
    const bytes = base64Bytes(payload.bytes, {
      code: "recovery_sample_payload_invalid",
      maxBytes: RECOVERY_SAMPLE_MAX_ARTIFACT_BYTES,
    });
    if (bytes.length !== artifact.plaintextBytes) throw new Error("recovery_sample_payload_invalid");
    if (typeof payload.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(payload.sha256)) {
      throw new Error("recovery_sample_payload_invalid");
    }
    const checksum = createHash("sha256").update(bytes).digest("hex");
    if (checksum !== payload.sha256) throw new Error("recovery_sample_checksum_mismatch");
    restored.push({
      artifactId: artifact.artifactId,
      kind: artifact.kind,
      sourcePath: path,
      mediaType: mediaType(payload.mediaType),
      bytes,
      sha256: checksum,
    });
  }

  assertArtifactCoverage(restored);
  return {
    schemaVersion: bundle.schemaVersion,
    institutionId: bundle.institutionId,
    backupId: bundle.backupId,
    createdAt: bundle.createdAt,
    artifacts: restored,
  };
}

export async function restoreRecoverySampleBundleToDirectory({
  bundle,
  expectedInstitutionId,
  expectedBackupId,
  config,
  parentDirectory,
  restoreName,
}) {
  const normalizedRestoreName = restoreDirectoryName(restoreName);
  if (
    typeof parentDirectory !== "string" ||
    parentDirectory.length < 1 ||
    parentDirectory.length > 4096 ||
    /[\u0000-\u001f\u007f]/.test(parentDirectory)
  ) {
    throw new Error("recovery_sample_parent_directory_invalid");
  }

  // The complete bundle is authenticated before the first filesystem write.
  const restored = verifyRecoverySampleBundle({
    bundle,
    expectedInstitutionId,
    expectedBackupId,
    config,
  });

  const resolvedParentDirectory = await realpath(parentDirectory);
  const parentStats = await stat(resolvedParentDirectory);
  if (!parentStats.isDirectory()) {
    throw new Error("recovery_sample_parent_directory_invalid");
  }

  const targetDirectory = resolve(resolvedParentDirectory, normalizedRestoreName);
  assertInsideDirectory(
    resolvedParentDirectory,
    targetDirectory,
    "recovery_sample_restore_path_invalid"
  );
  const lockPath = join(resolvedParentDirectory, `.${normalizedRestoreName}.restore.lock`);
  assertInsideDirectory(
    resolvedParentDirectory,
    lockPath,
    "recovery_sample_restore_path_invalid"
  );

  let lockHandle;
  let temporaryDirectory;
  try {
    try {
      lockHandle = await open(lockPath, "wx", 0o600);
    } catch (error) {
      if (error?.code === "EEXIST") throw new Error("recovery_sample_restore_locked");
      throw error;
    }

    if (await pathExists(targetDirectory)) {
      throw new Error("recovery_sample_restore_target_exists");
    }

    temporaryDirectory = await mkdtemp(join(resolvedParentDirectory, ".lyceegest-restore-"));
    assertInsideDirectory(
      resolvedParentDirectory,
      temporaryDirectory,
      "recovery_sample_temporary_path_invalid"
    );

    const aggregateHash = createHash("sha256");
    let databaseArtifactCount = 0;
    let storageArtifactCount = 0;
    let totalBytes = 0;

    for (const artifact of restored.artifacts) {
      const destinationPath = resolve(
        temporaryDirectory,
        artifact.kind,
        ...artifact.sourcePath.split("/")
      );
      assertInsideDirectory(
        temporaryDirectory,
        destinationPath,
        "recovery_sample_restore_path_invalid"
      );
      await mkdir(dirname(destinationPath), { recursive: true, mode: 0o700 });
      await writeFile(destinationPath, artifact.bytes, { flag: "wx", mode: 0o600 });

      const writtenBytes = await readFile(destinationPath);
      const writtenChecksum = createHash("sha256").update(writtenBytes).digest("hex");
      if (writtenBytes.length !== artifact.bytes.length || writtenChecksum !== artifact.sha256) {
        throw new Error("recovery_sample_restore_verification_failed");
      }

      totalBytes += writtenBytes.length;
      if (artifact.kind === "database") databaseArtifactCount += 1;
      if (artifact.kind === "storage") storageArtifactCount += 1;
      aggregateHash.update(
        `${artifact.kind}\0${artifact.sourcePath}\0${artifact.sha256}\0${writtenBytes.length}\n`,
        "utf8"
      );
    }

    if (await pathExists(targetDirectory)) {
      throw new Error("recovery_sample_restore_target_exists");
    }
    await rename(temporaryDirectory, targetDirectory);
    temporaryDirectory = undefined;

    return {
      schemaVersion: restored.schemaVersion,
      institutionId: restored.institutionId,
      backupId: restored.backupId,
      createdAt: restored.createdAt,
      restoreName: normalizedRestoreName,
      artifactCount: restored.artifacts.length,
      databaseArtifactCount,
      storageArtifactCount,
      totalBytes,
      aggregateSha256: aggregateHash.digest("hex"),
    };
  } finally {
    try {
      await removeOwnedTemporaryDirectory(resolvedParentDirectory, temporaryDirectory);
    } finally {
      if (lockHandle) {
        try {
          await lockHandle.close();
        } finally {
          await unlink(lockPath).catch((error) => {
            if (error?.code !== "ENOENT") throw error;
          });
        }
      }
    }
  }
}
