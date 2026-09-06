// Hard-coded disposable loopback target; never inherits DATABASE_URL or loads .env.
// Recette du LOT 3 (docs/operations/PLAN_BRANCHEMENT_COFFRE_2026-09-06.md) sur
// PostgreSQL réel jetable. Personne et établissement entièrement fictifs.
// Jamais `--linked`, jamais `db push`, jamais d'URL distante.
//
// Appelle directement `handleEntInactifVaultRequest` (la même fonction que la
// route `api/vault/ent-inactif.ts`), jamais une réimplémentation de ses
// règles, pour prouver l'assemblage réel : décision d'autorisation,
// attribution, remise, et journal d'accès — y compris les deux défauts
// corrigés par ce lot (expiration de la fenêtre de visibilité, quatrième
// affichage vers le formulaire enrichi).
//
// Étendu par le LOT 3 du plan de lecture
// (`docs/operations/PLAN_LECTURE_COFFRE_2026-09-06.md`) : prouve que
// `resolveVaultCodeReveal` (branché dans `handleEntInactifVaultRequest`
// depuis ce lot) tient contre PostgreSQL réel, dans les deux sens —
//   - drapeau fermé (comportement par défaut, jamais activé pour de vrai) :
//     `value` reste `null`, motif `reveal_disabled` ;
//   - drapeau ouvert **seulement dans l'`env` passé à cet appel de fonction**
//     (jamais dans `.env.local.example`, jamais persistant) : la valeur
//     écrite par `writeVaultCodeValue` (point d'écriture du LOT 1 du plan de
//     branchement) revient déchiffrée telle quelle.
// Couvre aussi explicitement le chemin de refus « autre établissement »
// (`institution_mismatch`) exigé par le LOT 3 : aucune remise, donc aucun
// déchiffrement, n'est jamais atteignable pour un acteur d'un autre
// établissement.
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import {
  CURRENT_VAULT_ASSIGNMENT_VERSION,
  handleEntInactifVaultRequest,
} from "../api/_shared/code-vault-ent-inactif-route.ts";
import { getOrCreateVaultAssignment } from "../api/_shared/code-vault-assignment.ts";
import { writeVaultCodeValue } from "../api/_shared/code-vault-write.ts";

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

async function insertFictitiousInstitution(tx, institutionId) {
  await tx.execute(sql`
    insert into public.institutions (id, slug, name, status)
    values (${institutionId}, ${`coffre-lot3-branche-${institutionId}`}, 'Lycée fictif — LOT 3 branchement', 'draft')
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
const institutionId = randomUUID();

try {
  await database.transaction(async (tx) => {
    await insertFictitiousInstitution(tx, institutionId);

    // ---------------------------------------------------------------------
    // Scénario 1 : un refus d'autorisation (§7) écrit une ligne motivée au
    // journal, aucune attribution n'est créée. Cible différente de l'acteur
    // : structurellement impossible d'atteindre ce cas via la route HTTP
    // réelle (la cible y est toujours l'appelant lui-même), donc testé ici
    // directement contre la fonction — exactement le cas que le plan exige
    // de couvrir (« refus compris »).
    // ---------------------------------------------------------------------
    const refusedActor = { profile: "eleve", personRef: "eleve-lot3-branche-01", institutionId };
    const refusedTarget = {
      service: "ent",
      institutionId,
      subjectKind: "self",
      subjectPersonRef: "une-autre-personne",
      subjectClassRef: null,
    };
    const refused = await handleEntInactifVaultRequest(tx, {
      actor: refusedActor,
      target: refusedTarget,
      phase: "verified",
      proofChannel: "email",
      schoolYear: "2026-2027",
      now: new Date("2026-09-06T08:00:00.000Z"),
    });
    check(refused, { outcome: "denied", reason: "self_only" }, "refusal_returns_reason");
    const eventsAfterRefusal = await accessEventsFor(tx, institutionId);
    check(eventsAfterRefusal.length, 1, "refusal_writes_exactly_one_event");
    check(
      eventsAfterRefusal[0],
      {
        assignment_id: null,
        actor_person_ref: "eleve-lot3-branche-01",
        actor_profile: "eleve",
        event_type: "access_denied",
        refusal_reason: "self_only",
      },
      "refusal_event_shape"
    );
    const [{ count: assignmentsAfterRefusal }] = await tx.execute(sql`
      select count(*)::int as count from public.code_vault_assignments where institution_id = ${institutionId}
    `);
    check(assignmentsAfterRefusal, 0, "refusal_creates_no_assignment");

    // ---------------------------------------------------------------------
    // Scénario 2 : les phases qui précèdent la remise ne touchent jamais la
    // base — aucune attribution, aucun événement — seule l'action pure de
    // `decideEntInactifJourneyStep` est renvoyée.
    // ---------------------------------------------------------------------
    const selfPersonRef = "eleve-lot3-branche-self";
    const selfActor = { profile: "eleve", personRef: selfPersonRef, institutionId };
    const selfTarget = {
      service: "ent",
      institutionId,
      subjectKind: "self",
      subjectPersonRef: selfPersonRef,
      subjectClassRef: null,
    };
    const beforeProofStep = await handleEntInactifVaultRequest(tx, {
      actor: selfActor,
      target: selfTarget,
      phase: "before_proof",
      proofChannel: "email",
      schoolYear: "2026-2027",
      now: new Date("2026-09-06T08:00:00.000Z"),
    });
    check(
      beforeProofStep,
      { outcome: "step", action: { kind: "send_proof", channel: "email" } },
      "before_proof_returns_pure_action_without_touching_the_database"
    );
    const [{ count: assignmentsAfterPreSteps }] = await tx.execute(sql`
      select count(*)::int as count from public.code_vault_assignments
      where institution_id = ${institutionId} and person_ref = ${selfPersonRef}
    `);
    check(assignmentsAfterPreSteps, 0, "pre_reveal_phases_create_no_assignment");

    // ---------------------------------------------------------------------
    // Scénario 3 : la première remise réussit, journalise un `consult`, et
    // ne révèle jamais de valeur — seuls le quota restant et l'horodatage
    // sont renvoyés.
    // ---------------------------------------------------------------------
    const firstReveal = await handleEntInactifVaultRequest(tx, {
      actor: selfActor,
      target: selfTarget,
      phase: "verified",
      proofChannel: "email",
      schoolYear: "2026-2027",
      now: new Date("2026-09-06T08:00:00.000Z"),
    });
    check(
      firstReveal,
      {
        outcome: "displayed",
        remainingDisplaysToday: 2,
        revealedAt: "2026-09-06T08:00:00.000Z",
        value: null,
        reason: "reveal_disabled",
      },
      "first_reveal_succeeds_without_leaking_a_value_flag_closed_by_default"
    );
    check(
      Object.keys(firstReveal),
      ["outcome", "remainingDisplaysToday", "revealedAt", "value", "reason"],
      "displayed_outcome_has_no_extra_field"
    );
    const eventsAfterFirstReveal = await accessEventsFor(tx, institutionId);
    check(eventsAfterFirstReveal.length, 2, "reveal_appends_one_consult_event");
    check(eventsAfterFirstReveal[1].event_type, "consult", "reveal_event_type_is_consult");
    check(eventsAfterFirstReveal[1].refusal_reason, null, "consult_event_has_no_refusal_reason");

    // ---------------------------------------------------------------------
    // Scénario 4 (défaut n°1 du plan) : une remise déjà expirée (fenêtre de
    // 30 minutes dépassée) n'est jamais re-remise sur la seule foi d'une
    // phase `verified` déclarée par l'appelant — la route renvoie à
    // `before_proof`, sans incrémenter le compteur d'affichage ni avancer
    // `revealed_at`.
    // ---------------------------------------------------------------------
    const staleNow = new Date("2026-09-06T09:00:00.000Z"); // 60 minutes après la remise du scénario 3
    const staleAttempt = await handleEntInactifVaultRequest(tx, {
      actor: selfActor,
      target: selfTarget,
      phase: "verified",
      proofChannel: "email",
      schoolYear: "2026-2027",
      now: staleNow,
    });
    check(
      staleAttempt,
      { outcome: "step", action: { kind: "send_proof", channel: "email" } },
      "expired_reveal_forces_back_to_before_proof_instead_of_redisplaying"
    );
    const [afterStaleAttempt] = await tx.execute(sql`
      select display_count, revealed_at from public.code_vault_assignments
      where institution_id = ${institutionId} and person_ref = ${selfPersonRef}
    `);
    check(afterStaleAttempt.display_count, 1, "expired_reveal_attempt_does_not_increment_display_count");
    check(
      new Date(afterStaleAttempt.revealed_at).toISOString(),
      "2026-09-06T08:00:00.000Z",
      "expired_reveal_attempt_does_not_advance_revealed_at"
    );

    // ---------------------------------------------------------------------
    // Scénario 5 (défaut n°2 du plan) : le quatrième affichage refusé le
    // même jour bascule sur le formulaire enrichi, jamais une erreur brute.
    // Chaque remise reste dans la fenêtre de 30 minutes de la précédente,
    // pour isoler le quota quotidien du défaut n°1 déjà prouvé ci-dessus.
    // ---------------------------------------------------------------------
    const quotaPersonRef = "eleve-lot3-branche-quota";
    const quotaActor = { profile: "eleve", personRef: quotaPersonRef, institutionId };
    const quotaTarget = {
      service: "ent",
      institutionId,
      subjectKind: "self",
      subjectPersonRef: quotaPersonRef,
      subjectClassRef: null,
    };
    const quotaDay = new Date("2026-09-06T08:00:00.000Z");
    const secondsLater = (seconds) => new Date(quotaDay.getTime() + seconds * 1000);
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const reveal = await handleEntInactifVaultRequest(tx, {
        actor: quotaActor,
        target: quotaTarget,
        phase: "verified",
        proofChannel: "email",
        schoolYear: "2026-2027",
        now: secondsLater(attempt * 60),
      });
      check(reveal.outcome, "displayed", `quota_attempt_${attempt}_succeeds`);
      check(reveal.remainingDisplaysToday, 3 - attempt, `quota_attempt_${attempt}_remaining_count`);
    }
    const fourthAttempt = await handleEntInactifVaultRequest(tx, {
      actor: quotaActor,
      target: quotaTarget,
      phase: "verified",
      proofChannel: "email",
      schoolYear: "2026-2027",
      now: secondsLater(4 * 60),
    });
    check(
      fourthAttempt,
      { outcome: "step", action: { kind: "form_fallback", reasonCode: "ent_inactif_daily_quota_exceeded" } },
      "fourth_same_day_display_falls_back_to_the_enriched_form"
    );
    const [afterQuotaExceeded] = await tx.execute(sql`
      select display_count from public.code_vault_assignments
      where institution_id = ${institutionId} and person_ref = ${quotaPersonRef}
    `);
    check(afterQuotaExceeded.display_count, 3, "form_fallback_does_not_count_as_a_fourth_display");

    // ---------------------------------------------------------------------
    // Scénario 6 (LOT 3 du plan de lecture) : le chemin de refus « autre
    // établissement » ne crée jamais d'attribution, ne journalise jamais de
    // `consult`, et n'atteint donc jamais `resolveVaultCodeReveal`.
    // ---------------------------------------------------------------------
    // L'événement de refus est journalisé sous l'institution de la *cible*
    // (contrainte de clé étrangère réelle sur `code_vault_access_events`) :
    // elle doit donc exister, même pour prouver un refus.
    const otherInstitutionId = randomUUID();
    await insertFictitiousInstitution(tx, otherInstitutionId);
    const otherInstitutionActor = { profile: "eleve", personRef: "eleve-lot3-lecture-autre-etab", institutionId };
    const otherInstitutionTarget = {
      service: "ent",
      institutionId: otherInstitutionId,
      subjectKind: "self",
      subjectPersonRef: "eleve-lot3-lecture-autre-etab",
      subjectClassRef: null,
    };
    const institutionMismatch = await handleEntInactifVaultRequest(tx, {
      actor: otherInstitutionActor,
      target: otherInstitutionTarget,
      phase: "verified",
      proofChannel: "email",
      schoolYear: "2026-2027",
      now: new Date("2026-09-06T08:00:00.000Z"),
    });
    check(
      institutionMismatch,
      { outcome: "denied", reason: "institution_mismatch" },
      "other_institution_actor_is_denied_before_any_reveal_attempt"
    );

    // ---------------------------------------------------------------------
    // Scénario 7 (LOT 3 du plan de lecture) : round-trip réel de
    // `resolveVaultCodeReveal` contre PostgreSQL — drapeau fermé par défaut
    // (comme partout ailleurs dans ce dépôt), puis ouvert seulement dans
    // l'`env` de cet appel pour prouver que le déchiffrement fonctionne
    // effectivement, sans jamais toucher `.env.local.example`.
    // ---------------------------------------------------------------------
    const revealPersonRef = "eleve-lot3-lecture-reveal";
    const revealActor = { profile: "eleve", personRef: revealPersonRef, institutionId };
    const revealTarget = {
      service: "ent",
      institutionId,
      subjectKind: "self",
      subjectPersonRef: revealPersonRef,
      subjectClassRef: null,
    };
    const revealCryptoEnv = {
      CODE_VAULT_ENCRYPTION_KEY_VERSION: "v1",
      CODE_VAULT_ENCRYPTION_KEY_V1: randomBytes(32).toString("base64"),
    };
    const revealAssignment = await getOrCreateVaultAssignment(tx, {
      institutionId,
      personRef: revealPersonRef,
      service: "ent",
      schoolYear: "2026-2027",
      version: CURRENT_VAULT_ASSIGNMENT_VERSION,
    });
    const REVEAL_FIXTURE_VALUE = "Ent2026EleveLot3Lecture";
    await writeVaultCodeValue(tx, {
      assignmentId: revealAssignment.id,
      institutionId,
      value: REVEAL_FIXTURE_VALUE,
      env: revealCryptoEnv,
    });

    const closedFlagReveal = await handleEntInactifVaultRequest(tx, {
      actor: revealActor,
      target: revealTarget,
      phase: "verified",
      proofChannel: "email",
      schoolYear: "2026-2027",
      now: new Date("2026-09-06T08:00:00.000Z"),
      env: revealCryptoEnv, // drapeau absent de cet env : reste fermé, comme process.env par défaut
    });
    check(closedFlagReveal.outcome, "displayed", "reveal_scenario_first_display_succeeds");
    check(closedFlagReveal.value, null, "reveal_flag_closed_by_default_keeps_value_null_even_with_a_real_row");
    check(closedFlagReveal.reason, "reveal_disabled", "reveal_flag_closed_reason_is_explicit");

    const openFlagReveal = await handleEntInactifVaultRequest(tx, {
      actor: revealActor,
      target: revealTarget,
      phase: "verified",
      proofChannel: "email",
      schoolYear: "2026-2027",
      now: new Date("2026-09-06T08:05:00.000Z"), // toujours dans la fenêtre de visibilité de 30 minutes
      env: { ...revealCryptoEnv, CODE_VAULT_REVEAL_ENABLED: "true" }, // ouvert seulement ici, jamais persisté
    });
    check(openFlagReveal.outcome, "displayed", "reveal_scenario_second_display_succeeds");
    check(
      openFlagReveal.value,
      REVEAL_FIXTURE_VALUE,
      "reveal_flag_open_returns_the_real_decrypted_value_round_tripped_through_postgresql"
    );
    check(openFlagReveal.reason, null, "reveal_flag_open_reason_is_null_when_a_value_is_returned");

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
  const [{ count }] = await verifier`
    select count(*)::integer as count from public.institutions where id = ${institutionId}
  `;
  check(count, 0, "rollback_scenario_left_no_trace");
} finally {
  await verifier.end();
}

console.log(
  JSON.stringify({ target: "127.0.0.1:54322", assertions, rollbackVerified: true, realData: false })
);
