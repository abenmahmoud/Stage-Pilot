import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { promisify } from "node:util";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import WebSocket from "ws";
import {
  IdentityDirectoryParseError,
  parseIdentityDirectoryBytes,
} from "./identity-directory-parser.mjs";
import {
  encryptIdentityVaultPayload,
  identityVaultConfig,
} from "./identity-directory-vault.mjs";

const execFileAsync = promisify(execFile);
const databaseUrl = process.env.DATABASE_URL;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const contactPepper = process.env.IDENTITY_CONTACT_PEPPER;
if (!databaseUrl || !supabaseUrl || !serviceRoleKey || !contactPepper) {
  throw new Error(
    "DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and IDENTITY_CONTACT_PEPPER are required"
  );
}
if (contactPepper.length < 32) throw new Error("IDENTITY_CONTACT_PEPPER is too short");
const vaultConfig = identityVaultConfig();

const sql = postgres(databaseUrl, { prepare: false, max: 2, idle_timeout: 20 });
const storage = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: { transport: WebSocket },
}).storage;

function safeName(value) {
  return basename(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .slice(-90) || "repertoire";
}

async function clamScan(bytes, name) {
  const directory = await mkdtemp(join(tmpdir(), "lyceegest-identity-"));
  const filePath = join(directory, safeName(name));
  try {
    await writeFile(filePath, bytes, { flag: "wx" });
    try {
      await execFileAsync(
        process.env.CLAMDSCAN_PATH ?? "clamdscan",
        ["--stream", "--no-summary", filePath],
        { timeout: 120000, windowsHide: true }
      );
      return "clean";
    } catch (error) {
      if (error && typeof error === "object" && error.code === 1) return "blocked";
      throw new Error("antivirus_unavailable");
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function loadImport(job) {
  const [directoryImport] = await sql`
    select id, institution_id, original_name, mime_type, size_bytes,
           storage_bucket, storage_path, status
    from public.identity_directory_imports
    where id = ${job.import_id} and institution_id = ${job.institution_id}
    limit 1
  `;
  if (!directoryImport) throw new Error("identity_import_not_found");
  if (["review", "approved", "active", "superseded"].includes(directoryImport.status)) {
    return { directoryImport, duplicate: true };
  }
  if (!["uploaded", "quarantined", "parsing"].includes(directoryImport.status)) {
    throw new Error("identity_import_not_processable");
  }
  const { data, error } = await storage
    .from(directoryImport.storage_bucket)
    .download(directoryImport.storage_path);
  if (error || !data) throw new Error("identity_storage_download_failed");
  const bytes = Buffer.from(await data.arrayBuffer());
  if (bytes.length !== Number(directoryImport.size_bytes)) {
    throw new IdentityDirectoryParseError("size_mismatch", "Taille différente du dépôt annoncé");
  }
  return { directoryImport, bytes, duplicate: false };
}

function databaseRows(parsed, directoryImport, json) {
  return parsed.rows.map((row) => ({
    institution_id: directoryImport.institution_id,
    import_id: directoryImport.id,
    source_sheet: row.sheetName,
    row_number: row.rowNumber,
    record_type: row.recordType,
    person_ref: row.personRef,
    person_type: row.personType,
    subject_person_ref: row.subjectPersonRef,
    relationship_type: row.relationshipType,
    object_ref: row.objectRef,
    class_ref: row.classRef,
    service_code: row.serviceCode,
    academic_email_hash: row.academicEmailHash,
    personal_email_hash: row.personalEmailHash,
    phone_hash: row.phoneHash,
    valid_from: row.validFrom,
    valid_until: row.validUntil,
    validation_status: row.validationStatus,
    issues: json(row.issues),
    fingerprint: row.fingerprint,
  }));
}

function privateDatabaseRows(parsed, directoryImport) {
  return parsed.privateRows.map((row) => {
    const envelope = encryptIdentityVaultPayload({
      value: row.value,
      institutionId: directoryImport.institution_id,
      importId: directoryImport.id,
      personRef: row.personRef,
      config: vaultConfig,
    });
    return {
      institution_id: directoryImport.institution_id,
      import_id: directoryImport.id,
      person_ref: row.personRef,
      key_version: envelope.keyVersion,
      payload_schema: envelope.payloadSchema,
      iv: envelope.iv,
      auth_tag: envelope.authTag,
      ciphertext: envelope.ciphertext,
    };
  });
}

async function persistReport(directoryImport, parsed, msgId) {
  return sql.begin(async (transaction) => {
    const [lockedImport] = await transaction`
      select status
      from public.identity_directory_imports
      where id = ${directoryImport.id}
        and institution_id = ${directoryImport.institution_id}
      for update
    `;
    if (!lockedImport) throw new Error("identity_import_not_found");
    if (lockedImport.status !== "parsing") {
      if (["review", "approved", "active", "superseded"].includes(lockedImport.status)) {
        await transaction`select pgmq.delete('identity_directory_scan', ${msgId}::bigint)`;
        return false;
      }
      throw new Error("identity_import_not_processable");
    }
    const rows = databaseRows(parsed, directoryImport, (value) => transaction.json(value));
    const privateRows = privateDatabaseRows(parsed, directoryImport);
    await transaction`
      delete from public.identity_directory_rows where import_id = ${directoryImport.id}
    `;
    await transaction`
      delete from public.identity_directory_private_rows where import_id = ${directoryImport.id}
    `;
    for (let offset = 0; offset < rows.length; offset += 500) {
      const chunk = rows.slice(offset, offset + 500);
      await transaction`
        insert into public.identity_directory_rows ${transaction(
          chunk,
          "institution_id",
          "import_id",
          "source_sheet",
          "row_number",
          "record_type",
          "person_ref",
          "person_type",
          "subject_person_ref",
          "relationship_type",
          "object_ref",
          "class_ref",
          "service_code",
          "academic_email_hash",
          "personal_email_hash",
          "phone_hash",
          "valid_from",
          "valid_until",
          "validation_status",
          "issues",
          "fingerprint"
        )}
      `;
    }
    for (let offset = 0; offset < privateRows.length; offset += 250) {
      const chunk = privateRows.slice(offset, offset + 250);
      await transaction`
        insert into public.identity_directory_private_rows ${transaction(
          chunk,
          "institution_id",
          "import_id",
          "person_ref",
          "key_version",
          "payload_schema",
          "iv",
          "auth_tag",
          "ciphertext"
        )}
      `;
    }
    await transaction`
      update public.identity_directory_imports
      set status = 'review', checksum = ${parsed.checksum},
          row_count = ${parsed.summary.rowCount},
          valid_row_count = ${parsed.summary.validRowCount},
          rejected_row_count = ${parsed.summary.rejectedRowCount},
          validation_summary = ${transaction.json({
            ...parsed.summary,
            antivirus: "clamav_clean",
            encryptedPersonCount: privateRows.length,
            vaultSchemaVersion: 1,
            vaultKeyVersion: vaultConfig.version,
          })}
      where id = ${directoryImport.id} and institution_id = ${directoryImport.institution_id}
    `;
    await transaction`
      insert into public.identity_directory_audit (
        institution_id, resource_type, resource_id, action, actor_id, summary
      ) values (
        ${directoryImport.institution_id}, 'import', ${directoryImport.id},
        'complete_parse', null,
        ${transaction.json({
          checksum: parsed.checksum,
          rowCount: parsed.summary.rowCount,
          rejectedRowCount: parsed.summary.rejectedRowCount,
          warningRowCount: parsed.summary.warningRowCount,
          encryptedPersonCount: privateRows.length,
          vaultKeyVersion: vaultConfig.version,
        })}
      )
    `;
    await transaction`select pgmq.delete('identity_directory_scan', ${msgId}::bigint)`;
    return true;
  });
}

async function rejectThreat(directoryImport, msgId) {
  await storage.from(directoryImport.storage_bucket).remove([directoryImport.storage_path]);
  await sql.begin(async (transaction) => {
    await transaction`
      update public.identity_directory_imports
      set status = 'rejected', validation_summary = ${transaction.json({
        antivirus: "blocked",
        reason: "antivirus_detected_threat",
      })}
      where id = ${directoryImport.id} and institution_id = ${directoryImport.institution_id}
    `;
    await transaction`
      insert into public.identity_directory_audit (
        institution_id, resource_type, resource_id, action, actor_id, summary
      ) values (
        ${directoryImport.institution_id}, 'import', ${directoryImport.id},
        'reject_upload', null, ${transaction.json({ reason: "antivirus_detected_threat" })}
      )
    `;
    await transaction`select pgmq.delete('identity_directory_scan', ${msgId}::bigint)`;
  });
}

async function markDeterministicFailure(directoryImport, msgId, code) {
  await sql.begin(async (transaction) => {
    await transaction`
      update public.identity_directory_imports
      set status = 'failed', validation_summary = ${transaction.json({ reason: code })}
      where id = ${directoryImport.id} and institution_id = ${directoryImport.institution_id}
    `;
    await transaction`
      insert into public.identity_directory_audit (
        institution_id, resource_type, resource_id, action, actor_id, summary
      ) values (
        ${directoryImport.institution_id}, 'import', ${directoryImport.id},
        'complete_parse', null, ${transaction.json({ result: "failed", reason: code })}
      )
    `;
    await transaction`select pgmq.delete('identity_directory_scan', ${msgId}::bigint)`;
  });
}

async function processMessage(row) {
  const job = typeof row.message === "string" ? JSON.parse(row.message) : row.message;
  if (
    !job?.job_id ||
    job?.job_type !== "scan_identity_directory" ||
    !job?.import_id ||
    !job?.institution_id
  ) {
    await sql`select pgmq.archive('identity_directory_scan', ${row.msg_id}::bigint)`;
    return "invalid_job_archived";
  }

  let loaded;
  try {
    loaded = await loadImport(job);
    if (loaded.duplicate) {
      await sql`select pgmq.delete('identity_directory_scan', ${row.msg_id}::bigint)`;
      return "duplicate";
    }
    await sql`
      update public.identity_directory_imports set status = 'quarantined'
      where id = ${loaded.directoryImport.id}
        and status in ('uploaded', 'quarantined', 'parsing')
    `;
    const scan = await clamScan(loaded.bytes, loaded.directoryImport.original_name);
    if (scan === "blocked") {
      await rejectThreat(loaded.directoryImport, row.msg_id);
      return "blocked";
    }
    await sql`
      update public.identity_directory_imports set status = 'parsing'
      where id = ${loaded.directoryImport.id} and status = 'quarantined'
    `;
    const parsed = parseIdentityDirectoryBytes({
      bytes: loaded.bytes,
      fileName: loaded.directoryImport.original_name,
      contactPepper,
    });
    const persisted = await persistReport(loaded.directoryImport, parsed, row.msg_id);
    return persisted ? "review" : "duplicate";
  } catch (error) {
    const code = error instanceof IdentityDirectoryParseError
      ? error.code
      : error instanceof Error
        ? error.message.slice(0, 120)
        : "unknown_error";
    if (loaded?.directoryImport && error instanceof IdentityDirectoryParseError) {
      await markDeterministicFailure(loaded.directoryImport, row.msg_id, code);
      return "failed";
    }
    if (loaded?.directoryImport && row.read_ct >= 5) {
      await markDeterministicFailure(loaded.directoryImport, row.msg_id, code);
      return "failed";
    }
    if (loaded?.directoryImport) {
      await sql`
        update public.identity_directory_imports set status = 'quarantined'
        where id = ${loaded.directoryImport.id} and status = 'parsing'
      `;
    }
    return "retrying";
  }
}

async function main() {
  const rows = await sql`
    select msg_id, read_ct, message
    from pgmq.read('identity_directory_scan', 300, 2)
  `;
  const outcomes = [];
  for (const row of rows) outcomes.push(await processMessage(row));
  console.log(JSON.stringify({ claimed: rows.length, outcomes }));
  await sql.end();
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : "identity_directory_worker_failed");
  await sql.end({ timeout: 1 });
  process.exitCode = 1;
});
