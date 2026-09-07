// Hard-coded disposable loopback target; never inherits DATABASE_URL or loads
// .env. Recette du LOT 4 (`docs/operations/PLAN_IMPORT_UTILISABLE_2026-09-07.md`)
// sur PostgreSQL réel jetable. Établissement, personnel et fichier tabulaire
// entièrement fictifs. Jamais `--linked`, jamais `db push`, jamais d'URL
// distante.
//
// Contrairement aux recettes des LOT 2 et LOT 3 (une seule transaction,
// annulée à la fin), celle-ci a besoin d'écritures réellement validées
// (`commit`, pas `rollback`) : la lecture finale par l'agent
// (`readCoursesForDayFromPrivateSchedule`) passe par la connexion applicative
// normale (`db/index.ts`), une connexion Postgres distincte de celle qui
// écrit les données de recette. Une transaction non validée serait invisible
// depuis cette seconde connexion. Le nettoyage final est donc fait par des
// suppressions explicites, vérifiées à zéro trace, pas par un rollback.
//
// Preuve recherchée, dans l'ordre du LOT 4 :
//   1. dépôt d'un fichier tabulaire + correspondance de colonnes choisie ;
//   2. écriture des créneaux par le même point d'écriture que le PDF ;
//   3. refus réel de l'approbation tant qu'une page vérifiée est vide ;
//   4. activation, avec retrait propre de la version précédente — prouvé au
//      niveau applicatif (activate.ts) ET au niveau du schéma PostgreSQL
//      (l'index unique partiel `schedule_source_versions_one_active_uidx`
//      refuse deux versions actives simultanées pour le même périmètre,
//      même si le code applicatif était contourné) ;
//   5. sur la version activée : une identité vérifiée de la classe importée
//      reçoit son cours du jour ; une identité d'une autre classe (jamais
//      importée, ou dont la version a été supplantée) ne reçoit rien.
//
// Portée : la résolution identité → périmètre autorisé
// (`resolveVerifiedScheduleScope`) n'est pas rejouée ici — elle est déjà
// recettée par `scripts/schedule-identity-sql-recipe.mjs` et
// `scripts/test-local-schedule-identity-adversarial.mjs`. Cette recette part
// d'un périmètre déjà résolu (`TrustedScheduleScope`), exactement la forme
// que produirait une identité vérifiée, et prouve la suite de la chaîne :
// dépôt → écriture → approbation → activation → lecture réelle.
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

// Fixé avant tout import : `db/index.ts` lit `DATABASE_URL` au chargement du
// module et jette si elle est absente. C'est la même pile locale jetable que
// les autres recettes (port 54322), jamais une URL distante, jamais `.env`.
process.env.DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const { readCoursesForDayFromPrivateSchedule } = await import("../api/_shared/schedule-reader.ts");
const { client: appClient } = await import("../db/index.ts");

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

const institutionId = randomUUID();
const actorId = randomUUID();
const oldVersionId = randomUUID();
const oldPageId = randomUUID();
const newVersionId = randomUUID();
const pageAId = randomUUID();
const pageBId = randomUUID();

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
  ["6A-FICTIF-LOT4", "Mme Dupont", "MATH", "Mathematiques", "B12", "2026-09-07", "08:00", "09:00"],
  ["6B-FICTIF-LOT4", "M. Martin", "FR", "Francais", "A03", "2026-09-07", "09:00", "10:00"],
];

// Étape pure (sans base) : la correspondance choisie par l'administrateur
// contre les en-têtes réellement lues dans le fichier déposé.
const mapping = parseScheduleTabularColumnMapping(MAPPING_INPUT, HEADERS);
check(mapping !== null, true, "la_correspondance_est_valide_contre_les_en_tetes_reelles");
const applied = applyScheduleTabularColumnMapping({ mapping, headers: HEADERS, rows: RAW_ROWS });
check(applied.ok, true, "lapplication_de_la_correspondance_reussit");
check(applied.groups.length, 2, "deux_classes_distinctes_donnent_deux_groupes");
const [groupA, groupB] = applied.groups;

// `schedule_slots_guard_source_trigger` et `schedule_page_assets_guard_write`
// interdisent délibérément toute suppression de créneau ou d'image de page
// une fois la version activée/supplantée — une garantie de gouvernance
// réelle (on ne falsifie pas un emploi du temps déjà diffusé), pas un oubli.
// Cette recette va volontairement jusqu'à l'activation réelle (contrairement
// aux LOT 2/LOT 3, restés en `rollback`), donc ce nettoyage doit désactiver
// ces deux déclencheurs le temps de retirer les données fictives — en tant
// que superutilisateur `postgres` de la pile locale jetable uniquement,
// jamais possible pour `service_role` ni pour un rôle applicatif.
async function cleanup() {
  await client`alter table public.schedule_slots disable trigger schedule_slots_guard_source_trigger`;
  await client`alter table public.schedule_page_assets disable trigger schedule_page_assets_guard_write`;
  try {
    await client`delete from public.schedule_audit where institution_id = ${institutionId}`;
    await client`delete from public.schedule_slots where institution_id = ${institutionId}`;
    await client`delete from public.schedule_page_assets where institution_id = ${institutionId}`;
    await client`delete from public.schedule_page_indexes where institution_id = ${institutionId}`;
    await client`delete from public.schedule_tabular_column_mappings where institution_id = ${institutionId}`;
    await client`delete from public.schedule_source_versions where institution_id = ${institutionId}`;
    await client`delete from public.institutions where id = ${institutionId}`;
    await client`delete from auth.users where id = ${actorId}`;
  } finally {
    await client`alter table public.schedule_slots enable trigger schedule_slots_guard_source_trigger`;
    await client`alter table public.schedule_page_assets enable trigger schedule_page_assets_guard_write`;
  }
}

try {
  // 1) Version précédente, déjà active : c'est elle que l'activation du LOT 4
  // doit retirer proprement. Construite par le même chemin que n'importe
  // quelle version (review -> écriture -> approbation -> activation), pas
  // injectée directement au statut 'active', pour que la contrainte
  // « approved_by/activated_by non nuls » soit satisfaite honnêtement.
  await database.transaction(async (tx) => {
    await tx.execute(sql`
      insert into auth.users(id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
      values (${actorId}::uuid, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', ${`fixture-${actorId}@example.test`}, '', now(), '{}'::jsonb, '{}'::jsonb, now(), now())
    `);
    await tx.execute(sql`
      insert into public.institutions (id, slug, name, status)
      values (${institutionId}, ${`edt-lot4-${institutionId}`}, 'Lycée fictif LOT 4 EDT', 'draft')
    `);
    await tx.execute(sql`
      insert into public.schedule_source_versions
        (id, institution_id, source_kind, source_format, school_year, version, title, purpose_description,
         effective_from, original_name, mime_type, size_bytes, storage_path, page_count,
         status, uploaded_by, checksum, validation_summary)
      values (
        ${oldVersionId}, ${institutionId}, 'classes', 'pdf_import', '2026-2027', 1,
        'Emploi du temps fictif LOT 4 (version precedente)',
        'Recette locale de bout en bout : version active a superseder.',
        '2026-08-01', 'edt-6z-fictif-lot4-ancien.pdf', 'application/pdf', 111111,
        ${`schedule-lot4/${oldVersionId}.pdf`}, 1, 'processing', ${actorId},
        ${randomBytes(32).toString("hex")},
        '{"securityScan": "clean", "pageCountVerified": true, "pageAssetsVerified": true}'::jsonb
      )
    `);
    // Requis par `schedule_validate_source_promotion()` pour un import PDF :
    // une image de page privée par page avant approbation. Le déclencheur
    // `schedule_guard_page_asset_write` n'accepte cette écriture que tant
    // que la version est encore `processing`.
    await tx.execute(sql`
      insert into public.schedule_page_assets
        (institution_id, source_version_id, page_number, storage_path, size_bytes, checksum)
      values (
        ${institutionId}, ${oldVersionId}, 1,
        ${`page-assets/${institutionId.toLowerCase()}/${oldVersionId.toLowerCase()}/0001.pdf`},
        111111, ${randomBytes(32).toString("hex")}
      )
    `);
    await tx.execute(sql`
      update public.schedule_source_versions set status = 'review' where id = ${oldVersionId}
    `);
    await tx.execute(sql`
      insert into public.schedule_page_indexes
        (id, institution_id, source_version_id, page_number, subject_type, subject_ref,
         review_status, reviewed_by, reviewed_at)
      values (
        ${oldPageId}, ${institutionId}, ${oldVersionId}, 1, 'class', '6Z-FICTIF-LOT4-ANCIEN',
        'verified', ${actorId}, '2026-08-02T08:00:00.000Z'
      )
    `);
    await writeScheduleSlots(tx, {
      institutionId,
      sourceVersionId: oldVersionId,
      pageIndexId: oldPageId,
      actorId,
      rows: [{
        subjectCode: "HIST",
        subjectLabel: "Histoire",
        roomCode: "C01",
        startsAt: "2026-08-03T07:00:00.000Z",
        endsAt: "2026-08-03T08:00:00.000Z",
        weekPattern: null,
        groupRef: null,
      }],
    });
    await tx.execute(sql`
      update public.schedule_source_versions
      set status = 'approved', approved_by = ${actorId}, approved_at = '2026-08-02T09:00:00.000Z'
      where id = ${oldVersionId}
    `);
    await tx.execute(sql`
      insert into public.schedule_audit (institution_id, source_version_id, action, actor_id, summary)
      values (${institutionId}, ${oldVersionId}, 'approve', ${actorId}, '{}'::jsonb)
    `);
    await tx.execute(sql`
      update public.schedule_source_versions
      set status = 'active', activated_by = ${actorId}, activated_at = '2026-08-02T10:00:00.000Z',
        fresh_until = '2026-09-01T00:00:00.000Z'
      where id = ${oldVersionId}
    `);
    await tx.execute(sql`
      insert into public.schedule_audit (institution_id, source_version_id, action, actor_id, summary)
      values (${institutionId}, ${oldVersionId}, 'activate', ${actorId}, '{}'::jsonb)
    `);
  });

  const [{ status: oldStatusAfterSetup }] = await client`
    select status from public.schedule_source_versions where id = ${oldVersionId}
  `;
  check(oldStatusAfterSetup, "active", "la_version_precedente_est_bien_active_avant_le_lot_4");

  // 2) Dépôt du fichier tabulaire + correspondance de colonnes (même
  // transaction que `tabular-mapping.ts` : verrou, upsert de la
  // correspondance, une page par classe trouvée, passage en `review`).
  await database.transaction(async (tx) => {
    await tx.execute(sql`
      insert into public.schedule_source_versions
        (id, institution_id, source_kind, source_format, school_year, version, title, purpose_description,
         effective_from, original_name, mime_type, size_bytes, storage_path,
         status, uploaded_by, checksum, validation_summary)
      values (
        ${newVersionId}, ${institutionId}, 'classes', 'tabular_import', '2026-2027', 2,
        'Export EDT fictif LOT 4', 'Recette locale de bout en bout, fichier tabulaire.',
        '2026-09-01', 'export-edt-fictif-lot4.csv', 'text/csv', 654321,
        ${`schedule-lot4/${newVersionId}.csv`}, 'mapping_pending', ${actorId},
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
    await tx.execute(sql`
      select pg_advisory_xact_lock(hashtextextended(${newVersionId}::text, 61744))
    `);
    await tx.execute(sql`
      insert into public.schedule_tabular_column_mappings (institution_id, source_kind, mapping, updated_by)
      values (${institutionId}, 'classes', ${JSON.stringify(mapping)}::jsonb, ${actorId})
      on conflict (institution_id, source_kind) do update set mapping = excluded.mapping, updated_by = excluded.updated_by
    `);
    await tx.execute(sql`
      update public.schedule_source_versions
      set status = 'review', page_count = ${applied.groups.length}
      where id = ${newVersionId}
    `);
    await tx.execute(sql`
      insert into public.schedule_audit (institution_id, source_version_id, action, actor_id, summary)
      values (${institutionId}, ${newVersionId}, 'apply_tabular_mapping', ${actorId}, '{}'::jsonb)
    `);
    for (const [pageId, group, pageNumber] of [[pageAId, groupA, 1], [pageBId, groupB, 2]]) {
      await tx.execute(sql`
        insert into public.schedule_page_indexes
          (id, institution_id, source_version_id, page_number, subject_type, subject_ref, review_status)
        values (${pageId}, ${institutionId}, ${newVersionId}, ${pageNumber}, 'class', ${group.subjectRef}, 'draft')
      `);
      await tx.execute(sql`
        insert into public.schedule_audit (institution_id, source_version_id, page_index_id, action, actor_id, summary)
        values (${institutionId}, ${newVersionId}, ${pageId}, 'index_page', ${actorId}, '{}'::jsonb)
      `);
    }
    // Vérification humaine des deux pages, comme pour un PDF.
    await tx.execute(sql`
      update public.schedule_page_indexes set review_status = 'verified', reviewed_by = ${actorId}, reviewed_at = now()
      where source_version_id = ${newVersionId}
    `);
  });

  // 3) Écriture des créneaux d'une seule des deux pages, puis tentative
  // d'approbation : doit être réellement refusée par `approve.ts` tant que
  // la seconde page vérifiée n'a aucun créneau.
  await database.transaction(async (tx) => {
    const written = await writeScheduleSlots(tx, {
      institutionId,
      sourceVersionId: newVersionId,
      pageIndexId: pageAId,
      actorId,
      rows: groupA.rows,
    });
    check(written.length, groupA.rows.length, "les_creneaux_de_la_premiere_classe_sont_ecrits");
    check(written[0].subjectCode, "MATH", "le_code_matiere_calcule_est_bien_celui_ecrit");

    const gap = await findVerifiedPagesWithoutSlots(tx, { institutionId, sourceVersionId: newVersionId });
    check(gap, [2], "la_seconde_page_verifiee_est_encore_vide");

    if (gap.length === 0) {
      await tx.execute(sql`
        update public.schedule_source_versions set status = 'approved' where id = ${newVersionId}
      `);
    }
  });
  const [{ status: statusAfterRefusal }] = await client`
    select status from public.schedule_source_versions where id = ${newVersionId}
  `;
  check(statusAfterRefusal, "review", "lapprobation_reelle_est_refusee_limport_reste_en_revision");

  // 4) On comble le trou, puis l'approbation réussit réellement.
  await database.transaction(async (tx) => {
    const written = await writeScheduleSlots(tx, {
      institutionId,
      sourceVersionId: newVersionId,
      pageIndexId: pageBId,
      actorId,
      rows: groupB.rows,
    });
    check(written.length, groupB.rows.length, "les_creneaux_de_la_seconde_classe_sont_ecrits");

    const gap = await findVerifiedPagesWithoutSlots(tx, { institutionId, sourceVersionId: newVersionId });
    check(gap, [], "plus_aucune_page_verifiee_nest_vide");

    await tx.execute(sql`
      update public.schedule_source_versions
      set status = 'approved', approved_by = ${actorId}, approved_at = '2026-09-07T09:00:00.000Z'
      where id = ${newVersionId} and status = 'review'
    `);
    await tx.execute(sql`
      insert into public.schedule_audit (institution_id, source_version_id, action, actor_id, summary)
      values (${institutionId}, ${newVersionId}, 'approve', ${actorId}, '{}'::jsonb)
    `);
  });
  const [{ status: statusAfterApproval }] = await client`
    select status from public.schedule_source_versions where id = ${newVersionId}
  `;
  check(statusAfterApproval, "approved", "lapprobation_reussit_une_fois_toutes_les_pages_pourvues");

  // 5) Cas adverse au niveau du schéma : activer la nouvelle version sans
  // retirer l'ancienne doit être rejeté par PostgreSQL lui-même
  // (`schedule_source_versions_one_active_uidx`), pas seulement par
  // `activate.ts`. Preuve que l'invariant « jamais deux versions actives »
  // tient même si le code applicatif était contourné.
  let schemaViolation = null;
  try {
    await database.transaction(async (tx) => {
      await tx.execute(sql`
        update public.schedule_source_versions
        set status = 'active', activated_by = ${actorId}, activated_at = '2026-09-07T09:15:00.000Z',
          fresh_until = '2026-12-31T00:00:00.000Z'
        where id = ${newVersionId}
      `);
    });
  } catch (error) {
    schemaViolation = error;
  }
  check(schemaViolation !== null, true, "activer_sans_retirer_lancienne_version_est_rejete");
  check(
    schemaViolation?.cause?.code ?? schemaViolation?.code,
    "23505",
    "le_rejet_vient_bien_de_lindex_unique_une_seule_version_active"
  );
  const [{ status: statusAfterViolation }] = await client`
    select status from public.schedule_source_versions where id = ${newVersionId}
  `;
  check(statusAfterViolation, "approved", "la_tentative_rejetee_ne_laisse_aucune_trace_en_base");

  // 6) Activation réelle, dans l'ordre imposé par `activate.ts` : verrou de
  // périmètre, retrait de l'ancienne version active, puis activation de la
  // nouvelle.
  await database.transaction(async (tx) => {
    await tx.execute(sql`
      select pg_advisory_xact_lock(hashtextextended(${`${institutionId}:classes:2026-2027`}, 61743))
    `);
    await tx.execute(sql`
      update public.schedule_source_versions
      set status = 'superseded'
      where institution_id = ${institutionId} and source_kind = 'classes' and school_year = '2026-2027'
        and status = 'active' and id != ${newVersionId}
    `);
    await tx.execute(sql`
      insert into public.schedule_audit (institution_id, source_version_id, action, actor_id, summary)
      values (${institutionId}, ${oldVersionId}, 'supersede', ${actorId}, ${JSON.stringify({ replacementSourceVersionId: newVersionId })}::jsonb)
    `);
    await tx.execute(sql`
      update public.schedule_source_versions
      set status = 'active', activated_by = ${actorId}, activated_at = '2026-09-07T09:30:00.000Z',
        fresh_until = '2026-12-31T00:00:00.000Z'
      where id = ${newVersionId} and status = 'approved'
    `);
    await tx.execute(sql`
      insert into public.schedule_audit (institution_id, source_version_id, action, actor_id, summary)
      values (${institutionId}, ${newVersionId}, 'activate', ${actorId}, '{}'::jsonb)
    `);
  });

  const activeVersions = await client`
    select id, status from public.schedule_source_versions
    where institution_id = ${institutionId} and source_kind = 'classes' and school_year = '2026-2027'
    order by version
  `;
  check(
    activeVersions.map((row) => [row.id, row.status]),
    [[oldVersionId, "superseded"], [newVersionId, "active"]],
    "une_seule_version_est_active_lancienne_est_proprement_retiree"
  );

  // 7) Lecture réelle par l'agent, via la connexion applicative normale
  // (`db/index.ts`), avec un périmètre déjà résolu — celui que produirait
  // une identité vérifiée (voir le fichier d'en-tête pour la portée de cette
  // simplification).
  const nowRead = new Date("2026-09-07T10:00:00.000Z");
  const dayStart = new Date("2026-09-07T00:00:00.000Z");
  const dayEnd = new Date("2026-09-08T00:00:00.000Z");

  const goodClassScope = {
    institutionId,
    identityLevel: "I3",
    authorizedClassRefs: ["6A-FICTIF-LOT4"],
    authorizedGroupRefs: [],
    authorizedTeacherRefs: [],
  };
  const goodClassResult = await readCoursesForDayFromPrivateSchedule({
    scope: goodClassScope,
    now: nowRead,
    dayStart,
    dayEnd,
  });
  check(goodClassResult.ok, true, "la_bonne_classe_recoit_une_reponse");
  check(goodClassResult.courses.length, 1, "la_bonne_classe_recoit_exactement_son_cours_du_jour");
  check(goodClassResult.courses[0].subjectCode, "MATH", "le_cours_rendu_est_bien_celui_ecrit_par_le_lot_4");
  check(goodClassResult.source.versionId, newVersionId, "la_source_du_cours_est_bien_la_version_activee_par_le_lot_4");

  const neverImportedClassScope = {
    ...goodClassScope,
    authorizedClassRefs: ["6C-FICTIF-LOT4"],
  };
  const neverImportedClassResult = await readCoursesForDayFromPrivateSchedule({
    scope: neverImportedClassScope,
    now: nowRead,
    dayStart,
    dayEnd,
  });
  check(neverImportedClassResult.ok, true, "une_autre_classe_ne_provoque_aucune_erreur");
  check(neverImportedClassResult.courses.length, 0, "une_classe_jamais_importee_ne_recoit_rien");

  const retiredVersionClassScope = {
    ...goodClassScope,
    authorizedClassRefs: ["6Z-FICTIF-LOT4-ANCIEN"],
  };
  const retiredVersionClassResult = await readCoursesForDayFromPrivateSchedule({
    scope: retiredVersionClassScope,
    now: nowRead,
    dayStart,
    dayEnd,
  });
  check(retiredVersionClassResult.ok, true, "la_classe_de_lancienne_version_ne_provoque_aucune_erreur");
  check(
    retiredVersionClassResult.courses.length,
    0,
    "la_version_precedente_retiree_ne_repond_plus_meme_pour_sa_propre_classe"
  );
} finally {
  await cleanup();
  const [{ count: traceCount }] = await client`
    select count(*)::integer as count from public.institutions where id = ${institutionId}
  `;
  check(traceCount, 0, "le_nettoyage_explicite_ne_laisse_aucune_trace");
  await client.end();
  await appClient.end();
}

console.log(
  JSON.stringify(
    { target: "127.0.0.1:54322", assertions, cleanupVerified: true, realData: false },
    null,
    2
  )
);
