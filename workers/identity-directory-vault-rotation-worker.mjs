import postgres from "postgres";
import {
  IDENTITY_VAULT_ROTATION_MAX_ROWS,
  identityVaultConfig,
  rotateIdentityVaultBatch,
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

function rotationLimit(value) {
  const parsed = Number.parseInt(value ?? "100", 10);
  if (
    String(parsed) !== String(value ?? "100") ||
    parsed < 1 ||
    parsed > IDENTITY_VAULT_ROTATION_MAX_ROWS
  ) {
    throw new Error("identity_vault_rotation_batch_limit_invalid");
  }
  return parsed;
}

function boundedError(error) {
  const message = error instanceof Error ? error.message : "";
  return /^identity_vault_[a-z0-9_]+$/.test(message)
    ? message
    : "identity_vault_rotation_failed";
}

if (process.env.IDENTITY_VAULT_ROTATION_ENABLED !== "true") {
  throw new Error("IDENTITY_VAULT_ROTATION_ENABLED must be true");
}
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");
const institutionId = uuid(
  process.env.IDENTITY_VAULT_ROTATION_INSTITUTION_ID,
  "identity_vault_rotation_institution_invalid"
);
const importId = uuid(
  process.env.IDENTITY_VAULT_ROTATION_IMPORT_ID,
  "identity_vault_rotation_import_invalid"
);
const batchLimit = rotationLimit(process.env.IDENTITY_VAULT_ROTATION_BATCH_LIMIT);
const targetConfig = identityVaultConfig();
const sql = postgres(databaseUrl, { prepare: false, max: 1, idle_timeout: 20 });

async function rotateOneBatch() {
  return sql.begin(async (transaction) => {
    await transaction`
      select pg_advisory_xact_lock(
        hashtextextended(${`identity-vault:${institutionId}`}, 74219)
      )
    `;
    const sourceRows = await transaction`
      select id::text as id, institution_id, import_id, person_ref,
             key_version, payload_schema, iv, auth_tag, ciphertext
      from public.identity_directory_private_rows
      where institution_id = ${institutionId}::uuid
        and import_id = ${importId}::uuid
        and key_version <> ${targetConfig.version}
      order by id
      limit ${batchLimit}
      for update skip locked
    `;
    if (sourceRows.length === 0) {
      const [remaining] = await transaction`
        select count(*)::integer as count
        from public.identity_directory_private_rows
        where institution_id = ${institutionId}::uuid
          and import_id = ${importId}::uuid
          and key_version <> ${targetConfig.version}
      `;
      return {
        targetVersion: targetConfig.version,
        rotatedCount: 0,
        sourceVersions: {},
        remainingCount: Number(remaining.count),
      };
    }

    const batch = rotateIdentityVaultBatch({
      rows: sourceRows.map((row) => ({
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
      })),
      targetConfig,
      batchLimit,
    });

    for (let index = 0; index < batch.rows.length; index += 1) {
      const source = sourceRows[index];
      const rotated = batch.rows[index];
      const updated = await transaction`
        update public.identity_directory_private_rows
        set key_version = ${rotated.envelope.keyVersion},
            payload_schema = ${rotated.envelope.payloadSchema},
            iv = ${rotated.envelope.iv},
            auth_tag = ${rotated.envelope.authTag},
            ciphertext = ${rotated.envelope.ciphertext}
        where id = ${source.id}::bigint
          and institution_id = ${institutionId}::uuid
          and import_id = ${importId}::uuid
          and key_version = ${source.key_version}
          and iv = ${source.iv}
          and auth_tag = ${source.auth_tag}
          and ciphertext = ${source.ciphertext}
        returning id
      `;
      if (updated.length !== 1) throw new Error("identity_vault_rotation_state_changed");
    }

    const [remaining] = await transaction`
      select count(*)::integer as count
      from public.identity_directory_private_rows
      where institution_id = ${institutionId}::uuid
        and import_id = ${importId}::uuid
        and key_version <> ${targetConfig.version}
    `;
    const summary = {
      targetVersion: batch.targetVersion,
      rotatedCount: batch.rotatedCount,
      sourceVersions: batch.sourceVersions,
      remainingCount: Number(remaining.count),
    };
    await transaction`
      insert into public.identity_directory_audit (
        institution_id, resource_type, resource_id, action, actor_id, summary
      ) values (
        ${institutionId}::uuid, 'import', ${importId}::uuid,
        'rotate_vault_batch', null, ${transaction.json(summary)}
      )
    `;
    return summary;
  });
}

rotateOneBatch()
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
