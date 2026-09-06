// Hard-coded disposable loopback target; never inherits DATABASE_URL or loads .env.
// Recette du LOT 1 (`docs/operations/PLAN_DONNEES_REELLES_2026-09-06.md`) sur
// PostgreSQL réel jetable. Établissement, personnel et emploi du temps
// entièrement fictifs. Jamais `--linked`, jamais `db push`, jamais d'URL
// distante.
//
// Avant ce lot, aucun code n'écrivait dans `schedule_slots` : le circuit
// d'import s'arrêtait à la page vérifiée. Cette recette prouve que
// `writeScheduleSlots` (le point d'écriture unique, `api/_shared/schedule-slot-write.ts`)
// transforme réellement une page vérifiée en lignes de `schedule_slots`,
// qu'un renvoi remplace au lieu de dupliquer, qu'une page non vérifiée est
// refusée, qu'une version qui n'est plus modifiable est refusée, et que la
// version porteuse de créneaux ne peut même pas être supprimée — pas
// seulement une hypothèse sur le comportement de la table.
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import { ScheduleSlotWriteError, writeScheduleSlots } from "../api/_shared/schedule-slot-write.ts";

if (process.argv.length !== 3 || process.argv[2] !== "--local-stack-only") {
  throw new Error("local_stack_confirmation_required");
}

const client = postgres({
  host: "127.0.0.1",
  port: 54322,
  database: "postgres",
  user: "postgres",
  password: "postgres",
  max: 1,
  prepare: false,
  connect_timeout: 5,
});
const database = drizzle(client);
let assertions = 0;
const check = (actual, expected, message) => {
  assert.deepEqual(actual, expected, message);
  assertions++;
};

const rollback = new Error("intentional_fixture_rollback");
const institutionId = randomUUID();
const actorId = randomUUID();
const sourceVersionId = randomUUID();
const verifiedPageId = randomUUID();
const unverifiedPageId = randomUUID();

const mondayMaths = {
  subjectCode: "MATH",
  subjectLabel: "Mathématiques",
  roomCode: "B12",
  startsAt: "2026-09-07T06:00:00.000Z",
  endsAt: "2026-09-07T07:00:00.000Z",
  weekPattern: null,
  groupRef: null,
};
const mondayFrench = {
  subjectCode: "FR",
  subjectLabel: "Français",
  roomCode: "B12",
  startsAt: "2026-09-07T07:00:00.000Z",
  endsAt: "2026-09-07T08:00:00.000Z",
  weekPattern: null,
  groupRef: null,
};
const mondayHistoryReplacement = {
  subjectCode: "HIST-GEO",
  subjectLabel: "Histoire-Géographie",
  roomCode: "B14",
  startsAt: "2026-09-07T08:00:00.000Z",
  endsAt: "2026-09-07T09:00:00.000Z",
  weekPattern: null,
  groupRef: null,
};

try {
  await database.transaction(async (tx) => {
    await tx.execute(sql`
      insert into auth.users(id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
      values (${actorId}::uuid, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', ${`fixture-${actorId}@example.test`}, '', now(), '{}'::jsonb, '{}'::jsonb, now(), now())
    `);
    await tx.execute(sql`
      insert into public.institutions (id, slug, name, status)
      values (${institutionId}, ${`edt-lot1-${institutionId}`}, 'Lycée fictif LOT 1 EDT', 'draft')
    `);
    await tx.execute(sql`
      insert into public.schedule_source_versions
        (id, institution_id, source_kind, school_year, version, title, purpose_description,
         effective_from, original_name, mime_type, size_bytes, storage_path, page_count,
         status, uploaded_by)
      values (
        ${sourceVersionId}, ${institutionId}, 'classes', '2026-2027', 1,
        'Emploi du temps fictif LOT 1', 'Recette locale du dernier mètre : écrire les créneaux réels.',
        '2026-09-07', 'edt-6a-fictif-lot1.pdf', 'application/pdf', 123456,
        ${`schedule-lot1/${sourceVersionId}.pdf`}, 2, 'processing', ${actorId}
      )
    `);
    // Les pages privées ne peuvent être écrites que pendant 'processing'
    // (déclencheur réel `schedule_guard_page_asset_write`) : on les dépose
    // avant de faire passer la version en 'review'.
    for (const pageNumber of [1, 2]) {
      await tx.execute(sql`
        insert into public.schedule_page_assets
          (institution_id, source_version_id, page_number, storage_path, size_bytes, checksum)
        values (
          ${institutionId}, ${sourceVersionId}, ${pageNumber},
          ${`page-assets/${institutionId.toLowerCase()}/${sourceVersionId.toLowerCase()}/${String(pageNumber).padStart(4, "0")}.pdf`},
          123456, ${randomBytes(32).toString("hex")}
        )
      `);
    }
    await tx.execute(sql`
      update public.schedule_source_versions set status = 'review' where id = ${sourceVersionId}
    `);
    await tx.execute(sql`
      insert into public.schedule_page_indexes
        (id, institution_id, source_version_id, page_number, subject_type, subject_ref,
         review_status, reviewed_by, reviewed_at)
      values (
        ${verifiedPageId}, ${institutionId}, ${sourceVersionId}, 1, 'class', '6A-FICTIF-LOT1',
        'verified', ${actorId}, now()
      )
    `);
    await tx.execute(sql`
      insert into public.schedule_page_indexes
        (id, institution_id, source_version_id, page_number, subject_type, subject_ref, review_status)
      values (
        ${unverifiedPageId}, ${institutionId}, ${sourceVersionId}, 2, 'class', '6B-FICTIF-LOT1', 'draft'
      )
    `);

    // Première écriture : la page vérifiée devient deux créneaux réels.
    const firstWrite = await writeScheduleSlots(tx, {
      institutionId,
      sourceVersionId,
      pageIndexId: verifiedPageId,
      actorId,
      rows: [mondayMaths, mondayFrench],
    });
    check(firstWrite.length, 2, "deux_creneaux_ecrits_pour_la_page_verifiee");
    check(
      firstWrite.every((row) => row.classRef === "6A-FICTIF-LOT1" && row.teacherRef === null),
      true,
      "les_creneaux_portent_la_reference_de_classe_de_la_page"
    );

    const storedAfterFirstWrite = await tx.execute(sql`
      select count(*)::integer as count from public.schedule_slots
      where source_version_id = ${sourceVersionId} and class_ref = '6A-FICTIF-LOT1'
    `);
    check(storedAfterFirstWrite[0].count, 2, "deux_lignes_reellement_presentes_en_base");

    const auditAfterFirstWrite = await tx.execute(sql`
      select action, summary from public.schedule_audit
      where source_version_id = ${sourceVersionId} and page_index_id = ${verifiedPageId} and action = 'write_slots'
    `);
    check(auditAfterFirstWrite.length, 1, "une_ligne_daudit_write_slots_ecrite");
    check(auditAfterFirstWrite[0].summary.rowCount, 2, "laudit_reflete_le_nombre_de_creneaux_ecrits");

    // Renvoi avec un contenu différent : remplace, ne duplique jamais.
    const secondWrite = await writeScheduleSlots(tx, {
      institutionId,
      sourceVersionId,
      pageIndexId: verifiedPageId,
      actorId,
      rows: [mondayHistoryReplacement],
    });
    check(secondWrite.length, 1, "le_renvoi_ne_garde_que_le_nouveau_contenu");
    const storedAfterSecondWrite = await tx.execute(sql`
      select subject_code from public.schedule_slots
      where source_version_id = ${sourceVersionId} and class_ref = '6A-FICTIF-LOT1'
    `);
    check(storedAfterSecondWrite.length, 1, "un_seul_creneau_reste_apres_le_renvoi");
    check(storedAfterSecondWrite[0].subject_code, "HIST-GEO", "le_creneau_restant_est_bien_le_nouveau");

    // Page non vérifiée : refusée, aucune ligne écrite.
    await assert.rejects(
      () =>
        writeScheduleSlots(tx, {
          institutionId,
          sourceVersionId,
          pageIndexId: unverifiedPageId,
          actorId,
          rows: [mondayMaths],
        }),
      (error) => error instanceof ScheduleSlotWriteError && error.status === 409,
      "une_page_non_verifiee_est_refusee"
    );
    assertions++;
    const storedForUnverifiedPage = await tx.execute(sql`
      select count(*)::integer as count from public.schedule_slots
      where source_version_id = ${sourceVersionId} and class_ref = '6B-FICTIF-LOT1'
    `);
    check(storedForUnverifiedPage[0].count, 0, "rien_nest_ecrit_pour_une_page_non_verifiee");

    // Version qui n'est plus modifiable ('review' -> 'approved') : refusée.
    // Le déclencheur réel `schedule_validate_source_promotion` exige que
    // toutes les pages soient vérifiées et le contrôle technique complet
    // avant d'accepter la transition ; on satisfait ces conditions pour
    // atteindre l'état à tester.
    await tx.execute(sql`
      update public.schedule_page_indexes
      set review_status = 'verified', reviewed_by = ${actorId}, reviewed_at = now()
      where id = ${unverifiedPageId}
    `);
    await tx.execute(sql`
      update public.schedule_source_versions
      set
        checksum = ${randomBytes(32).toString("hex")},
        validation_summary = '{"securityScan": "clean", "pageCountVerified": true, "pageAssetsVerified": true}'::jsonb
      where id = ${sourceVersionId}
    `);
    await tx.execute(sql`
      update public.schedule_source_versions
      set status = 'approved', approved_by = ${actorId}, approved_at = now()
      where id = ${sourceVersionId}
    `);
    await assert.rejects(
      () =>
        writeScheduleSlots(tx, {
          institutionId,
          sourceVersionId,
          pageIndexId: verifiedPageId,
          actorId,
          rows: [mondayMaths],
        }),
      (error) => error instanceof ScheduleSlotWriteError && error.status === 409,
      "une_version_qui_nest_plus_modifiable_est_refusee"
    );
    assertions++;

    // Un créneau appartient toujours à une version, jamais orphelin : la
    // vraie contrainte de la table (`schedule_slots_guard_source`) refuse
    // même la suppression de la version tant qu'elle porte des créneaux —
    // pas seulement une hypothèse sur un `on delete cascade` silencieux.
    await tx.execute(sql`savepoint before_orphan_check`);
    await assert.rejects(
      () => tx.execute(sql`delete from public.schedule_source_versions where id = ${sourceVersionId}`),
      (error) =>
        (error?.cause?.message ?? error?.message ?? String(error)).includes(
          "Schedule source is unavailable"
        ),
      "la_suppression_de_la_version_est_refusee_tant_que_des_creneaux_existent"
    );
    assertions++;
    await tx.execute(sql`rollback to savepoint before_orphan_check`);
    const stillAttached = await tx.execute(sql`
      select count(*)::integer as count from public.schedule_slots
      where source_version_id = ${sourceVersionId} and class_ref = '6A-FICTIF-LOT1'
    `);
    check(stillAttached[0].count, 1, "le_creneau_reste_attache_a_une_version_bien_reelle");

    throw rollback;
  });
} catch (error) {
  if (error !== rollback) throw error;
} finally {
  await client.end();
}

const verifier = postgres({
  host: "127.0.0.1",
  port: 54322,
  database: "postgres",
  user: "postgres",
  password: "postgres",
  max: 1,
  connect_timeout: 5,
});
try {
  const [{ count: traceCount }] = await verifier`
    select count(*)::integer as count from public.institutions where id = ${institutionId}
  `;
  check(traceCount, 0, "rollback_laisse_aucune_trace");
} finally {
  await verifier.end();
}

console.log(
  JSON.stringify(
    { target: "127.0.0.1:54322", assertions, rollbackVerified: true, realData: false },
    null,
    2
  )
);
