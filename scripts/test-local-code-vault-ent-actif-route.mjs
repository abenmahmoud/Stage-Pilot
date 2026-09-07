// Hard-coded disposable loopback target; never inherits DATABASE_URL or loads .env.
// Recette du LOT 1 (docs/operations/PLAN_ENT_ACTIF_ET_DETTE_2026-09-06.md) sur
// PostgreSQL réel jetable. Personnes et établissement entièrement fictifs.
// Jamais `--linked`, jamais `db push`, jamais d'URL distante.
//
// Appelle directement `handleEntActifVaultRequest` (la même fonction que la
// route `api/vault/ent-actif.ts`), jamais une réimplémentation de ses
// règles. Preuve que l'assemblage tient contre une vraie base : décision
// d'autorisation (refus compris), confirmation d'activation, et escalade
// support idempotente — sans jamais toucher `code_vault_assignments` ni
// `resolveVaultCodeReveal`, puisque ce parcours ne remet aucun code.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import { handleEntActifVaultRequest } from "../api/_shared/code-vault-ent-actif-route.ts";

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
    values (${institutionId}, ${`coffre-lot1-ent-actif-${institutionId}`}, 'Lycée fictif — LOT 1 ENT actif', 'draft')
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

async function supportRequestsFor(tx, institutionId) {
  const rows = await tx.execute(sql`
    select public_code, assigned_team, category, subcategory, subject_context
    from public.support_requests
    where institution_id = ${institutionId}
    order by created_at asc
  `);
  return Array.from(rows);
}

async function supportEventsFor(tx, institutionId) {
  const rows = await tx.execute(sql`
    select se.event_type
    from public.support_events se
    join public.support_requests sr on sr.id = se.request_id
    where sr.institution_id = ${institutionId}
    order by se.id asc
  `);
  return Array.from(rows);
}

const rollback = new Error("intentional_fixture_rollback");
const institutionId = randomUUID();

try {
  await database.transaction(async (tx) => {
    await insertFictitiousInstitution(tx, institutionId);

    // -----------------------------------------------------------------
    // Scénario 1 : un refus d'autorisation (autre établissement) écrit une
    // ligne motivée au journal, sans créer de ticket — même garantie que
    // les quatre autres parcours (LOT 3/4 du plan de branchement).
    // -----------------------------------------------------------------
    const otherInstitutionId = randomUUID();
    await insertFictitiousInstitution(tx, otherInstitutionId);
    const refusedActor = { profile: "eleve", personRef: "eleve-lot1-refuse", institutionId };
    const refusedTarget = {
      service: "ent",
      institutionId: otherInstitutionId,
      subjectKind: "self",
      subjectPersonRef: "eleve-lot1-refuse",
      subjectClassRef: null,
    };
    const refused = await handleEntActifVaultRequest(tx, {
      actor: refusedActor,
      target: refusedTarget,
      outcome: "start",
    });
    check(refused, { outcome: "denied", reason: "institution_mismatch" }, "refusal_returns_reason");
    const eventsAfterRefusal = await accessEventsFor(tx, otherInstitutionId);
    check(eventsAfterRefusal.length, 1, "refusal_writes_exactly_one_event");
    check(
      eventsAfterRefusal[0],
      {
        assignment_id: null,
        actor_person_ref: "eleve-lot1-refuse",
        actor_profile: "eleve",
        event_type: "access_denied",
        refusal_reason: "institution_mismatch",
      },
      "refusal_event_shape"
    );
    const [{ count: requestsAfterRefusal }] = await tx.execute(sql`
      select count(*)::int as count from public.support_requests where institution_id = ${otherInstitutionId}
    `);
    check(requestsAfterRefusal, 0, "refusal_creates_no_support_ticket");

    // -----------------------------------------------------------------
    // Scénario 2 : `outcome: "start"` renvoie l'action pure
    // `guide_password_reset` sans jamais toucher la base — ni journal, ni
    // attribution, ni ticket. Ce parcours ne remet aucun code : il n'a donc
    // pas d'attribution à créer.
    // -----------------------------------------------------------------
    const selfPersonRef = "eleve-lot1-self";
    const selfActor = { profile: "eleve", personRef: selfPersonRef, institutionId };
    const selfTarget = {
      service: "ent",
      institutionId,
      subjectKind: "self",
      subjectPersonRef: selfPersonRef,
      subjectClassRef: null,
    };
    const startStep = await handleEntActifVaultRequest(tx, {
      actor: selfActor,
      target: selfTarget,
      outcome: "start",
    });
    check(
      startStep,
      { outcome: "step", action: { kind: "guide_password_reset" } },
      "start_outcome_returns_the_pure_guide_action"
    );
    const eventsAfterStart = await accessEventsFor(tx, institutionId);
    check(eventsAfterStart.length, 0, "start_outcome_writes_no_event");
    const [{ count: assignmentsAfterStart }] = await tx.execute(sql`
      select count(*)::int as count from public.code_vault_assignments where institution_id = ${institutionId}
    `);
    check(assignmentsAfterStart, 0, "this_journey_never_creates_an_assignment");

    // -----------------------------------------------------------------
    // Scénario 3 : `outcome: "succeeded"` confirme l'activation et
    // journalise `activation_confirmed` — premier appelant réel de ce type
    // d'événement (les quatre autres parcours ne journalisent que `consult`
    // ou `access_denied`).
    // -----------------------------------------------------------------
    const succeeded = await handleEntActifVaultRequest(tx, {
      actor: selfActor,
      target: selfTarget,
      outcome: "succeeded",
    });
    check(succeeded, { outcome: "confirmed" }, "succeeded_outcome_confirms");
    const eventsAfterSucceeded = await accessEventsFor(tx, institutionId);
    check(eventsAfterSucceeded.length, 1, "succeeded_outcome_writes_exactly_one_event");
    check(
      eventsAfterSucceeded[0],
      {
        assignment_id: null,
        actor_person_ref: selfPersonRef,
        actor_profile: "eleve",
        event_type: "activation_confirmed",
        refusal_reason: null,
      },
      "activation_confirmed_event_shape"
    );

    // -----------------------------------------------------------------
    // Scénario 4 : `outcome: "failed"` ouvre un vrai ticket vers le
    // référent numérique, avec le `reasonCode` du contrat pur préservé,
    // sans jamais journaliser dans `code_vault_access_events` (l'escalade
    // vit dans `support_requests`/`support_events`, comme le LOT 4).
    // -----------------------------------------------------------------
    const failedPersonRef = "eleve-lot1-echec";
    const failedActor = { profile: "eleve", personRef: failedPersonRef, institutionId };
    const failedTarget = {
      service: "ent",
      institutionId,
      subjectKind: "self",
      subjectPersonRef: failedPersonRef,
      subjectClassRef: null,
    };
    const failedEscalation = await handleEntActifVaultRequest(tx, {
      actor: failedActor,
      target: failedTarget,
      outcome: "failed",
    });
    check(failedEscalation.outcome, "escalated", "failed_outcome_opens_a_real_ticket");
    const publicCodePattern = /^BC-\d{4}-\d{6}$/;
    check(publicCodePattern.test(failedEscalation.publicCode), true, "escalation_ticket_has_a_real_public_code");

    const ticketsAfterFailed = await supportRequestsFor(tx, institutionId);
    check(ticketsAfterFailed.length, 1, "exactly_one_support_ticket_created_for_failed_outcome");
    check(ticketsAfterFailed[0].assigned_team, "referent_numerique", "ent_reset_failed_routes_to_referent_numerique");
    check(ticketsAfterFailed[0].category, "autre", "escalation_ticket_uses_the_autre_category");
    check(ticketsAfterFailed[0].subcategory, "ent_reset_failed", "escalation_ticket_keeps_the_reason_code");
    check(
      ticketsAfterFailed[0].subject_context.journeyType,
      "ent_actif",
      "escalation_ticket_context_carries_the_journey_type"
    );
    check(
      JSON.stringify(ticketsAfterFailed[0]).includes(failedPersonRef),
      true,
      "escalation_ticket_context_carries_the_real_person_ref"
    );
    const eventsAfterFailedEscalation = await accessEventsFor(tx, institutionId);
    check(
      eventsAfterFailedEscalation.length,
      1,
      "escalation_does_not_write_to_code_vault_access_events"
    );
    const supportEventsAfterFailed = await supportEventsFor(tx, institutionId);
    check(supportEventsAfterFailed.length, 1, "escalation_writes_exactly_one_support_event");
    check(supportEventsAfterFailed[0].event_type, "request.created", "escalation_event_type");

    // -----------------------------------------------------------------
    // Scénario 5 (idempotence) : rejouer le même `outcome: "failed"` pour
    // la même personne ne crée jamais un second ticket.
    // -----------------------------------------------------------------
    const retryEscalation = await handleEntActifVaultRequest(tx, {
      actor: failedActor,
      target: failedTarget,
      outcome: "failed",
    });
    check(retryEscalation, failedEscalation, "retrying_the_same_escalation_returns_the_same_ticket");
    const ticketsAfterRetry = await supportRequestsFor(tx, institutionId);
    check(ticketsAfterRetry.length, 1, "retry_does_not_create_a_second_ticket");

    // -----------------------------------------------------------------
    // Scénario 6 : `outcome: "coordinate_incorrect"` ouvre un ticket
    // distinct (motif différent), l'agent n'a jamais modifié la coordonnée
    // lui-même — seule l'escalade existe.
    // -----------------------------------------------------------------
    const incorrectPersonRef = "eleve-lot1-coordonnee-incorrecte";
    const incorrectEscalation = await handleEntActifVaultRequest(tx, {
      actor: { profile: "eleve", personRef: incorrectPersonRef, institutionId },
      target: {
        service: "ent",
        institutionId,
        subjectKind: "self",
        subjectPersonRef: incorrectPersonRef,
        subjectClassRef: null,
      },
      outcome: "coordinate_incorrect",
    });
    check(incorrectEscalation.outcome, "escalated", "coordinate_incorrect_outcome_opens_a_real_ticket");
    const incorrectTickets = (await supportRequestsFor(tx, institutionId)).filter(
      (row) => row.subcategory === "ent_coordinate_incorrect"
    );
    check(incorrectTickets.length, 1, "coordinate_incorrect_creates_exactly_one_distinct_ticket");
    check(
      incorrectTickets[0].assigned_team,
      "referent_numerique",
      "coordinate_incorrect_also_routes_to_referent_numerique"
    );
    check(
      incorrectEscalation.publicCode !== failedEscalation.publicCode,
      true,
      "coordinate_incorrect_ticket_is_distinct_from_the_failed_ticket"
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
