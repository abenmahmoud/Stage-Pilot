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
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import { handleEntInactifVaultRequest } from "../api/_shared/code-vault-ent-inactif-route.ts";

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
      { outcome: "displayed", remainingDisplaysToday: 2, revealedAt: "2026-09-06T08:00:00.000Z" },
      "first_reveal_succeeds_without_leaking_a_value"
    );
    check(Object.keys(firstReveal), ["outcome", "remainingDisplaysToday", "revealedAt"], "displayed_outcome_has_no_extra_field");
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
