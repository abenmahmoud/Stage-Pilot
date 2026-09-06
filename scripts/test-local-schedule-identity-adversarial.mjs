// Hard-coded disposable loopback target; never inherits DATABASE_URL or loads .env.
//
// LOT 4 du plan du 6 septembre 2026 (`docs/operations/PLAN_DONNEES_REELLES_2026-09-06.md`) :
// recette adverse sur PostgreSQL réel jetable (pile Supabase locale), personnes
// et emploi du temps entièrement fictifs. Appelle les VRAIES fonctions du
// LOT 1 (`writeScheduleSlots`) et du LOT 2 (`readCoursesForDayForVerifiedIdentity`,
// `resolveVerifiedScheduleScope`), avec de VRAIS jetons Supabase Auth locaux
// (comme `scripts/test-local-knowledge-recall-adversarial.mjs`), pas des
// identités simulées.
//
// Points prouvés (texte exact du plan) :
//  1. un élève ne voit que sa classe et ses groupes ;
//  2. un parent ne voit que ses enfants rattachés ;
//  3. un membre d'un autre établissement ne voit rien ;
//  4. une version d'import retirée n'est plus lue ;
//  5. aucune coordonnée en clair n'est stockée ni renvoyée ;
//  6. aucun nom ne peut être cherché librement ;
//  7. le balayage anti-fuite ne trouve ni coordonnée ni code dans un journal,
//     une trace ou le contexte du modèle.

import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

if (process.argv.length !== 3 || process.argv[2] !== "--local-stack-only") {
  throw new Error("local_stack_confirmation_required");
}

const LOCAL_API_URL = "http://127.0.0.1:54321";
// Clés de démonstration publiques du CLI Supabase local (identiques sur toute
// pile locale par défaut) ; jamais des secrets réels.
const LOCAL_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const LOCAL_SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

process.env.DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
process.env.VITE_SUPABASE_URL = LOCAL_API_URL;
process.env.SUPABASE_SERVICE_ROLE_KEY = LOCAL_SERVICE_ROLE_KEY;

const marker = randomUUID().replaceAll("-", "").slice(0, 10);
const MARK = marker.toUpperCase();
const institutionSlugA = `edt-lot4-a-${marker}`;
const institutionSlugB = `edt-lot4-b-${marker}`;
process.env.SUPPORT_INSTITUTION_SLUG = institutionSlugA;

// --- Capture console.* dès maintenant : le balayage anti-fuite (point 7)
// porte sur tout ce que ce processus aurait pu journaliser, du début à la fin.
const capturedLogs = [];
const originalLog = console.log;
const originalError = console.error;
console.log = (...args) => {
  capturedLogs.push(args.map(String).join(" "));
};
console.error = (...args) => {
  capturedLogs.push(args.map(String).join(" "));
};

const [{ sql }, { db }, schema, { createClient }] = await Promise.all([
  import("drizzle-orm"),
  import("../db/index.js"),
  import("../db/schema.js"),
  import("@supabase/supabase-js"),
]);
const { readCoursesForDayForVerifiedIdentity } = await import(
  "../api/_shared/schedule-identity-reader.ts"
);
const { writeScheduleSlots } = await import("../api/_shared/schedule-slot-write.ts");
const { HttpError } = await import("../api/_shared/auth.ts");
const { parseIdentityLookupInput } = await import("../shared/identity-directory-lookup.ts");

let assertions = 0;
const check = (actual, expected, label) => {
  try {
    assert.deepEqual(actual, expected);
  } catch (error) {
    error.message = `${label ?? "check"}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)} — ${error.message}`;
    throw error;
  }
  assertions++;
};

const admin = createClient(LOCAL_API_URL, LOCAL_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function createFictionalActor(label, password) {
  const email = `edt-lot4-${marker}-${label}@example.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw new Error(`create_user_failed:${label}:${error.message}`);
  const anon = createClient(LOCAL_API_URL, LOCAL_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const signIn = await anon.auth.signInWithPassword({ email, password });
  if (signIn.error) throw new Error(`sign_in_failed:${label}:${signIn.error.message}`);
  return { id: data.user.id, email, token: signIn.data.session.access_token };
}

const fingerprintFor = (label) => createHash("sha256").update(`edt-lot4-${marker}-${label}`, "utf8").digest("hex");
const fakeAcademicEmail = `coord-marker-${marker}@example.test`;
const fakeAcademicEmailHash = createHash("sha256").update(fakeAcademicEmail, "utf8").digest("hex");

const institutionAId = randomUUID();
const institutionBId = randomUUID();
const importAId = randomUUID();
const importBId = randomUUID();
const actorId = randomUUID();
const studentIdentityId = randomUUID();
const guardianIdentityId = randomUUID();
const foreignIdentityId = randomUUID();

const STUDENT_REF = `STU1-LOT4-${MARK}`;
const OTHER_STUDENT_REF = `STU2-LOT4-${MARK}`;
const GUARDIAN_REF = `GRD1-LOT4-${MARK}`;
const FOREIGN_STAFF_REF = `STAFF-FOREIGN-LOT4-${MARK}`;
const CLASS_A = `3A-LOT4-${MARK}`;
const CLASS_B = `3B-LOT4-${MARK}`;
const GROUP_SCI = `GRSCI-LOT4-${MARK}`;
const GROUP_ART = `GRART-LOT4-${MARK}`;

// Tolère un décalage d'horloge entre ce processus et le conteneur PostgreSQL
// local (observé de façon intermittente) : la politique refuse une version
// dont `activatedAt` est postérieur à `now`, donc `now` doit toujours être au
// moins aussi tardif que l'horloge réelle du serveur qui a posé `activated_at`.
function readNow() {
  return new Date(Date.now() + 15_000);
}

const createdUserIds = [];
const dayStart = new Date("2026-09-08T00:00:00.000Z");
const dayEnd = new Date("2026-09-09T00:00:00.000Z");
const RETIREMENT_REASON =
  "Retrait fictif pour la recette adverse du LOT 4 : version remplacée, plus aucun cours à lire.";

async function insertActiveDirectoryImport(id, institutionId, label) {
  await db.execute(sql`
    insert into public.identity_directory_imports
      (id, institution_id, title, purpose_description, source_type, original_name, mime_type, size_bytes,
       storage_path, status, uploaded_by, approved_by, uploaded_at, approved_at, activated_at)
    values (
      ${id}, ${institutionId}, ${`Annuaire fictif LOT4 ${label}`},
      'Recette adverse LOT4 : vérifier les cloisons entre élève, parent et établissement étranger.',
      'csv', ${`edt-lot4-${label}.csv`}, 'text/csv', 2048,
      ${`identity-lot4/${id}.csv`}, 'active',
      ${actorId}, ${actorId}, now() - interval '5 days', now() - interval '5 days', now() - interval '5 days'
    )
  `);
}

async function insertPersonRow({ importId, institutionId, sourceSheet, rowNumber, personRef, personType, classRef, academicEmailHash }) {
  await db.execute(sql`
    insert into public.identity_directory_rows
      (institution_id, import_id, source_sheet, row_number, record_type, person_ref, person_type, class_ref,
       academic_email_hash, valid_from, valid_until, validation_status, fingerprint)
    values (
      ${institutionId}, ${importId}, ${sourceSheet}, ${rowNumber}, 'person', ${personRef}, ${personType},
      ${classRef ?? null}, ${academicEmailHash ?? null}, '2020-01-01', null, 'valid', ${fingerprintFor(personRef)}
    )
  `);
}

async function insertMembershipRow({ importId, institutionId, sourceSheet, rowNumber, subjectPersonRef, objectRef }) {
  await db.execute(sql`
    insert into public.identity_directory_rows
      (institution_id, import_id, source_sheet, row_number, record_type, subject_person_ref, relationship_type,
       object_ref, valid_from, valid_until, validation_status, fingerprint)
    values (
      ${institutionId}, ${importId}, ${sourceSheet}, ${rowNumber}, 'relationship', ${subjectPersonRef}, 'member_of',
      ${objectRef}, '2020-01-01', null, 'valid', ${fingerprintFor(`${subjectPersonRef}:${objectRef}`)}
    )
  `);
}

async function insertSchoolIdentity({ id, institutionId, userId, importId, personType, officialPersonRef }) {
  await db.execute(sql`
    insert into public.school_identities
      (id, institution_id, user_id, source_import_id, person_type, official_person_ref, assurance_level,
       verified_by, verified_at)
    values (
      ${id}, ${institutionId}, ${userId}, ${importId}, ${personType}, ${officialPersonRef},
      'directory_matched', ${actorId}, now() - interval '4 days'
    )
  `);
}

function scheduleRow({ subjectCode, subjectLabel, roomCode, startsAt, endsAt, groupRef = null }) {
  return { subjectCode, subjectLabel, roomCode, startsAt, endsAt, weekPattern: null, groupRef };
}

// Reproduit la vraie séquence de promotion (`processing` -> pages déposées ->
// `review` -> pages vérifiées -> créneaux écrits -> `approved` -> `active`,
// avec supersession de la version précédente le cas échéant), exactement le
// même ordre que celui exigé par le vrai déclencheur
// `schedule_validate_source_promotion` — pas une version raccourcie.
async function createAndActivateVersion({ id, institutionId, sourceKind, schoolYear, version, pages, supersedes }) {
  await db.execute(sql`
    insert into public.schedule_source_versions
      (id, institution_id, source_kind, school_year, version, title, purpose_description,
       effective_from, original_name, mime_type, size_bytes, storage_path, page_count,
       status, uploaded_by)
    values (
      ${id}, ${institutionId}, ${sourceKind}, ${schoolYear}, ${version},
      ${`Emploi du temps fictif LOT4 v${version}`},
      'Recette adverse LOT4 : vérifier que la version retirée cesse d''être lue.',
      '2026-01-01', ${`edt-lot4-v${version}.pdf`}, 'application/pdf', 123456,
      ${`schedule-lot4/${id}.pdf`}, ${pages.length}, 'processing', ${actorId}
    )
  `);
  for (const page of pages) {
    await db.execute(sql`
      insert into public.schedule_page_assets
        (institution_id, source_version_id, page_number, storage_path, size_bytes, checksum)
      values (
        ${institutionId}, ${id}, ${page.pageNumber},
        ${`page-assets/${institutionId.toLowerCase()}/${id.toLowerCase()}/${String(page.pageNumber).padStart(4, "0")}.pdf`},
        123456, ${createHash("sha256").update(`${id}:${page.pageNumber}`).digest("hex")}
      )
    `);
  }
  await db.execute(sql`update public.schedule_source_versions set status = 'review' where id = ${id}`);
  const pageIndexIds = [];
  for (const page of pages) {
    const pageIndexId = randomUUID();
    pageIndexIds.push(pageIndexId);
    await db.execute(sql`
      insert into public.schedule_page_indexes
        (id, institution_id, source_version_id, page_number, subject_type, subject_ref,
         review_status, reviewed_by, reviewed_at)
      values (
        ${pageIndexId}, ${institutionId}, ${id}, ${page.pageNumber}, 'class', ${page.subjectRef},
        'verified', ${actorId}, now()
      )
    `);
    if (page.rows.length > 0) {
      await writeScheduleSlots(db, {
        institutionId,
        sourceVersionId: id,
        pageIndexId,
        actorId,
        rows: page.rows,
      });
    }
  }
  await db.execute(sql`
    update public.schedule_source_versions
    set
      checksum = ${createHash("sha256").update(`checksum:${id}`).digest("hex")},
      validation_summary = '{"securityScan": "clean", "pageCountVerified": true, "pageAssetsVerified": true}'::jsonb
    where id = ${id}
  `);
  await db.execute(sql`
    update public.schedule_source_versions
    set status = 'approved', approved_by = ${actorId}, approved_at = now()
    where id = ${id}
  `);
  if (supersedes) {
    await db.execute(sql`
      update public.schedule_source_versions set status = 'superseded' where id = ${supersedes}
    `);
    await db.execute(sql`
      insert into public.schedule_audit (institution_id, source_version_id, action, actor_id, summary)
      values (${institutionId}, ${supersedes}, 'supersede', ${actorId}, ${JSON.stringify({ replacementSourceVersionId: id })}::jsonb)
    `);
  }
  await db.execute(sql`
    update public.schedule_source_versions
    set status = 'active', activated_by = ${actorId}, activated_at = now(), fresh_until = now() + interval '30 days'
    where id = ${id}
  `);
  await db.execute(sql`
    insert into public.schedule_audit (institution_id, source_version_id, action, actor_id, summary)
    values (${institutionId}, ${id}, 'activate', ${actorId}, ${JSON.stringify({ replacedCount: supersedes ? 1 : 0 })}::jsonb)
  `);
}

try {
  // --- Acteur technique (dépôt/vérification/approbation), pas connecté lui-même. ---
  await db.execute(sql`
    insert into auth.users(id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    values (${actorId}::uuid, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', ${`edt-lot4-actor-${marker}@example.test`}, '', now(), '{}'::jsonb, '{}'::jsonb, now(), now())
  `);

  // --- Trois vrais comptes connectés, avec de vrais jetons Supabase Auth locaux. ---
  const studentUser = await createFictionalActor("student", "recette-lot4-pw-01!");
  const guardianUser = await createFictionalActor("guardian", "recette-lot4-pw-02!");
  const foreignUser = await createFictionalActor("foreign", "recette-lot4-pw-03!");
  createdUserIds.push(studentUser.id, guardianUser.id, foreignUser.id);

  // --- Deux établissements : A est celui configuré pour tout ce script
  // (SUPPORT_INSTITUTION_SLUG), B est « l'établissement étranger ». ---
  await db.execute(sql`insert into public.institutions (id, slug, name, status)
    values (${institutionAId}, ${institutionSlugA}, 'Lycée fictif LOT4 EDT A', 'active')`);
  await db.execute(sql`insert into public.institutions (id, slug, name, status)
    values (${institutionBId}, ${institutionSlugB}, 'Lycée fictif LOT4 EDT B (étranger)', 'pilot')`);

  await insertActiveDirectoryImport(importAId, institutionAId, "A");
  await insertActiveDirectoryImport(importBId, institutionBId, "B");

  // --- Répertoire de l'établissement A : élève, un autre élève sans lien avec
  // le parent, et le parent lui-même. Coordonnée fictive stockée UNIQUEMENT
  // sous forme de hachage (aucune colonne en clair n'existe dans ce schéma). ---
  await insertPersonRow({
    importId: importAId, institutionId: institutionAId, sourceSheet: "eleves", rowNumber: 2,
    personRef: STUDENT_REF, personType: "student", classRef: CLASS_A, academicEmailHash: fakeAcademicEmailHash,
  });
  await insertPersonRow({
    importId: importAId, institutionId: institutionAId, sourceSheet: "eleves", rowNumber: 3,
    personRef: OTHER_STUDENT_REF, personType: "student", classRef: CLASS_A,
  });
  await insertPersonRow({
    importId: importAId, institutionId: institutionAId, sourceSheet: "parents", rowNumber: 2,
    personRef: GUARDIAN_REF, personType: "guardian", classRef: null,
  });
  await insertMembershipRow({
    importId: importAId, institutionId: institutionAId, sourceSheet: "groupes", rowNumber: 2,
    subjectPersonRef: STUDENT_REF, objectRef: GROUP_SCI,
  });

  await insertSchoolIdentity({
    id: studentIdentityId, institutionId: institutionAId, userId: studentUser.id, importId: importAId,
    personType: "student", officialPersonRef: STUDENT_REF,
  });
  await insertSchoolIdentity({
    id: guardianIdentityId, institutionId: institutionAId, userId: guardianUser.id, importId: importAId,
    personType: "guardian", officialPersonRef: GUARDIAN_REF,
  });
  await insertSchoolIdentity({
    id: foreignIdentityId, institutionId: institutionBId, userId: foreignUser.id, importId: importBId,
    personType: "staff", officialPersonRef: FOREIGN_STAFF_REF,
  });

  // Le parent n'est rattaché qu'à STUDENT_REF, jamais à OTHER_STUDENT_REF.
  await db.execute(sql`
    insert into public.school_relationships
      (institution_id, subject_identity_id, object_person_ref, relationship_type, valid_from, valid_until,
       source_import_id, status)
    values (${institutionAId}, ${guardianIdentityId}, ${STUDENT_REF}, 'guardian_of', '2020-01-01', null, ${importAId}, 'active')
  `);

  // --- Version 1 de l'emploi du temps : deux classes, deux groupes. ---
  const versionV1Id = randomUUID();
  await createAndActivateVersion({
    id: versionV1Id, institutionId: institutionAId, sourceKind: "classes", schoolYear: "2026-2027", version: 1,
    pages: [
      {
        pageNumber: 1, subjectRef: CLASS_A,
        rows: [
          scheduleRow({ subjectCode: "MATH", subjectLabel: `Mathématiques LOT4 ${MARK}`, roomCode: "B1", startsAt: "2026-09-08T07:00:00.000Z", endsAt: "2026-09-08T08:00:00.000Z" }),
          scheduleRow({ subjectCode: "SCIATL", subjectLabel: `Atelier Sciences LOT4 ${MARK}`, roomCode: "LabA", startsAt: "2026-09-08T08:00:00.000Z", endsAt: "2026-09-08T09:00:00.000Z", groupRef: GROUP_SCI }),
        ],
      },
      {
        pageNumber: 2, subjectRef: CLASS_B,
        rows: [
          scheduleRow({ subjectCode: "HIST", subjectLabel: `Histoire LOT4 ${MARK}`, roomCode: "C2", startsAt: "2026-09-08T07:00:00.000Z", endsAt: "2026-09-08T08:00:00.000Z" }),
          scheduleRow({ subjectCode: "ARTATL", subjectLabel: `Atelier Arts LOT4 ${MARK}`, roomCode: "ArtRoom", startsAt: "2026-09-08T09:00:00.000Z", endsAt: "2026-09-08T10:00:00.000Z", groupRef: GROUP_ART }),
        ],
      },
    ],
  });

  const expectedCourseKeys = ["endsAt", "roomCode", "startsAt", "state", "subjectCode", "subjectLabel"].sort();
  function assertHonestCourseShape(courses, label) {
    for (const course of courses) {
      check(Object.keys(course).sort(), expectedCourseKeys, `${label}_course_object_has_no_extra_field`);
    }
  }

  // ===========================================================================
  // Point 1 : un élève ne voit que sa classe et ses groupes.
  // ===========================================================================
  const studentReq = { headers: { authorization: `Bearer ${studentUser.token}` } };
  const studentResult = await readCoursesForDayForVerifiedIdentity({
    req: studentReq, now: readNow(), dayStart, dayEnd,
  });
  check(studentResult.ok, true, "student_read_succeeds");
  const studentSubjects = studentResult.courses.map((course) => course.subjectCode).sort();
  check(studentSubjects, ["MATH", "SCIATL"].sort(), "student_sees_only_own_class_and_group_courses");
  assert.ok(!studentSubjects.includes("HIST"), "student_must_not_see_other_class_course");
  assert.ok(!studentSubjects.includes("ARTATL"), "student_must_not_see_other_group_course");
  assertions += 2;
  assertHonestCourseShape(studentResult.courses, "student");

  // ===========================================================================
  // Point 2 : un parent ne voit que ses enfants rattachés.
  // ===========================================================================
  const guardianReq = { headers: { authorization: `Bearer ${guardianUser.token}` } };
  const guardianResult = await readCoursesForDayForVerifiedIdentity({
    req: guardianReq, targetPersonRef: STUDENT_REF, now: readNow(), dayStart, dayEnd,
  });
  check(guardianResult.ok, true, "guardian_read_for_own_child_succeeds");
  check(
    guardianResult.courses.map((course) => course.subjectCode).sort(),
    ["MATH", "SCIATL"].sort(),
    "guardian_sees_exactly_the_childs_authorized_courses"
  );
  assertHonestCourseShape(guardianResult.courses, "guardian");

  let guardianDeniedForUnrelatedChild = null;
  try {
    await readCoursesForDayForVerifiedIdentity({
      req: guardianReq, targetPersonRef: OTHER_STUDENT_REF, now: readNow(), dayStart, dayEnd,
    });
  } catch (error) {
    guardianDeniedForUnrelatedChild = error;
  }
  check(
    guardianDeniedForUnrelatedChild instanceof HttpError && guardianDeniedForUnrelatedChild.status === 403,
    true,
    "guardian_cannot_read_an_unrelated_students_schedule"
  );

  // ===========================================================================
  // Point 3 : un membre d'un autre établissement ne voit rien.
  // ===========================================================================
  const foreignReq = { headers: { authorization: `Bearer ${foreignUser.token}` } };
  let foreignDenied = null;
  try {
    await readCoursesForDayForVerifiedIdentity({ req: foreignReq, now: readNow(), dayStart, dayEnd });
  } catch (error) {
    foreignDenied = error;
  }
  check(
    foreignDenied instanceof HttpError && foreignDenied.status === 403,
    true,
    "foreign_institution_member_sees_nothing"
  );

  // ===========================================================================
  // Point 4 : une version d'import retirée n'est plus lue.
  // ===========================================================================
  const versionV2Id = randomUUID();
  await createAndActivateVersion({
    id: versionV2Id, institutionId: institutionAId, sourceKind: "classes", schoolYear: "2026-2027", version: 2,
    pages: [{ pageNumber: 1, subjectRef: CLASS_A, rows: [] }],
    supersedes: versionV1Id,
  });
  const [{ status: v1StatusAfterSupersede }] = await db.execute(
    sql`select status from public.schedule_source_versions where id = ${versionV1Id}`
  );
  check(v1StatusAfterSupersede, "superseded", "old_version_is_superseded_not_active");

  const studentResultAfterSupersede = await readCoursesForDayForVerifiedIdentity({
    req: studentReq, now: readNow(), dayStart, dayEnd,
  });
  check(studentResultAfterSupersede.ok, true, "read_after_supersede_is_an_honest_answer_not_a_refusal");
  check(studentResultAfterSupersede.courses, [], "superseded_versions_courses_are_no_longer_readable");

  // Retrait explicite (texte du plan : « une version d'import retirée »),
  // en respectant exactement les mêmes conditions que la vraie route
  // `api/schedule/admin/imports/[id]/retire.ts` et le vrai déclencheur.
  await db.execute(sql`
    update public.schedule_source_versions
    set
      status = 'retired', retired_by = ${actorId}, retired_at = now(),
      retirement_reason = ${RETIREMENT_REASON},
      retention_policy_key = 'pending_dpo', retention_until = null,
      storage_purge_status = 'blocked', purged_at = null
    where id = ${versionV1Id}
  `);
  await db.execute(sql`
    insert into public.schedule_audit (institution_id, source_version_id, action, actor_id, summary)
    values (${institutionAId}, ${versionV1Id}, 'retire', ${actorId}, ${JSON.stringify({ justification: RETIREMENT_REASON, fileAccessRevoked: true })}::jsonb)
  `);
  const [{ status: v1StatusAfterRetire }] = await db.execute(
    sql`select status from public.schedule_source_versions where id = ${versionV1Id}`
  );
  check(v1StatusAfterRetire, "retired", "old_version_is_now_explicitly_retired");

  const studentResultAfterRetire = await readCoursesForDayForVerifiedIdentity({
    req: studentReq, now: readNow(), dayStart, dayEnd,
  });
  check(studentResultAfterRetire.ok, true, "read_after_retire_is_still_an_honest_answer");
  check(studentResultAfterRetire.courses, [], "retired_versions_courses_stay_unreadable");

  const retireAudit = await db.execute(
    sql`select action from public.schedule_audit where source_version_id = ${versionV1Id} and action = 'retire'`
  );
  check(retireAudit.length, 1, "a_retire_audit_row_was_written");

  // ===========================================================================
  // Point 5 : aucune coordonnée en clair n'est stockée ni renvoyée.
  // ===========================================================================
  const contactColumns = await db.execute(sql`
    select table_name, column_name from information_schema.columns
    where table_schema = 'public'
      and table_name in ('identity_directory_rows', 'school_identities', 'schedule_slots', 'schedule_source_versions')
      and (column_name ilike '%email%' or column_name ilike '%phone%')
  `);
  assert.ok(contactColumns.length >= 2, "at_least_the_hash_columns_exist");
  assertions++;
  for (const row of contactColumns) {
    assert.match(row.column_name, /_hash$/, `plaintext_contact_column_forbidden:${row.table_name}.${row.column_name}`);
    assertions++;
  }

  const [storedStudentHash] = await db.execute(sql`
    select academic_email_hash from public.identity_directory_rows
    where institution_id = ${institutionAId} and person_ref = ${STUDENT_REF} and record_type = 'person'
  `);
  check(storedStudentHash.academic_email_hash, fakeAcademicEmailHash, "the_only_stored_form_of_the_coordinate_is_its_hash");

  const scannedTables = [
    "identity_directory_rows", "school_identities", "school_relationships",
    "schedule_slots", "schedule_source_versions", "schedule_audit", "identity_directory_audit",
    "identity_directory_imports",
  ];
  for (const tableName of scannedTables) {
    const [{ count }] = await db.execute(
      sql.raw(`select count(*)::int as count from public.${tableName} t where (t.*)::text ilike '%${fakeAcademicEmail}%'`)
    );
    check(count, 0, `no_row_in_${tableName}_holds_the_coordinate_in_clear`);
  }

  const outcomeText = JSON.stringify({ studentResult, guardianResult });
  assert.doesNotMatch(outcomeText, new RegExp(fakeAcademicEmail.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), "returned_outcomes_never_contain_the_coordinate");
  assert.doesNotMatch(outcomeText, new RegExp(fakeAcademicEmailHash), "returned_outcomes_never_contain_the_hash_either");
  assertions += 2;

  // ===========================================================================
  // Point 6 : aucun nom ne peut être cherché librement.
  // ===========================================================================
  assert.throws(
    () => parseIdentityLookupInput({
      searchType: "name",
      query: "Dupont",
      reasonCategory: "other",
      justification: "Tentative de recherche libre par nom dans la recette adverse du LOT 4.",
    }),
    /type de recherche/,
    "free_text_name_search_is_rejected_by_the_real_validator"
  );
  assertions++;

  // ===========================================================================
  // Point 7 (partie statique) : le contexte destiné au modèle ne construit
  // jamais de réponse d'emploi du temps à partir d'un appel IA — balayage du
  // texte source réel des fonctions qui répondent à l'agent.
  // ===========================================================================
  const scheduleSources = [
    "../shared/schedule-assistant.ts",
    "../api/_shared/schedule-identity-reader.ts",
    "../api/_shared/schedule-reader.ts",
    "../shared/schedule-policy.ts",
  ]
    .map((path) => readFileSync(new URL(path, import.meta.url), "utf8"))
    .join("\n");
  assert.doesNotMatch(
    scheduleSources,
    /academicEmailHash|personalEmailHash|phoneHash|openai|generateText|chat\.completions/i,
    "schedule_answer_path_never_touches_a_coordinate_hash_or_an_ai_call"
  );
  assertions++;

  // ===========================================================================
  // Point 7 (partie dynamique) : rien de journalisé pendant tout le scénario
  // ne porte la coordonnée fictive, et l'unique occurrence attendue reste la
  // mémoire du script (les résultats destinés aux personnes elles-mêmes).
  // ===========================================================================
  const capturedText = capturedLogs.join("\n");
  assert.ok(!capturedText.includes(fakeAcademicEmail), "nothing_captured_on_stdout_or_stderr_carries_the_coordinate");
  assertions++;

  console.log = originalLog;
  console.error = originalError;

  console.log(
    JSON.stringify(
      {
        target: "127.0.0.1:54322",
        assertions,
        realData: false,
        outcome: "pass",
      },
      null,
      2
    )
  );
} finally {
  console.log = originalLog;
  console.error = originalError;
  for (const userId of createdUserIds) {
    await admin.auth.admin.deleteUser(userId).catch(() => {});
  }
  // `schedule_slots_guard_source` (vérifié réellement par le LOT 1) rend un
  // créneau immuable — y compris pour une suppression — dès que sa version
  // atteint 'active', 'superseded' ou 'retired'. Ce LOT 4 active délibérément
  // deux versions pour prouver le point 4 du plan : les lignes
  // `schedule_slots`/`schedule_source_versions` créées ici ne peuvent donc
  // plus jamais être supprimées, par une garantie réelle de non-régression
  // des données scolaires, pas par un oubli de nettoyage. On supprime tout ce
  // qui reste réellement supprimable (répertoire d'identité, comptes Auth) et
  // on documente honnêtement ce qui reste dans la pile locale jetable.
  try {
    await db.execute(sql`delete from public.school_relationships where institution_id in (${institutionAId}, ${institutionBId})`);
    await db.execute(sql`delete from public.school_identities where institution_id in (${institutionAId}, ${institutionBId})`);
    await db.execute(sql`delete from public.identity_directory_rows where institution_id in (${institutionAId}, ${institutionBId})`);
    await db.execute(sql`delete from public.identity_directory_audit where institution_id in (${institutionAId}, ${institutionBId})`);
    await db.execute(sql`delete from public.identity_directory_imports where institution_id in (${institutionAId}, ${institutionBId})`);
  } catch (error) {
    originalError("DEBUG identity_cleanup_failed", error?.message ?? error);
  }
}
