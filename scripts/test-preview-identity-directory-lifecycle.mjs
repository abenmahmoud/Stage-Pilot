import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import WebSocket from "ws";

const confirmation = process.env.IDENTITY_DIRECTORY_TEST_CONFIRM;
const expectedProjectRef = process.env.IDENTITY_DIRECTORY_EXPECTED_PROJECT_REF;
const databaseUrl = process.env.DATABASE_URL;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (confirmation !== "preview-only") {
  throw new Error("Set IDENTITY_DIRECTORY_TEST_CONFIRM=preview-only");
}
if (!expectedProjectRef || !/^[a-z]{20}$/.test(expectedProjectRef)) {
  throw new Error("IDENTITY_DIRECTORY_EXPECTED_PROJECT_REF is required");
}
if (!databaseUrl || !databaseUrl.includes(expectedProjectRef)) {
  throw new Error("DATABASE_URL does not match the expected preview project");
}
if (!supabaseUrl || new URL(supabaseUrl).hostname !== `${expectedProjectRef}.supabase.co`) {
  throw new Error("SUPABASE_URL does not match the expected preview project");
}
if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required");

const sql = postgres(databaseUrl, { prepare: false, max: 2, idle_timeout: 20 });
const storage = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: { transport: WebSocket },
}).storage;
const runId = randomUUID();
const marker = runId.slice(0, 8);
const bucket = "identity-ingest";
const paths = [];
let institutionId;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function actorId() {
  const [actor] = await sql`
    select user_id
    from public.institution_memberships
    where status = 'active'
    order by created_at
    limit 1
  `;
  if (!actor) throw new Error("No active preview actor found");
  return actor.user_id;
}

async function createReviewedImport(actor, suffix) {
  const importId = randomUUID();
  const path = `${institutionId}/lifecycle-test/${runId}/${suffix}.csv`;
  const bytes = Buffer.from(
    "record_type,person_ref,person_type,first_name,last_name\nperson,TEST-001,student,Test,Personne\n",
    "utf8"
  );
  const { error } = await storage.from(bucket).upload(path, bytes, {
    contentType: "text/csv",
    upsert: false,
  });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  paths.push(path);

  await sql.begin(async (tx) => {
    await tx`
      insert into public.identity_directory_imports (
        id, institution_id, title, purpose_description, source_type,
        original_name, mime_type, size_bytes, storage_bucket, storage_path,
        checksum, status, row_count, valid_row_count, rejected_row_count,
        validation_summary, uploaded_by, uploaded_at
      ) values (
        ${importId}, ${institutionId}, ${`[TEST] Cycle ${suffix}`},
        'Recette automatisée avec données entièrement fictives sur la preview uniquement.',
        'csv', ${`${suffix}.csv`}, 'text/csv', ${bytes.length}, ${bucket}, ${path},
        ${"a".repeat(64)}, 'review', 1, 1, 0,
        ${tx.json({ antivirus: "clamav_clean", readyForApproval: true })}, ${actor}, now()
      )
    `;
    await tx`
      insert into public.identity_directory_rows (
        institution_id, import_id, source_sheet, row_number, record_type,
        person_ref, person_type, validation_status, issues, fingerprint
      ) values (
        ${institutionId}, ${importId}, 'CSV', 2, 'person',
        ${`TEST-${suffix.toUpperCase()}-${marker}`}, 'student', 'valid', '[]'::jsonb,
        ${`${"b".repeat(56)}${marker}`}
      )
    `;
  });
  return importId;
}

async function approve(importId, actor) {
  const [updated] = await sql`
    update public.identity_directory_imports
    set status = 'approved', approved_by = ${actor}, approved_at = now()
    where id = ${importId} and institution_id = ${institutionId}
      and status = 'review' and rejected_row_count = 0
    returning id
  `;
  assert(updated, "Review did not reach approved");
  await sql`
    insert into public.identity_directory_audit (
      institution_id, resource_type, resource_id, action, actor_id, summary
    ) values (
      ${institutionId}, 'import', ${importId}, 'approve', ${actor},
      ${sql.json({ test: true, justification: "Contrôle fictif automatisé du rapport avant activation." })}
    )
  `;
}

async function activate(importId, actor) {
  await sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(hashtextextended(${institutionId}::text, 934821))`;
    const previous = await tx`
      select id from public.identity_directory_imports
      where institution_id = ${institutionId} and status = 'active'
    `;
    await tx`
      update public.identity_directory_imports
      set status = 'superseded'
      where institution_id = ${institutionId} and status = 'active'
    `;
    for (const entry of previous) {
      await tx`
        insert into public.identity_directory_audit (
          institution_id, resource_type, resource_id, action, actor_id, summary
        ) values (
          ${institutionId}, 'import', ${entry.id}, 'supersede', ${actor},
          ${tx.json({ replacementImportId: importId, test: true })}
        )
      `;
    }
    const [updated] = await tx`
      update public.identity_directory_imports
      set status = 'active', activated_at = now()
      where id = ${importId} and institution_id = ${institutionId} and status = 'approved'
      returning id
    `;
    assert(updated, "Approved version did not reach active");
    await tx`
      insert into public.identity_directory_audit (
        institution_id, resource_type, resource_id, action, actor_id, summary
      ) values (
        ${institutionId}, 'import', ${importId}, 'activate', ${actor},
        ${tx.json({ test: true, justification: "Activation fictive automatisée avec remplacement contrôlé." })}
      )
    `;
  });
}

async function retire(importId, actor) {
  await sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(hashtextextended(${institutionId}::text, 934821))`;
    const [candidate] = await tx`
      select storage_path, status
      from public.identity_directory_imports
      where id = ${importId} and institution_id = ${institutionId}
    `;
    assert(candidate?.status === "superseded", "Only the replaced test version may be retired");
    const dependencies = await tx`
      select
        (select count(*)::int from public.school_identities where source_import_id = ${importId}) as identities,
        (select count(*)::int from public.school_relationships where source_import_id = ${importId}) as relationships
    `;
    assert(
      dependencies[0].identities === 0 && dependencies[0].relationships === 0,
      "Replaced version still has dependencies"
    );
    const { error } = await storage.from(bucket).remove([candidate.storage_path]);
    if (error) throw new Error(`Storage removal failed: ${error.message}`);
    await tx`delete from public.identity_directory_rows where import_id = ${importId}`;
    const [updated] = await tx`
      update public.identity_directory_imports
      set status = 'retired', retired_by = ${actor}, retired_at = now(),
        retirement_reason = 'Version fictive remplacée puis retirée par la recette automatisée.',
        checksum = null,
        validation_summary = ${tx.json({ retired: true, privateFileRemoved: true, quarantineRowsRemoved: 1 })}
      where id = ${importId} and institution_id = ${institutionId} and status = 'superseded'
      returning id
    `;
    assert(updated, "Superseded version did not reach retired");
    await tx`
      insert into public.identity_directory_audit (
        institution_id, resource_type, resource_id, action, actor_id, summary
      ) values (
        ${institutionId}, 'import', ${importId}, 'retire', ${actor},
        ${tx.json({ test: true, privateFileRemoved: true, quarantineRowsRemoved: 1 })}
      )
    `;
  });
}

async function cleanup() {
  if (paths.length > 0) await storage.from(bucket).remove(paths);
  if (institutionId) await sql`delete from public.institutions where id = ${institutionId}`;
}

try {
  const actor = await actorId();
  const [institution] = await sql`
    insert into public.institutions (slug, name, status)
    values (${`test-identity-lifecycle-${marker}`}, '[TEST] Identity lifecycle', 'draft')
    returning id
  `;
  institutionId = institution.id;

  const first = await createReviewedImport(actor, "first");
  await approve(first, actor);
  await activate(first, actor);

  const second = await createReviewedImport(actor, "second");
  await approve(second, actor);
  await activate(second, actor);

  const versions = await sql`
    select id, status from public.identity_directory_imports
    where institution_id = ${institutionId}
    order by created_at
  `;
  assert(versions.find((entry) => entry.id === first)?.status === "superseded", "First version was not replaced");
  assert(versions.find((entry) => entry.id === second)?.status === "active", "Second version is not active");
  assert(versions.filter((entry) => entry.status === "active").length === 1, "Active version is not unique");

  let inactiveSourceBlocked = false;
  try {
    await sql`
      insert into public.school_identities (
        institution_id, user_id, source_import_id, person_type,
        official_person_ref, assurance_level, verified_by
      ) values (
        ${institutionId}, ${actor}, ${first}, 'student',
        ${`TEST-INACTIVE-${marker}`}, 'directory_matched', ${actor}
      )
    `;
  } catch (error) {
    inactiveSourceBlocked = error?.code === "23514";
  }
  assert(inactiveSourceBlocked, "A replaced source was accepted for a new school identity");

  await retire(first, actor);
  const [retired] = await sql`
    select status, retirement_reason,
      (select count(*)::int from public.identity_directory_rows where import_id = ${first}) as rows,
      (select count(*)::int from public.identity_directory_audit where resource_id = ${first} and action = 'retire') as audits
    from public.identity_directory_imports where id = ${first}
  `;
  assert(retired.status === "retired", "Replaced version is not retired");
  assert(retired.rows === 0 && retired.audits === 1, "Retirement proof or row cleanup is incomplete");
  const { data: retiredFiles, error: listError } = await storage
    .from(bucket)
    .list(`${institutionId}/lifecycle-test/${runId}`, { search: "first.csv" });
  if (listError) throw new Error(`Storage verification failed: ${listError.message}`);
  assert(!retiredFiles.some((file) => file.name === "first.csv"), "Retired private file still exists");

  console.log(JSON.stringify({
    reviewApproved: 2,
    activeVersions: 1,
    replacedVersions: 1,
    retiredVersions: 1,
    inactiveSourceBlocked,
    privateFileRemoved: true,
    quarantineRowsRemoved: retired.rows === 0,
  }));
} finally {
  await cleanup();
  const [leftovers] = await sql`
    select
      (select count(*)::int from public.institutions where slug = ${`test-identity-lifecycle-${marker}`}) as institutions,
      (select count(*)::int from public.identity_directory_imports where title like '[TEST] Cycle %') as imports
  `;
  console.log(JSON.stringify({ cleanup: leftovers }));
  await sql.end({ timeout: 5 });
}
