// Hard-coded disposable loopback target; never inherits DATABASE_URL or loads .env.
// Recette du LOT 3 (`docs/operations/PLAN_IMPORT_UTILISABLE_2026-09-07.md`) sur
// PostgreSQL réel jetable. Établissement, personnel et fichier tabulaire
// entièrement fictifs. Jamais `--linked`, jamais `db push`, jamais d'URL
// distante.
//
// Preuve recherchée : la correspondance de colonnes choisie par un
// administrateur (`shared/schedule-tabular-mapping.ts`) produit des lignes
// qui traversent, sans aucune modification, le même point d'écriture que le
// PDF (`writeScheduleSlots`, déjà prouvé par le LOT 1/2 du plan « données
// réelles ») et la même porte d'approbation
// (`findVerifiedPagesWithoutSlots`, LOT 2 de ce plan). Rejoue aussi la
// logique de transaction de la route
// `api/schedule/admin/imports/[id]/tabular-mapping.ts` (verrou, upsert de
// la correspondance, création des pages, passage en `review` avec le bon
// `page_count`) directement en SQL réel — pas la route HTTP complète avec
// authentification Supabase (même niveau de preuve que le LOT 2, voir
// `docs/operations/night-logs/UTIL-LOT2.md`).
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import {
  findVerifiedPagesWithoutSlots,
  writeScheduleSlots,
} from "../api/_shared/schedule-slot-write.ts";
import {
  applyScheduleTabularColumnMapping,
  parseScheduleTabularColumnMapping,
} from "../shared/schedule-tabular-mapping.ts";

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

const HEADERS = ["Classe", "Professeur", "Matiere", "Intitule", "Salle", "Date", "Debut", "Fin"];
const MAPPING_INPUT = {
  subjectRef: "Classe",
  subjectCode: "Matiere",
  subjectLabel: "Intitule",
  date: "Date",
  startTime: "Debut",
  endTime: "Fin",
  roomCode: "Salle",
  weekPattern: null,
  groupRef: null,
};
const RAW_ROWS = [
  ["6A-FICTIF-LOT3", "Mme Dupont", "MATH", "Mathematiques", "B12", "2026-09-07", "08:00", "09:00"],
  ["6B-FICTIF-LOT3", "M. Martin", "FR", "Francais", "A03", "2026-09-07", "09:00", "10:00"],
];

// Étape 1 (pure, sans base) : c'est exactement ce que produirait la route
// après relecture du fichier déposé — aucune divergence tolérée avec ce que
// `pages/[pageId]/slots.ts` accepte déjà.
const mapping = parseScheduleTabularColumnMapping(MAPPING_INPUT, HEADERS);
check(mapping !== null, true, "la_correspondance_est_valide_contre_les_en_tetes_reelles");
const applied = applyScheduleTabularColumnMapping({ mapping, headers: HEADERS, rows: RAW_ROWS });
check(applied.ok, true, "lapplication_de_la_correspondance_reussit");
check(applied.groups.length, 2, "deux_classes_distinctes_donnent_deux_groupes");

try {
  await database.transaction(async (tx) => {
    await tx.execute(sql`
      insert into auth.users(id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
      values (${actorId}::uuid, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', ${`fixture-${actorId}@example.test`}, '', now(), '{}'::jsonb, '{}'::jsonb, now(), now())
    `);
    await tx.execute(sql`
      insert into public.institutions (id, slug, name, status)
      values (${institutionId}, ${`edt-lot3-${institutionId}`}, 'Lycée fictif LOT 3 EDT', 'draft')
    `);
    await tx.execute(sql`
      insert into public.schedule_source_versions
        (id, institution_id, source_kind, source_format, school_year, version, title, purpose_description,
         effective_from, original_name, mime_type, size_bytes, storage_path,
         status, uploaded_by, checksum, validation_summary)
      values (
        ${sourceVersionId}, ${institutionId}, 'classes', 'tabular_import', '2026-2027', 1,
        'Export EDT fictif LOT 3', 'Recette locale de la correspondance de colonnes tabulaire.',
        '2026-09-07', 'export-edt-fictif-lot3.csv', 'text/csv', 654321,
        ${`schedule-lot3/${sourceVersionId}.csv`}, 'mapping_pending', ${actorId},
        ${randomBytes(32).toString("hex")},
        ${sql.raw(
          `'${JSON.stringify({
            securityScan: "clean",
            tabularHeaders: HEADERS,
            tabularRowCount: RAW_ROWS.length,
            humanMapping: "pending",
          })}'::jsonb`
        )}
      )
    `);

    // Rejoue la transaction de `tabular-mapping.ts` (POST) : verrou,
    // upsert de la correspondance, une page par groupe, puis passage en
    // `review` avec le `page_count` désormais connu.
    await tx.execute(sql`
      select pg_advisory_xact_lock(hashtextextended(${sourceVersionId}::text, 61744))
    `);
    await tx.execute(sql`
      insert into public.schedule_tabular_column_mappings (institution_id, source_kind, mapping, updated_by)
      values (${institutionId}, 'classes', ${JSON.stringify(mapping)}::jsonb, ${actorId})
      on conflict (institution_id, source_kind) do update set mapping = excluded.mapping, updated_by = excluded.updated_by
    `);

    // `schedule_page_indexes` porte un déclencheur qui n'accepte des lignes
    // que pour une version source déjà `review`, avec un `page_number`
    // borné par son `page_count` (`schedule_validate_page_review_bounds`,
    // `20260829113248_enforce_schedule_page_review_bounds.sql`) : la
    // version doit donc passer en `review` avec le bon `page_count` AVANT
    // toute page créée. Découvert par cette recette elle-même (première
    // tentative dans l'autre ordre : rejetée par la base avec
    // « Schedule page indexes are editable only during human review »).
    await tx.execute(sql`
      update public.schedule_source_versions
      set status = 'review', page_count = ${applied.groups.length}
      where id = ${sourceVersionId}
    `);
    await tx.execute(sql`
      insert into public.schedule_audit (institution_id, source_version_id, action, actor_id, summary)
      values (${institutionId}, ${sourceVersionId}, 'apply_tabular_mapping', ${actorId}, '{}'::jsonb)
    `);

    const pageIds = {};
    for (const [index, group] of applied.groups.entries()) {
      const pageId = randomUUID();
      pageIds[group.subjectRef] = pageId;
      await tx.execute(sql`
        insert into public.schedule_page_indexes
          (id, institution_id, source_version_id, page_number, subject_type, subject_ref, review_status)
        values (${pageId}, ${institutionId}, ${sourceVersionId}, ${index + 1}, 'class', ${group.subjectRef}, 'draft')
      `);
      await tx.execute(sql`
        insert into public.schedule_audit (institution_id, source_version_id, page_index_id, action, actor_id, summary)
        values (${institutionId}, ${sourceVersionId}, ${pageId}, 'index_page', ${actorId}, '{}'::jsonb)
      `);
    }

    const [afterMapping] = await tx.execute(sql`
      select status, page_count from public.schedule_source_versions where id = ${sourceVersionId}
    `);
    check(afterMapping.status, "review", "la_version_passe_en_review_apres_la_correspondance");
    check(Number(afterMapping.page_count), 2, "le_page_count_correspond_au_nombre_de_groupes_trouves");

    const pageRows = await tx.execute(sql`
      select subject_ref, review_status from public.schedule_page_indexes
      where source_version_id = ${sourceVersionId} order by page_number
    `);
    check(
      Array.from(pageRows).map((row) => row.subject_ref),
      ["6A-FICTIF-LOT3", "6B-FICTIF-LOT3"],
      "une_page_est_creee_par_classe_distincte_trouvee_dans_le_fichier"
    );

    // Vérification humaine des deux pages (même geste que pour un PDF).
    await tx.execute(sql`
      update public.schedule_page_indexes set review_status = 'verified', reviewed_by = ${actorId}, reviewed_at = now()
      where source_version_id = ${sourceVersionId}
    `);

    // Preuve centrale du LOT 3 : les lignes calculées à partir du fichier
    // tabulaire traversent `writeScheduleSlots` sans aucune adaptation —
    // c'est le même point d'écriture que celui déjà prouvé pour le PDF.
    const firstGroup = applied.groups[0];
    const written = await writeScheduleSlots(tx, {
      institutionId,
      sourceVersionId,
      pageIndexId: pageIds[firstGroup.subjectRef],
      actorId,
      rows: firstGroup.rows,
    });
    check(written.length, firstGroup.rows.length, "les_creneaux_calcules_sont_reellement_ecrits_en_base");
    check(written[0].subjectCode, "MATH", "le_code_matiere_calcule_est_bien_celui_ecrit");

    // La porte d'approbation du LOT 2 s'applique sans modification à une
    // version d'origine tabulaire : la seconde page vérifiée n'a encore
    // aucun créneau.
    const gapBeforeSecondWrite = await findVerifiedPagesWithoutSlots(tx, { institutionId, sourceVersionId });
    check(gapBeforeSecondWrite, [2], "la_porte_dapprobation_lot2_detecte_la_page_tabulaire_encore_vide");

    const secondGroup = applied.groups[1];
    await writeScheduleSlots(tx, {
      institutionId,
      sourceVersionId,
      pageIndexId: pageIds[secondGroup.subjectRef],
      actorId,
      rows: secondGroup.rows,
    });
    const gapAfterSecondWrite = await findVerifiedPagesWithoutSlots(tx, { institutionId, sourceVersionId });
    check(gapAfterSecondWrite, [], "plus_aucune_page_tabulaire_verifiee_nest_vide_apres_ecriture");

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
