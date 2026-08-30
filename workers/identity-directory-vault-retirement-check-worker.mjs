import { createHash } from "node:crypto";
import postgres from "postgres";
import {
  IDENTITY_VAULT_ROTATION_MAX_ROWS,
  identityVaultConfig,
  verifyIdentityVaultKeyRetirement,
} from "./identity-directory-vault.mjs";

function uuid(value, code) {
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  ) {
    throw new Error(code);
  }
  return value.toLowerCase();
}

function boundedInteger(value, fallback, minimum, maximum, code) {
  const raw = value ?? String(fallback);
  if (!/^[1-9][0-9]*$/.test(raw)) throw new Error(code);
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(code);
  }
  return parsed;
}

function retiredKeyVersions(value) {
  if (typeof value !== "string" || value.length < 2 || value.length > 119) {
    throw new Error("identity_vault_retired_versions_invalid");
  }
  const versions = value.split(",").map((entry) => entry.trim());
  if (
    versions.length < 1 ||
    versions.length > 20 ||
    versions.some((version) => !/^v[1-9][0-9]{0,3}$/.test(version)) ||
    new Set(versions).size !== versions.length
  ) {
    throw new Error("identity_vault_retired_versions_invalid");
  }
  return versions;
}

function boundedError(error) {
  const message = error instanceof Error ? error.message : "";
  return /^identity_vault_[a-z0-9_]+$/.test(message)
    ? message
    : "identity_vault_retirement_check_failed";
}

if (process.env.IDENTITY_VAULT_RETIREMENT_CHECK_ENABLED !== "true") {
  throw new Error("IDENTITY_VAULT_RETIREMENT_CHECK_ENABLED must be true");
}
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");
const institutionId = uuid(
  process.env.IDENTITY_VAULT_RETIREMENT_INSTITUTION_ID,
  "identity_vault_retirement_institution_invalid"
);
const batchLimit = boundedInteger(
  process.env.IDENTITY_VAULT_RETIREMENT_BATCH_LIMIT,
  100,
  1,
  IDENTITY_VAULT_ROTATION_MAX_ROWS,
  "identity_vault_retirement_batch_limit_invalid"
);
const maxRows = boundedInteger(
  process.env.IDENTITY_VAULT_RETIREMENT_MAX_ROWS,
  25_000,
  1,
  25_000,
  "identity_vault_retirement_max_rows_invalid"
);
const retiredVersions = retiredKeyVersions(
  process.env.IDENTITY_VAULT_RETIRED_KEY_VERSIONS
);
const targetConfig = identityVaultConfig();
const sql = postgres(databaseUrl, { prepare: false, max: 1, idle_timeout: 20 });

async function verifyInstitutionVault() {
  return sql.begin("isolation level repeatable read read only", async (transaction) => {
    await transaction`
      select pg_advisory_xact_lock(
        hashtextextended(${`identity-vault:${institutionId}`}, 74219)
      )
    `;
    const [counts] = await transaction`
      select count(*)::integer as total_count,
             count(*) filter (
               where key_version <> ${targetConfig.version}
             )::integer as incomplete_count
      from public.identity_directory_private_rows
      where institution_id = ${institutionId}::uuid
    `;
    const totalCount = Number(counts.total_count);
    if (!Number.isSafeInteger(totalCount) || totalCount < 1) {
      throw new Error("identity_vault_retirement_scope_empty");
    }
    if (totalCount > maxRows) throw new Error("identity_vault_retirement_scope_too_large");
    if (Number(counts.incomplete_count) !== 0) {
      throw new Error("identity_vault_rotation_incomplete");
    }

    let lastId = "0";
    let verifiedCount = 0;
    let batchCount = 0;
    const evidence = createHash("sha256");
    while (verifiedCount < totalCount) {
      const rows = await transaction`
        select id::text as id, institution_id, import_id, person_ref,
               key_version, payload_schema, iv, auth_tag, ciphertext
        from public.identity_directory_private_rows
        where institution_id = ${institutionId}::uuid
          and id > ${lastId}::bigint
        order by id
        limit ${batchLimit}
      `;
      if (rows.length === 0) throw new Error("identity_vault_retirement_snapshot_changed");

      const rowsByImport = new Map();
      for (const row of rows) {
        const group = rowsByImport.get(row.import_id) ?? [];
        group.push({
          id: row.id,
          institutionId: row.institution_id,
          importId: row.import_id,
          personRef: row.person_ref,
          envelope: {
            keyVersion: row.key_version,
            payloadSchema: row.payload_schema,
            iv: row.iv,
            authTag: row.auth_tag,
            ciphertext: row.ciphertext,
          },
        });
        rowsByImport.set(row.import_id, group);
      }
      for (const [importId, importRows] of rowsByImport) {
        const proof = verifyIdentityVaultKeyRetirement({
          rows: importRows,
          institutionId,
          importId,
          targetConfig,
          retiredVersions,
          env: process.env,
          batchLimit,
        });
        evidence.update(proof.evidenceDigest);
      }
      lastId = rows.at(-1).id;
      verifiedCount += rows.length;
      batchCount += 1;
    }
    if (verifiedCount !== totalCount) {
      throw new Error("identity_vault_retirement_count_mismatch");
    }
    return {
      targetVersion: targetConfig.version,
      retiredVersions: [...retiredVersions].sort((left, right) =>
        Number.parseInt(left.slice(1), 10) - Number.parseInt(right.slice(1), 10)
      ),
      verifiedCount,
      batchCount,
      evidenceDigest: evidence.digest("hex"),
    };
  });
}

verifyInstitutionVault()
  .then((summary) => {
    console.log(JSON.stringify(summary));
  })
  .catch((error) => {
    console.error(boundedError(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await sql.end({ timeout: 5 });
  });
