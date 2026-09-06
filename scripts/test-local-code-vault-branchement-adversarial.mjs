// Hard-coded disposable loopback target; never inherits DATABASE_URL or loads .env.
// Recette ADVERSE de bout en bout du LOT 6
// (docs/operations/PLAN_BRANCHEMENT_COFFRE_2026-09-06.md) sur PostgreSQL réel
// jetable. Personnes et établissements entièrement fictifs. Jamais
// `--linked`, jamais `db push`, jamais d'URL distante.
//
// Différence assumée avec `test-local-code-vault-adversarial.mjs` (LOT 6 du
// plan du 5 septembre 2026, encore présent et non touché par ce lot) : ce
// script-ci assemble le scénario complet en appelant les ROUTES réelles du
// 6 septembre (`handleEntInactifVaultRequest`, LOT 3 ;
// `handleServiceDeliveryVaultRequest`, LOT 4), jamais `decideVaultAccess`
// directement — le script du 5 septembre prouvait les briques, celui-ci
// prouve leur assemblage, comme l'exige le plan (« l'assemblage testé est
// celui de la route réelle, pas un script qui imite ce qu'une route
// ferait »).
//
// À prouver (texte exact du plan, §LOT 6) : un refus laisse une ligne
// motivée au journal ; une remise après expiration exige une nouvelle
// preuve ; le quatrième affichage renvoie au formulaire ; parent -> enfant
// reste refusé ; un membre d'un autre établissement ne voit rien ; et le
// balayage anti-fuite sur le scénario complet ne trouve aucune valeur de
// code dans une trace, un journal, une réponse d'erreur ou un contexte de
// modèle.
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import { handleEntInactifVaultRequest } from "../api/_shared/code-vault-ent-inactif-route.ts";
import { handleServiceDeliveryVaultRequest } from "../api/_shared/code-vault-service-delivery-route.ts";
import { writeVaultCodeValue } from "../api/_shared/code-vault-write.ts";
import { decryptVaultCodeValue } from "../shared/code-vault-crypto.ts";
import { buildModelVisibleVaultFact } from "../shared/code-vault-policy.ts";

if (process.argv.length !== 3 || process.argv[2] !== "--local-stack-only") {
  throw new Error("local_stack_confirmation_required");
}

// ---------------------------------------------------------------------------
// Balayage anti-fuite (« une trace ») : capture tout ce que ce script écrit
// sur la sortie standard/erreur pendant toute son exécution, pour prouver par
// lecture — pas par confiance — qu'un marqueur fictif de valeur n'y apparaît
// jamais, quel que soit le parcours emprunté.
// ---------------------------------------------------------------------------
const capturedOutput = [];
const originalConsoleLog = console.log.bind(console);
const originalConsoleError = console.error.bind(console);
console.log = (...args) => {
  capturedOutput.push(args.map(String).join(" "));
  originalConsoleLog(...args);
};
console.error = (...args) => {
  capturedOutput.push(args.map(String).join(" "));
  originalConsoleError(...args);
};

const FICTITIOUS_VALUE = `LOT6-BRANCHE-VALEUR-${randomUUID()}`;
const FICTITIOUS_VALUE_SECOND = `LOT6-BRANCHE-VALEUR-BIS-${randomUUID()}`;
const testEnv = {
  CODE_VAULT_ENCRYPTION_KEY_VERSION: "v1",
  CODE_VAULT_ENCRYPTION_KEY_V1: randomBytes(32).toString("base64"),
};

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

async function insertFictitiousInstitution(tx, institutionId, name) {
  await tx.execute(sql`
    insert into public.institutions (id, slug, name, status)
    values (${institutionId}, ${`coffre-lot6-branche-${institutionId}`}, ${name}, 'draft')
  `);
}

async function accessEventsFor(tx, institutionId) {
  const rows = await tx.execute(sql`
    select assignment_id, actor_person_ref, actor_profile, event_type, refusal_reason
    from public.code_vault_access_events
    where institution_id = ${institutionId}
    order by id asc
  `);
  return Array.from(rows);
}

const rollback = new Error("intentional_fixture_rollback");
const institutionC = randomUUID(); // l'établissement ciblé par le scénario
const institutionB = randomUUID(); // « un autre établissement »
let writePointErrorText = "";

try {
  await database.transaction(async (tx) => {
    await insertFictitiousInstitution(tx, institutionC, "Lycée fictif C — LOT 6 branchement");
    await insertFictitiousInstitution(tx, institutionB, "Lycée fictif B — LOT 6 branchement (autre établissement)");

    // -------------------------------------------------------------------
    // Scénario 1 — un refus, via la route réelle assemblée (LOT 4,
    // `handleServiceDeliveryVaultRequest`), laisse exactement une ligne
    // motivée au journal, aucune attribution créée : le cas choisi est
    // précisément « parent -> enfant », qui est à la fois un refus motivé
    // ET la garantie « parent -> enfant reste refusé » exigée par le plan.
    // -------------------------------------------------------------------
    const parentActor = { profile: "parent", personRef: "parent-lot6-branche-01", institutionId: institutionC };
    const childTarget = {
      service: "cantine",
      institutionId: institutionC,
      subjectKind: "student",
      subjectPersonRef: "enfant-lot6-branche-01",
      subjectClassRef: null,
    };
    const parentAttempt = await handleServiceDeliveryVaultRequest(tx, {
      journeyType: "cantine",
      actor: parentActor,
      target: childTarget,
      phase: "verified",
      proofChannel: "email",
      schoolYear: "2026-2027",
      now: new Date("2026-09-06T08:00:00.000Z"),
    });
    check(parentAttempt, { outcome: "denied", reason: "parent_to_child_forbidden" }, "parent_to_child_refused_by_the_real_route");
    check(Object.keys(parentAttempt).includes("value"), false, "parent_denial_response_has_no_value_field");
    const eventsAfterParent = await accessEventsFor(tx, institutionC);
    check(eventsAfterParent.length, 1, "refusal_writes_exactly_one_motivated_event");
    check(
      eventsAfterParent[0],
      {
        assignment_id: null,
        actor_person_ref: "parent-lot6-branche-01",
        actor_profile: "parent",
        event_type: "access_denied",
        refusal_reason: "parent_to_child_forbidden",
      },
      "refusal_event_shape_is_fully_motivated"
    );
    const [{ count: childAssignments }] = await tx.execute(sql`
      select count(*)::int as count from public.code_vault_assignments
      where institution_id = ${institutionC} and person_ref = 'enfant-lot6-branche-01'
    `);
    check(childAssignments, 0, "no_assignment_created_for_the_refused_child");

    // « Un contexte de modèle » : ce que l'IA recevrait au sujet de ce refus
    // ne porte structurellement aucun champ de valeur.
    const modelFactForParentDenial = buildModelVisibleVaultFact({
      service: "cantine",
      status: null,
      validationRequired: true,
      deliveryAuthorized: false,
      refusalReason: "parent_to_child_forbidden",
      receipt: null,
    });
    check(Object.keys(modelFactForParentDenial).includes("value"), false, "model_visible_fact_for_denial_has_no_value_field");

    // -------------------------------------------------------------------
    // Scénario 2 — un membre d'un autre établissement, via la même route
    // réelle assemblée, ne voit rien : refusé par `institution_mismatch`
    // avant même la question du service, aucune trace laissée dans SON
    // propre établissement (institutionB).
    // -------------------------------------------------------------------
    const otherInstitutionActor = { profile: "service", institutionId: institutionB, grantedServices: ["administration"] };
    const otherInstitutionTarget = {
      service: "koxo",
      institutionId: institutionC,
      subjectKind: "institution_wide",
      subjectPersonRef: null,
      subjectClassRef: null,
    };
    const otherInstitutionAttempt = await handleServiceDeliveryVaultRequest(tx, {
      journeyType: "koxo",
      actor: otherInstitutionActor,
      target: otherInstitutionTarget,
      phase: "verified",
      proofChannel: "email",
      schoolYear: "2026-2027",
      now: new Date("2026-09-06T08:00:00.000Z"),
    });
    check(otherInstitutionAttempt, { outcome: "denied", reason: "institution_mismatch" }, "other_institution_member_sees_nothing");
    const eventsAfterOtherInstitution = await accessEventsFor(tx, institutionC);
    check(eventsAfterOtherInstitution.length, 2, "second_refusal_appends_one_more_motivated_event");
    check(
      eventsAfterOtherInstitution[1],
      {
        assignment_id: null,
        actor_person_ref: null,
        actor_profile: "service",
        event_type: "access_denied",
        refusal_reason: "institution_mismatch",
      },
      "other_institution_refusal_event_shape"
    );
    const eventsForOtherInstitutionItself = await accessEventsFor(tx, institutionB);
    check(eventsForOtherInstitutionItself.length, 0, "nothing_is_ever_written_under_the_other_institution_either");

    // -------------------------------------------------------------------
    // Scénario 3 — une remise après expiration exige une nouvelle preuve,
    // via la route réelle ENT inactif (LOT 3) : self-service élève, jamais
    // un contournement direct de `decideVaultAccess`.
    // -------------------------------------------------------------------
    const expiryPersonRef = "eleve-lot6-branche-expiration";
    const expiryActor = { profile: "eleve", personRef: expiryPersonRef, institutionId: institutionC };
    const expiryTarget = {
      service: "ent",
      institutionId: institutionC,
      subjectKind: "self",
      subjectPersonRef: expiryPersonRef,
      subjectClassRef: null,
    };
    const firstReveal = await handleEntInactifVaultRequest(tx, {
      actor: expiryActor,
      target: expiryTarget,
      phase: "verified",
      proofChannel: "email",
      schoolYear: "2026-2027",
      now: new Date("2026-09-06T08:00:00.000Z"),
    });
    check(firstReveal.outcome, "displayed", "first_reveal_succeeds");
    // Depuis le LOT 3 du plan de lecture (`PLAN_LECTURE_COFFRE_2026-09-06.md`),
    // la réponse porte structurellement `value`/`reason` — mais le drapeau
    // `CODE_VAULT_REVEAL_ENABLED` reste fermé par défaut ici (aucun `env` de
    // recette ne l'ouvre pour cette personne), donc `value` reste `null`.
    check(
      Object.keys(firstReveal),
      ["outcome", "remainingDisplaysToday", "revealedAt", "value", "reason"],
      "first_reveal_response_shape"
    );
    check(firstReveal.value, null, "first_reveal_carries_no_value_flag_closed_by_default");
    check(firstReveal.reason, "reveal_disabled", "first_reveal_reason_is_explicit");

    const staleAttempt = await handleEntInactifVaultRequest(tx, {
      actor: expiryActor,
      target: expiryTarget,
      phase: "verified",
      proofChannel: "email",
      schoolYear: "2026-2027",
      now: new Date("2026-09-06T09:00:00.000Z"), // 60 minutes plus tard : fenêtre de 30 minutes dépassée
    });
    check(
      staleAttempt,
      { outcome: "step", action: { kind: "send_proof", channel: "email" } },
      "redisplay_after_expiry_demands_a_new_proof_instead_of_redisplaying"
    );
    const [afterStaleAttempt] = await tx.execute(sql`
      select display_count, revealed_at from public.code_vault_assignments
      where institution_id = ${institutionC} and person_ref = ${expiryPersonRef}
    `);
    check(afterStaleAttempt.display_count, 1, "expired_redisplay_attempt_does_not_increment_display_count");
    check(
      new Date(afterStaleAttempt.revealed_at).toISOString(),
      "2026-09-06T08:00:00.000Z",
      "expired_redisplay_attempt_does_not_advance_revealed_at"
    );

    // -------------------------------------------------------------------
    // Scénario 4 — le quatrième affichage du jour renvoie au formulaire
    // enrichi, via la route réelle « cantine » (LOT 4) — parcours distinct
    // du scénario 3, pour prouver que la garantie tient sur les deux
    // routes assemblées, pas seulement celle déjà recettée au LOT 3.
    // -------------------------------------------------------------------
    const quotaPersonRef = "eleve-lot6-branche-quota";
    const quotaActor = { profile: "eleve", personRef: quotaPersonRef, institutionId: institutionC };
    const quotaTarget = {
      service: "cantine",
      institutionId: institutionC,
      subjectKind: "self",
      subjectPersonRef: quotaPersonRef,
      subjectClassRef: null,
    };
    const quotaDay = new Date("2026-09-06T08:00:00.000Z");
    const secondsLater = (seconds) => new Date(quotaDay.getTime() + seconds * 1000);
    let lastAssignmentIdForQuotaPerson = null;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const reveal = await handleServiceDeliveryVaultRequest(tx, {
        journeyType: "cantine",
        actor: quotaActor,
        target: quotaTarget,
        phase: "verified",
        proofChannel: "email",
        schoolYear: "2026-2027",
        now: secondsLater(attempt * 60),
      });
      check(reveal.outcome, "displayed", `cantine_display_${attempt}_of_3_succeeds`);
    }
    const fourthAttempt = await handleServiceDeliveryVaultRequest(tx, {
      journeyType: "cantine",
      actor: quotaActor,
      target: quotaTarget,
      phase: "verified",
      proofChannel: "email",
      schoolYear: "2026-2027",
      now: secondsLater(4 * 60),
    });
    check(
      fourthAttempt,
      { outcome: "step", action: { kind: "form_fallback", reasonCode: "cantine_daily_quota_exceeded" } },
      "fourth_same_day_display_falls_back_to_the_enriched_form_on_the_service_delivery_route"
    );
    const [afterQuotaExceeded] = await tx.execute(sql`
      select id, display_count from public.code_vault_assignments
      where institution_id = ${institutionC} and person_ref = ${quotaPersonRef}
    `);
    check(afterQuotaExceeded.display_count, 3, "form_fallback_does_not_count_as_a_fourth_display");
    lastAssignmentIdForQuotaPerson = afterQuotaExceeded.id;

    // -------------------------------------------------------------------
    // « Une réponse d'erreur » — le seul point d'écriture réel du chiffre
    // (LOT 1/2) réutilisé tel quel, sur une attribution déjà créée par
    // l'assemblage ci-dessus, pour fermer la boucle : une vraie valeur
    // traverse réellement le système une fois (écriture réussie), puis une
    // tentative de deuxième écriture sur la même attribution déclenche une
    // vraie erreur Postgres, sanitisée avant de remonter à l'appelant.
    // -------------------------------------------------------------------
    await writeVaultCodeValue(tx, {
      assignmentId: lastAssignmentIdForQuotaPerson,
      institutionId: institutionC,
      value: FICTITIOUS_VALUE,
      env: testEnv,
    });
    const [storedRow] = await tx.execute(sql`
      select key_version, payload_schema, iv, auth_tag, ciphertext
      from public.code_vault_private_rows
      where assignment_id = ${lastAssignmentIdForQuotaPerson} and institution_id = ${institutionC}
    `);
    check(storedRow.ciphertext.includes(FICTITIOUS_VALUE), false, "stored_ciphertext_never_contains_the_plaintext_marker");
    const decrypted = decryptVaultCodeValue({
      envelope: {
        keyVersion: storedRow.key_version,
        payloadSchema: storedRow.payload_schema,
        iv: storedRow.iv,
        authTag: storedRow.auth_tag,
        ciphertext: storedRow.ciphertext,
      },
      institutionId: institutionC,
      assignmentId: lastAssignmentIdForQuotaPerson,
      key: Buffer.from(testEnv.CODE_VAULT_ENCRYPTION_KEY_V1, "base64"),
    });
    check(decrypted, FICTITIOUS_VALUE, "the_real_value_is_recoverable_only_through_decryption_proving_it_actually_transited");

    await tx.execute(sql`savepoint before_duplicate_write_attempt`);
    let duplicateWriteError = null;
    try {
      await writeVaultCodeValue(tx, {
        assignmentId: lastAssignmentIdForQuotaPerson,
        institutionId: institutionC,
        value: FICTITIOUS_VALUE_SECOND,
        env: testEnv,
      });
    } catch (error) {
      duplicateWriteError = error;
    }
    check(duplicateWriteError !== null, true, "second_write_on_the_same_assignment_is_rejected");
    writePointErrorText = `${duplicateWriteError?.message ?? ""} ${JSON.stringify(duplicateWriteError ?? {})}`;
    check(writePointErrorText.includes(FICTITIOUS_VALUE), false, "error_response_never_echoes_the_first_value");
    check(writePointErrorText.includes(FICTITIOUS_VALUE_SECOND), false, "error_response_never_echoes_the_rejected_second_value");
    check("cause" in (duplicateWriteError ?? {}), false, "sanitized_write_error_carries_no_cause_reference_to_the_raw_pg_error");
    check("detail" in (duplicateWriteError ?? {}), false, "sanitized_write_error_carries_no_detail_field");
    await tx.execute(sql`rollback to savepoint before_duplicate_write_attempt`);

    // -------------------------------------------------------------------
    // Balayage anti-fuite (« un journal ») sur le contenu réel des lignes
    // écrites par l'ensemble du scénario, dans les deux établissements.
    // -------------------------------------------------------------------
    const likePattern1 = `%${FICTITIOUS_VALUE}%`;
    const likePattern2 = `%${FICTITIOUS_VALUE_SECOND}%`;
    const rowContentLeakScan = await tx.execute(sql`
      select 'code_vault_assignments' as tbl from public.code_vault_assignments
      where institution_id in (${institutionC}, ${institutionB})
        and (
          person_ref ilike ${likePattern1} or person_ref ilike ${likePattern2}
          or coalesce(defective_reason, '') ilike ${likePattern1}
          or coalesce(defective_reason, '') ilike ${likePattern2}
        )
      union all
      select 'code_vault_access_events' from public.code_vault_access_events
      where institution_id in (${institutionC}, ${institutionB})
        and (
          coalesce(actor_person_ref, '') ilike ${likePattern1} or coalesce(actor_person_ref, '') ilike ${likePattern2}
          or coalesce(refusal_reason, '') ilike ${likePattern1} or coalesce(refusal_reason, '') ilike ${likePattern2}
        )
    `);
    check(rowContentLeakScan.length, 0, "fictitious_value_markers_never_stored_in_any_free_text_column");

    throw rollback;
  });
} catch (error) {
  if (error !== rollback) throw error;
} finally {
  await client.end();
}

// Le résultat du finding est déjà vérifié dans la transaction ci-dessus ;
// `writePointErrorText` reste disponible pour le compte rendu, volontairement
// non ré-affirmé ici en double.
void writePointErrorText;

// ---------------------------------------------------------------------------
// Vérifications post-transaction, après annulation complète du scénario :
// aucune trace en base, et « ne voit rien » confirmé au niveau du privilège
// de base, pas seulement de la décision applicative.
// ---------------------------------------------------------------------------
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
  const [{ count: institutionCTraceCount }] = await verifier`
    select count(*)::integer as count from public.institutions where id = ${institutionC}
  `;
  check(institutionCTraceCount, 0, "rollback_left_no_trace_of_institution_c");
  const [{ count: institutionBTraceCount }] = await verifier`
    select count(*)::integer as count from public.institutions where id = ${institutionB}
  `;
  check(institutionBTraceCount, 0, "rollback_left_no_trace_of_institution_b");

  const grantsRows = await verifier`
    select table_name, grantee from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name in ('code_vault_assignments', 'code_vault_private_rows', 'code_vault_access_events')
      and grantee in ('anon', 'authenticated', 'public')
  `;
  check(grantsRows.length, 0, "no_client_role_has_any_privilege_on_vault_tables_regardless_of_institution");
} finally {
  await verifier.end();
}

// ---------------------------------------------------------------------------
// Balayage anti-fuite final (« une trace ») : les deux marqueurs fictifs ne
// doivent apparaître dans AUCUNE ligne de sortie capturée pendant toute
// l'exécution de ce script, quelle que soit la route empruntée.
// ---------------------------------------------------------------------------
console.log = originalConsoleLog;
console.error = originalConsoleError;
const leakedInOutput = capturedOutput.filter(
  (line) => line.includes(FICTITIOUS_VALUE) || line.includes(FICTITIOUS_VALUE_SECOND)
);
check(leakedInOutput, [], "fictitious_value_markers_never_appear_in_any_captured_output_line");

console.log(
  JSON.stringify(
    {
      target: "127.0.0.1:54322",
      assertions,
      rollbackVerified: true,
      realData: false,
    },
    null,
    2
  )
);
