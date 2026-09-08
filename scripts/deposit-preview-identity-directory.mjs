import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import WebSocket from "ws";

const defaultParserPath = fileURLToPath(
  new URL("../workers/identity-directory-parser.mjs", import.meta.url)
);
const defaultVerificationPath = fileURLToPath(
  new URL("../workers/identity-directory-verification-report.mjs", import.meta.url)
);
const { parseIdentityDirectoryBytes } = await import(
  pathToFileURL(process.env.IDENTITY_DIRECTORY_PARSER_PATH ?? defaultParserPath).href
);
const { verifyIdentityDirectoryReport } = await import(
  pathToFileURL(process.env.IDENTITY_DIRECTORY_VERIFICATION_PATH ?? defaultVerificationPath).href
);

const confirmation = process.env.IDENTITY_DIRECTORY_DEPOSIT_CONFIRM;
const expectedProjectRef = process.env.IDENTITY_DIRECTORY_EXPECTED_PROJECT_REF;
const databaseUrl = process.env.DATABASE_URL;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const contactPepper = process.env.IDENTITY_CONTACT_PEPPER;
const inputPath = process.argv[2];
const reportPath = process.argv[3];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(confirmation === "preview-real-authorized", "Explicit preview deposit confirmation is required");
assert(expectedProjectRef && /^[a-z]{20}$/.test(expectedProjectRef), "Expected preview project ref is required");
assert(databaseUrl?.includes(expectedProjectRef), "DATABASE_URL does not match the expected preview project");
assert(
  supabaseUrl && new URL(supabaseUrl).hostname === `${expectedProjectRef}.supabase.co`,
  "SUPABASE_URL does not match the expected preview project"
);
assert(serviceRoleKey, "SUPABASE_SERVICE_ROLE_KEY is required");
assert(contactPepper?.length >= 32, "IDENTITY_CONTACT_PEPPER is required");
assert(inputPath && reportPath, "Directory file and verification report paths are required");

const bytes = await readFile(inputPath);
const reportBytes = await readFile(reportPath);
const extension = extname(inputPath).toLowerCase();
assert(extension === ".csv" || extension === ".xlsx", "Directory file must be CSV or XLSX");

const parsed = parseIdentityDirectoryBytes({
  bytes,
  fileName: basename(inputPath),
  contactPepper,
});
const verification = verifyIdentityDirectoryReport({ bytes: reportBytes, parsed });
assert(verification.matches, "Verification report does not match the directory file");
assert(parsed.summary.rowCount > 0, "Directory is empty");
assert(parsed.summary.rejectedRowCount === 0, "Directory contains rejected rows");
assert(parsed.summary.personCount > 0, "Directory contains no person record");
assert(parsed.summary.detectedCodeCount === 0, "Directory contains a forbidden access code");
assert(parsed.summary.forbiddenColumnCount === 0, "Directory contains a forbidden column");

const sql = postgres(databaseUrl, { prepare: false, max: 2, idle_timeout: 20 });
const storage = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: { transport: WebSocket },
}).storage;
const bucket = "identity-ingest";
const importId = randomUUID();
const jobId = randomUUID();
const uploadedPaths = [];
let rowInserted = false;

function safeOutput(value) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

try {
  const [actor] = await sql`
    select i.id as institution_id, m.user_id
    from public.institutions i
    join public.institution_memberships m on m.institution_id = i.id
    join auth.users u on u.id = m.user_id
    where i.slug = 'blaise-cendrars-sevran'
      and i.status in ('pilot', 'active')
      and m.status = 'active'
      and m.role = 'admin'
      and coalesce(u.raw_app_meta_data ->> 'role', '') in ('superadmin', 'proviseur')
    order by
      case coalesce(u.raw_app_meta_data ->> 'role', '') when 'superadmin' then 0 else 1 end,
      m.created_at
    limit 1
  `;
  assert(actor, "No active direction account can audit this deposit");

  const [sameFile] = await sql`
    select id, status, row_count, valid_row_count, rejected_row_count, validation_summary
    from public.identity_directory_imports
    where institution_id = ${actor.institution_id}
      and checksum = ${parsed.checksum}
      and status in ('review', 'approved', 'active', 'superseded', 'retired')
    order by created_at desc
    limit 1
  `;
  if (sameFile) {
    safeOutput({
      deposited: false,
      duplicate: true,
      importId: sameFile.id,
      status: sameFile.status,
      rowCount: sameFile.row_count,
      validRowCount: sameFile.valid_row_count,
      rejectedRowCount: sameFile.rejected_row_count,
      personCount: Number(sameFile.validation_summary?.personCount ?? 0),
    });
    process.exitCode = 0;
  } else {
    const year = new Date().getUTCFullYear();
    const month = String(new Date().getUTCMonth() + 1).padStart(2, "0");
    const folder = `${actor.institution_id}/${actor.user_id}/${year}/${month}`;
    const directoryStoragePath = `${folder}/${randomUUID()}${extension}`;
    const reportStoragePath = `${folder}/${randomUUID()}.txt`;
    const contentType = extension === ".csv"
      ? "text/csv"
      : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    const directoryUpload = await storage.from(bucket).upload(directoryStoragePath, bytes, {
      contentType,
      upsert: false,
    });
    if (directoryUpload.error) throw new Error(`Directory upload failed: ${directoryUpload.error.message}`);
    uploadedPaths.push(directoryStoragePath);

    const reportUpload = await storage.from(bucket).upload(reportStoragePath, reportBytes, {
      contentType: "text/plain",
      upsert: false,
    });
    if (reportUpload.error) throw new Error(`Report upload failed: ${reportUpload.error.message}`);
    uploadedPaths.push(reportStoragePath);

    await sql.begin(async (transaction) => {
      const verificationReport = {
        originalName: basename(reportPath),
        mimeType: "text/plain",
        sizeBytes: reportBytes.length,
        storageBucket: bucket,
        storagePath: reportStoragePath,
      };
      await transaction`
        insert into public.identity_directory_imports (
          id, institution_id, title, purpose_description, source_type,
          original_name, mime_type, size_bytes, storage_bucket, storage_path,
          status, uploaded_by, uploaded_at, validation_summary
        ) values (
          ${importId}, ${actor.institution_id},
          'Annuaire ENT + SIECLE — 9 septembre 2026',
          'Annuaire officiel 2026-2027 destiné uniquement à la vérification d’identité, aux liens responsables-élèves et à l’accès aux services autorisés du lycée.',
          'official_export', ${basename(inputPath)}, ${contentType}, ${bytes.length},
          ${bucket}, ${directoryStoragePath}, 'quarantined', ${actor.user_id}, now(),
          ${transaction.json({ antivirus: "pending", verificationReport })}
        )
      `;
      rowInserted = true;
      await transaction`
        insert into public.identity_directory_audit (
          institution_id, resource_type, resource_id, action, actor_id, summary
        ) values
          (
            ${actor.institution_id}, 'import', ${importId}, 'reserve_upload', ${actor.user_id},
            ${transaction.json({
              sourceType: "official_export",
              mimeType: contentType,
              sizeBytes: bytes.length,
              verificationReportRequired: true,
              channel: "authorized_secure_server_deposit",
            })}
          ),
          (
            ${actor.institution_id}, 'import', ${importId}, 'confirm_upload', ${actor.user_id},
            ${transaction.json({ mimeType: contentType, sizeBytes: bytes.length })}
          ),
          (
            ${actor.institution_id}, 'import', ${importId}, 'queue_scan', ${actor.user_id},
            ${transaction.json({ jobId })}
          )
      `;
      await transaction`
        select pgmq.send(
          'identity_directory_scan',
          jsonb_build_object(
            'job_id', ${jobId}::uuid,
            'job_type', 'scan_identity_directory',
            'institution_id', ${actor.institution_id}::uuid,
            'import_id', ${importId}::uuid,
            'attempt', 0
          )
        )
      `;
    });

    safeOutput({
      deposited: true,
      duplicate: false,
      importId,
      status: "quarantined",
      rowCount: parsed.summary.rowCount,
      personCount: parsed.summary.personCount,
      relationshipCount: parsed.summary.relationshipCount,
      rejectedRowCount: parsed.summary.rejectedRowCount,
      warningRowCount: parsed.summary.warningRowCount,
      verificationReportMatches: verification.matches,
      sourceChecksum: createHash("sha256").update(bytes).digest("hex"),
    });
  }
} catch (error) {
  if (rowInserted) {
    try {
      await sql`delete from public.identity_directory_audit where resource_id = ${importId}`;
      await sql`delete from public.identity_directory_imports where id = ${importId}`;
    } catch {}
  }
  if (uploadedPaths.length > 0) {
    try {
      await storage.from(bucket).remove(uploadedPaths);
    } catch {}
  }
  throw error;
} finally {
  await sql.end({ timeout: 5 });
}
