// Hard-coded disposable loopback target; never inherits DATABASE_URL or loads .env.
// Recette du LOT 4 (docs/operations/PLAN_BRANCHEMENT_COFFRE_2026-09-06.md) sur
// PostgreSQL réel jetable. Personnes et établissement entièrement fictifs.
// Jamais `--linked`, jamais `db push`, jamais d'URL distante.
//
// Appelle directement `handleServiceDeliveryVaultRequest` (la même fonction
// que les routes `api/vault/cantine.ts` et `api/vault/koxo.ts`) et
// `handleMessagerieAcademiqueVaultRequest` (`api/vault/messagerie-academique.ts`),
// jamais une réimplémentation de leurs règles. Preuve que l'assemblage tient
// contre une vraie base : décision d'autorisation, attribution, remise,
// journal d'accès (mêmes garanties que le LOT 3), et — nouveau dans ce lot —
// qu'un `lookup_failed` ouvre un vrai ticket dans `support_requests`, jamais
// une décision qui reste sans suite.
//
// Étendu par le LOT 3 du plan de lecture
// (`docs/operations/PLAN_LECTURE_COFFRE_2026-09-06.md`) : mêmes preuves que
// `test-local-code-vault-ent-inactif-route.mjs` pour les parcours cantine et
// koxo — round-trip réel de `resolveVaultCodeReveal` (drapeau fermé par
// défaut, ouvert seulement dans l'`env` de l'appel, jamais persisté) et
// chemin de refus « autre établissement » sans aucun déchiffrement atteint.
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import { handleServiceDeliveryVaultRequest } from "../api/_shared/code-vault-service-delivery-route.ts";
import { handleMessagerieAcademiqueVaultRequest } from "../api/_shared/code-vault-messagerie-academique-route.ts";
import { CURRENT_VAULT_ASSIGNMENT_VERSION } from "../api/_shared/code-vault-ent-inactif-route.ts";
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
    values (${institutionId}, ${`coffre-lot4-branche-${institutionId}`}, 'Lycée fictif — LOT 4 branchement', 'draft')
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
    select public_code, requester_type, requester_first_name, requester_last_name,
           beneficiary_type, category, subcategory, status, priority, assigned_team,
           subject_context
    from public.support_requests
    where institution_id = ${institutionId}
    order by created_at asc
  `);
  return Array.from(rows);
}

async function supportEventsFor(tx, institutionId) {
  const rows = await tx.execute(sql`
    select se.event_type, se.actor_type, se.actor_id
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
    // Scénario 1 (cantine) : refus d'autorisation, journal motivé, aucune
    // attribution ni ticket créés — même garantie que le LOT 3.
    // -----------------------------------------------------------------
    const refusedActor = { profile: "eleve", personRef: "eleve-lot4-refuse", institutionId };
    const refusedTarget = {
      service: "cantine",
      institutionId,
      subjectKind: "self",
      subjectPersonRef: "une-autre-personne",
      subjectClassRef: null,
    };
    const refused = await handleServiceDeliveryVaultRequest(tx, {
      journeyType: "cantine",
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
    check(eventsAfterRefusal[0].event_type, "access_denied", "refusal_event_type");
    const [{ count: requestsAfterRefusal }] = await tx.execute(sql`
      select count(*)::int as count from public.support_requests where institution_id = ${institutionId}
    `);
    check(requestsAfterRefusal, 0, "refusal_creates_no_support_ticket");

    // -----------------------------------------------------------------
    // Scénario 2 (cantine) : la remise complète — attribution, consult,
    // aucune valeur renvoyée. Reprend les mêmes assertions que le LOT 3.
    // -----------------------------------------------------------------
    const cantinePersonRef = "eleve-lot4-cantine";
    const cantineActor = { profile: "eleve", personRef: cantinePersonRef, institutionId };
    const cantineTarget = {
      service: "cantine",
      institutionId,
      subjectKind: "self",
      subjectPersonRef: cantinePersonRef,
      subjectClassRef: null,
    };
    const cantineReveal = await handleServiceDeliveryVaultRequest(tx, {
      journeyType: "cantine",
      actor: cantineActor,
      target: cantineTarget,
      phase: "verified",
      proofChannel: "email",
      schoolYear: "2026-2027",
      now: new Date("2026-09-06T08:00:00.000Z"),
    });
    check(
      cantineReveal,
      {
        outcome: "displayed",
        remainingDisplaysToday: 2,
        revealedAt: "2026-09-06T08:00:00.000Z",
        value: null,
        reason: "reveal_disabled",
      },
      "cantine_first_reveal_succeeds_without_leaking_a_value_flag_closed_by_default"
    );

    // -----------------------------------------------------------------
    // Scénario 3 (cantine, défaut n°1 réutilisé) : une remise déjà expirée
    // n'est jamais re-remise sur la seule foi d'une phase `verified`.
    // -----------------------------------------------------------------
    const staleAttempt = await handleServiceDeliveryVaultRequest(tx, {
      journeyType: "cantine",
      actor: cantineActor,
      target: cantineTarget,
      phase: "verified",
      proofChannel: "email",
      schoolYear: "2026-2027",
      now: new Date("2026-09-06T09:00:00.000Z"),
    });
    check(
      staleAttempt,
      { outcome: "step", action: { kind: "send_proof", channel: "email" } },
      "cantine_expired_reveal_forces_back_to_before_proof"
    );

    // -----------------------------------------------------------------
    // Scénario 4 (koxo) : quatrième affichage du jour bascule sur le
    // formulaire enrichi, motif propre au parcours koxo.
    // -----------------------------------------------------------------
    const koxoPersonRef = "eleve-lot4-koxo-quota";
    const koxoActor = { profile: "eleve", personRef: koxoPersonRef, institutionId };
    const koxoTarget = {
      service: "koxo",
      institutionId,
      subjectKind: "self",
      subjectPersonRef: koxoPersonRef,
      subjectClassRef: null,
    };
    const koxoDay = new Date("2026-09-06T08:00:00.000Z");
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const reveal = await handleServiceDeliveryVaultRequest(tx, {
        journeyType: "koxo",
        actor: koxoActor,
        target: koxoTarget,
        phase: "verified",
        proofChannel: "email",
        schoolYear: "2026-2027",
        now: new Date(koxoDay.getTime() + attempt * 60_000),
      });
      check(reveal.outcome, "displayed", `koxo_quota_attempt_${attempt}_succeeds`);
    }
    const koxoFourthAttempt = await handleServiceDeliveryVaultRequest(tx, {
      journeyType: "koxo",
      actor: koxoActor,
      target: koxoTarget,
      phase: "verified",
      proofChannel: "email",
      schoolYear: "2026-2027",
      now: new Date(koxoDay.getTime() + 4 * 60_000),
    });
    check(
      koxoFourthAttempt,
      { outcome: "step", action: { kind: "form_fallback", reasonCode: "koxo_daily_quota_exceeded" } },
      "koxo_fourth_same_day_display_falls_back_to_the_enriched_form"
    );

    // -----------------------------------------------------------------
    // Scénario 5 (cantine, nouveau dans ce lot) : un badge introuvable
    // ouvre un vrai ticket support, assigné à l'intendance, sans valeur de
    // code, et journalise l'événement `request.created`.
    // -----------------------------------------------------------------
    const lookupFailedPersonRef = "eleve-lot4-badge-introuvable";
    const lookupFailedActor = { profile: "eleve", personRef: lookupFailedPersonRef, institutionId };
    const lookupFailedTarget = {
      service: "cantine",
      institutionId,
      subjectKind: "self",
      subjectPersonRef: lookupFailedPersonRef,
      subjectClassRef: null,
    };
    const escalation = await handleServiceDeliveryVaultRequest(tx, {
      journeyType: "cantine",
      actor: lookupFailedActor,
      target: lookupFailedTarget,
      phase: "lookup_failed",
      proofChannel: "email",
      schoolYear: "2026-2027",
      now: new Date("2026-09-06T08:00:00.000Z"),
    });
    check(escalation.outcome, "escalated", "lookup_failed_opens_a_real_ticket");
    const publicCodePattern = /^BC-\d{4}-\d{6}$/;
    check(publicCodePattern.test(escalation.publicCode), true, "escalation_ticket_has_a_real_public_code");

    const ticketsAfterEscalation = await supportRequestsFor(tx, institutionId);
    check(ticketsAfterEscalation.length, 1, "exactly_one_support_ticket_created");
    check(ticketsAfterEscalation[0].assigned_team, "intendance", "cantine_lookup_failed_routes_to_intendance");
    check(ticketsAfterEscalation[0].category, "autre", "escalation_ticket_uses_the_autre_category");
    check(ticketsAfterEscalation[0].subcategory, "cantine_badge_not_found", "escalation_ticket_keeps_the_reason_code");
    check(
      ticketsAfterEscalation[0].subject_context.journeyType,
      "cantine",
      "escalation_ticket_context_carries_the_journey_type"
    );
    check(
      JSON.stringify(ticketsAfterEscalation[0]).includes(lookupFailedPersonRef),
      true,
      "escalation_ticket_context_carries_the_real_person_ref"
    );
    const eventsAfterEscalation = await supportEventsFor(tx, institutionId);
    check(eventsAfterEscalation.length, 1, "escalation_writes_exactly_one_support_event");
    check(eventsAfterEscalation[0].event_type, "request.created", "escalation_event_type");

    // -----------------------------------------------------------------
    // Scénario 6 (cantine, idempotence) : un second `lookup_failed` pour
    // la même personne et le même motif ne crée jamais un second ticket.
    // -----------------------------------------------------------------
    const secondEscalation = await handleServiceDeliveryVaultRequest(tx, {
      journeyType: "cantine",
      actor: lookupFailedActor,
      target: lookupFailedTarget,
      phase: "lookup_failed",
      proofChannel: "email",
      schoolYear: "2026-2027",
      now: new Date("2026-09-06T08:05:00.000Z"),
    });
    check(secondEscalation, escalation, "retrying_the_same_escalation_returns_the_same_ticket");
    const ticketsAfterRetry = await supportRequestsFor(tx, institutionId);
    check(ticketsAfterRetry.length, 1, "retry_does_not_create_a_second_ticket");

    // -----------------------------------------------------------------
    // Scénario 7 (koxo, nouveau dans ce lot) : un code introuvable ouvre
    // un ticket assigné au référent numérique, pas à l'intendance.
    // -----------------------------------------------------------------
    const koxoLookupFailedPersonRef = "eleve-lot4-koxo-introuvable";
    const koxoEscalation = await handleServiceDeliveryVaultRequest(tx, {
      journeyType: "koxo",
      actor: { profile: "eleve", personRef: koxoLookupFailedPersonRef, institutionId },
      target: {
        service: "koxo",
        institutionId,
        subjectKind: "self",
        subjectPersonRef: koxoLookupFailedPersonRef,
        subjectClassRef: null,
      },
      phase: "lookup_failed",
      proofChannel: "email",
      schoolYear: "2026-2027",
      now: new Date("2026-09-06T08:00:00.000Z"),
    });
    check(koxoEscalation.outcome, "escalated", "koxo_lookup_failed_opens_a_real_ticket");
    const koxoTickets = (await supportRequestsFor(tx, institutionId)).filter(
      (row) => row.subcategory === "koxo_code_not_found"
    );
    check(koxoTickets.length, 1, "koxo_escalation_creates_exactly_one_ticket");
    check(koxoTickets[0].assigned_team, "referent_numerique", "koxo_lookup_failed_routes_to_referent_numerique");

    // -----------------------------------------------------------------
    // Scénario 8 (messagerie académique) : ne remet jamais de code, ne crée
    // ni attribution ni ticket, confirme et journalise un `consult`.
    // -----------------------------------------------------------------
    const messagerieActor = { profile: "professeur", personRef: "prof-lot4-messagerie", institutionId };
    const notVerifiable = await handleMessagerieAcademiqueVaultRequest(tx, {
      institutionId,
      actor: messagerieActor,
      phase: "before_proof",
      emailVerifiable: false,
    });
    check(
      notVerifiable,
      { outcome: "step", action: { kind: "form_fallback", reasonCode: "messagerie_academique_email_not_verifiable" } },
      "messagerie_academique_non_verifiable_falls_back_to_the_form"
    );
    const confirmed = await handleMessagerieAcademiqueVaultRequest(tx, {
      institutionId,
      actor: messagerieActor,
      phase: "verified",
      emailVerifiable: true,
    });
    check(confirmed, { outcome: "confirmed" }, "messagerie_academique_confirms_without_revealing_a_code");
    const [{ count: assignmentsAfterMessagerie }] = await tx.execute(sql`
      select count(*)::int as count from public.code_vault_assignments
      where institution_id = ${institutionId} and person_ref = 'prof-lot4-messagerie'
    `);
    check(assignmentsAfterMessagerie, 0, "messagerie_academique_never_creates_an_assignment");
    const messagerieEvents = await accessEventsFor(tx, institutionId);
    const consultForMessagerie = messagerieEvents.filter(
      (row) => row.actor_person_ref === "prof-lot4-messagerie"
    );
    check(consultForMessagerie.length, 1, "messagerie_academique_logs_exactly_one_consult_event");
    check(consultForMessagerie[0].event_type, "consult", "messagerie_academique_event_type");

    // -----------------------------------------------------------------
    // Scénario 9 (LOT 3 du plan de lecture, cantine) : chemin de refus
    // « autre établissement » — aucune attribution, aucun événement
    // `consult`, donc `resolveVaultCodeReveal` n'est jamais atteint.
    // -----------------------------------------------------------------
    // L'événement de refus est journalisé sous l'institution de la *cible*
    // (contrainte de clé étrangère réelle sur `code_vault_access_events`) :
    // elle doit donc exister, même pour prouver un refus.
    const otherInstitutionId = randomUUID();
    await insertFictitiousInstitution(tx, otherInstitutionId);
    const otherInstitutionActor = { profile: "eleve", personRef: "eleve-lot3-lecture-cantine-autre-etab", institutionId };
    const otherInstitutionTarget = {
      service: "cantine",
      institutionId: otherInstitutionId,
      subjectKind: "self",
      subjectPersonRef: "eleve-lot3-lecture-cantine-autre-etab",
      subjectClassRef: null,
    };
    const cantineInstitutionMismatch = await handleServiceDeliveryVaultRequest(tx, {
      journeyType: "cantine",
      actor: otherInstitutionActor,
      target: otherInstitutionTarget,
      phase: "verified",
      proofChannel: "email",
      schoolYear: "2026-2027",
      now: new Date("2026-09-06T08:00:00.000Z"),
    });
    check(
      cantineInstitutionMismatch,
      { outcome: "denied", reason: "institution_mismatch" },
      "cantine_other_institution_actor_is_denied_before_any_reveal_attempt"
    );

    // -----------------------------------------------------------------
    // Scénario 10 (LOT 3 du plan de lecture) : round-trip réel de
    // `resolveVaultCodeReveal` pour cantine et koxo — même preuve que le
    // LOT 3 côté ENT inactif (`test-local-code-vault-ent-inactif-route.mjs`) :
    // drapeau fermé par défaut, ouvert seulement dans l'`env` de l'appel.
    // -----------------------------------------------------------------
    async function revealRoundTrip(journeyType, service) {
      const personRef = `eleve-lot3-lecture-${journeyType}-reveal`;
      const actor = { profile: "eleve", personRef, institutionId };
      const target = { service, institutionId, subjectKind: "self", subjectPersonRef: personRef, subjectClassRef: null };
      const cryptoEnv = {
        CODE_VAULT_ENCRYPTION_KEY_VERSION: "v1",
        CODE_VAULT_ENCRYPTION_KEY_V1: randomBytes(32).toString("base64"),
      };
      const assignment = await getOrCreateVaultAssignment(tx, {
        institutionId,
        personRef,
        service,
        schoolYear: "2026-2027",
        version: CURRENT_VAULT_ASSIGNMENT_VERSION,
      });
      const fixtureValue = `${journeyType}2026EleveLot3Lecture`;
      await writeVaultCodeValue(tx, { assignmentId: assignment.id, institutionId, value: fixtureValue, env: cryptoEnv });

      const closedFlagReveal = await handleServiceDeliveryVaultRequest(tx, {
        journeyType,
        actor,
        target,
        phase: "verified",
        proofChannel: "email",
        schoolYear: "2026-2027",
        now: new Date("2026-09-06T08:00:00.000Z"),
        env: cryptoEnv,
      });
      check(closedFlagReveal.outcome, "displayed", `${journeyType}_reveal_scenario_first_display_succeeds`);
      check(closedFlagReveal.value, null, `${journeyType}_reveal_flag_closed_by_default_keeps_value_null`);
      check(closedFlagReveal.reason, "reveal_disabled", `${journeyType}_reveal_flag_closed_reason_is_explicit`);

      const openFlagReveal = await handleServiceDeliveryVaultRequest(tx, {
        journeyType,
        actor,
        target,
        phase: "verified",
        proofChannel: "email",
        schoolYear: "2026-2027",
        now: new Date("2026-09-06T08:05:00.000Z"),
        env: { ...cryptoEnv, CODE_VAULT_REVEAL_ENABLED: "true" },
      });
      check(openFlagReveal.outcome, "displayed", `${journeyType}_reveal_scenario_second_display_succeeds`);
      check(
        openFlagReveal.value,
        fixtureValue,
        `${journeyType}_reveal_flag_open_returns_the_real_decrypted_value_round_tripped_through_postgresql`
      );
      check(openFlagReveal.reason, null, `${journeyType}_reveal_flag_open_reason_is_null_when_a_value_is_returned`);
    }
    await revealRoundTrip("cantine", "cantine");
    await revealRoundTrip("koxo", "koxo");

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
