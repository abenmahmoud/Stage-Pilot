// Hard-coded disposable loopback target; never inherits DATABASE_URL or loads .env.
// Recette du LOT 2 (`docs/operations/PLAN_IMPORT_UTILISABLE_2026-09-07.md`) sur
// PostgreSQL réel jetable. Établissement, personnel et emploi du temps
// entièrement fictifs. Jamais `--linked`, jamais `db push`, jamais d'URL
// distante.
//
// Avant ce lot, `approve.ts` n'exigeait que la vérification humaine de
// chaque page, jamais la présence de créneaux réellement écrits pour elle.
// Un import entièrement vide (aucun appel à `writeScheduleSlots`) ou un
// renvoi vide après coup pouvait donc être approuvé puis activé sans que
// personne ne s'en aperçoive. Cette recette prouve que
// `findVerifiedPagesWithoutSlots` (`api/_shared/schedule-slot-write.ts`)
// détecte réellement une page vérifiée sans créneau en base, que la même
// transaction que celle jouée par `approve.ts` refuse alors de promouvoir la
// version, et qu'écrire les créneaux manquants lève le blocage — pas
// seulement une hypothèse sur le comportement de la requête.
//
// Portée : ceci rejoue la logique de transaction d'`approve.ts` (verrou,
// garde, mise à jour) directement en SQL réel, pas la route HTTP complète
// avec authentification Supabase — voir `docs/operations/night-logs/UTIL-LOT2.md`
// pour ce qui reste non vérifié à ce niveau.
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import {
  findVerifiedPagesWithoutSlots,
  writeScheduleSlots,
} from "../api/_shared/schedule-slot-write.ts";

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
const filledPageId = randomUUID();
const emptyPageId = randomUUID();

const mondayMaths = {
  subjectCode: "MATH",
  subjectLabel: "Mathématiques",
  roomCode: "B12",
  startsAt: "2026-09-07T06:00:00.000Z",
  endsAt: "2026-09-07T07:00:00.000Z",
  weekPattern: null,
  groupRef: null,
};

// Rejoue la mise à jour telle qu'écrite dans `approve.ts` : refuse tant que
// `findVerifiedPagesWithoutSlots` rapporte au moins une page.
async function attemptApproval(tx) {
  const emptyPages = await findVerifiedPagesWithoutSlots(tx, {
    institutionId,
    sourceVersionId,
  });
  if (emptyPages.length > 0) {
    return { approved: false, emptyPages };
  }
  await tx.execute(sql`
    update public.schedule_source_versions
    set status = 'approved', approved_by = ${actorId}, approved_at = now()
    where id = ${sourceVersionId} and status = 'review'
  `);
  return { approved: true, emptyPages };
}

try {
  await database.transaction(async (tx) => {
    await tx.execute(sql`
      insert into auth.users(id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
      values (${actorId}::uuid, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', ${`fixture-${actorId}@example.test`}, '', now(), '{}'::jsonb, '{}'::jsonb, now(), now())
    `);
    await tx.execute(sql`
      insert into public.institutions (id, slug, name, status)
      values (${institutionId}, ${`edt-lot2-${institutionId}`}, 'Lycée fictif LOT 2 EDT', 'draft')
    `);
    await tx.execute(sql`
      insert into public.schedule_source_versions
        (id, institution_id, source_kind, school_year, version, title, purpose_description,
         effective_from, original_name, mime_type, size_bytes, storage_path, page_count,
         status, uploaded_by, checksum, validation_summary)
      values (
        ${sourceVersionId}, ${institutionId}, 'classes', '2026-2027', 1,
        'Emploi du temps fictif LOT 2', 'Recette locale du verrou d''approbation.',
        '2026-09-07', 'edt-6a-6b-fictif-lot2.pdf', 'application/pdf', 123456,
        ${`schedule-lot2/${sourceVersionId}.pdf`}, 2, 'processing', ${actorId},
        ${randomBytes(32).toString("hex")},
        '{"securityScan": "clean", "pageCountVerified": true, "pageAssetsVerified": true}'::jsonb
      )
    `);
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
    // Les deux pages sont vérifiées par un humain : rien ne distingue plus
    // "6A" de "6B" au niveau du contrôle de page existant avant ce lot.
    await tx.execute(sql`
      insert into public.schedule_page_indexes
        (id, institution_id, source_version_id, page_number, subject_type, subject_ref,
         review_status, reviewed_by, reviewed_at)
      values (
        ${filledPageId}, ${institutionId}, ${sourceVersionId}, 1, 'class', '6A-FICTIF-LOT2',
        'verified', ${actorId}, now()
      )
    `);
    await tx.execute(sql`
      insert into public.schedule_page_indexes
        (id, institution_id, source_version_id, page_number, subject_type, subject_ref,
         review_status, reviewed_by, reviewed_at)
      values (
        ${emptyPageId}, ${institutionId}, ${sourceVersionId}, 2, 'class', '6B-FICTIF-LOT2',
        'verified', ${actorId}, now()
      )
    `);

    // Une seule des deux pages vérifiées porte réellement des créneaux.
    await writeScheduleSlots(tx, {
      institutionId,
      sourceVersionId,
      pageIndexId: filledPageId,
      actorId,
      rows: [mondayMaths],
    });

    const beforeFix = await findVerifiedPagesWithoutSlots(tx, {
      institutionId,
      sourceVersionId,
    });
    check(beforeFix, [2], "la_page_verifiee_sans_creneau_est_detectee");

    const firstAttempt = await attemptApproval(tx);
    check(firstAttempt.approved, false, "lapprobation_est_refusee_tant_quune_page_est_vide");
    check(firstAttempt.emptyPages, [2], "le_refus_designe_la_bonne_page");

    const statusAfterRefusal = await tx.execute(sql`
      select status from public.schedule_source_versions where id = ${sourceVersionId}
    `);
    check(
      statusAfterRefusal[0].status,
      "review",
      "la_version_reste_en_revision_apres_le_refus_reel_en_base"
    );

    // On comble le trou : la page vide reçoit enfin ses créneaux.
    await writeScheduleSlots(tx, {
      institutionId,
      sourceVersionId,
      pageIndexId: emptyPageId,
      actorId,
      rows: [mondayMaths],
    });

    const afterFix = await findVerifiedPagesWithoutSlots(tx, {
      institutionId,
      sourceVersionId,
    });
    check(afterFix, [], "plus_aucune_page_verifiee_nest_vide_apres_lecriture");

    const secondAttempt = await attemptApproval(tx);
    check(secondAttempt.approved, true, "lapprobation_reussit_une_fois_toutes_les_pages_pourvues");

    const statusAfterApproval = await tx.execute(sql`
      select status from public.schedule_source_versions where id = ${sourceVersionId}
    `);
    check(
      statusAfterApproval[0].status,
      "approved",
      "la_version_est_reellement_approuvee_en_base_une_fois_le_trou_comble"
    );

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
