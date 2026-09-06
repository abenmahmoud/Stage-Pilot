// Ticket support réel pour l'escalade des parcours du coffre — LOT 4 du plan
// du 6 septembre 2026 (`docs/operations/PLAN_BRANCHEMENT_COFFRE_2026-09-06.md`).
// `open_referral` (`shared/code-vault-journeys.ts`) est une décision pure ;
// ce module la transforme en une vraie ligne dans `support_requests`, la
// même table et la même file que `api/support/requests/index.ts`, jamais une
// réimplémentation de la politique de routage support.
//
// Différence assumée avec la route publique : l'escalade du coffre vient
// d'un acteur déjà authentifié (élève, professeur, professeur principal ou
// service), pas d'un visiteur anonyme qui décrit sa propre demande. Elle ne
// crée donc ni session d'appareil, ni contact, ni jeton magique — ces trois
// mécanismes ne servent qu'à un requérant anonyme à retrouver sa demande plus
// tard, ce qui n'a pas de sens pour un ticket ouvert par le système.
//
// Aucune table du dépôt ne relie aujourd'hui un compte connecté à un nom
// réel (même limite déjà posée par `api/_shared/code-vault-ent-inactif-route.ts`,
// LOT 3, §« décisions de conception assumées »). Ce module ne l'invente pas :
// `requester_first_name`/`requester_last_name` portent un libellé explicite
// d'escalade automatique, jamais un nom fabriqué. L'identité réelle
// (référence de personne, profil, motif) va dans `subject_context`, en clair
// pour l'agent qui traite le ticket, jamais une valeur de code.

import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import type { SupportService } from "../../shared/support-agent-access.js";
import type { VaultActor } from "../../shared/code-vault-policy.js";
import type { CodeVaultJourneyType } from "../../shared/code-vault-journeys.js";
import type { VaultTx } from "./code-vault-assignment.js";

function rowsOf<T>(result: unknown): T[] {
  return Array.from(result as unknown as T[]);
}

/**
 * Hachage local plutôt qu'un import de `api/_shared/support.ts` : ce module
 * ne porte aucune donnée personnelle à protéger par un secret (seulement des
 * références déjà internes — établissement, parcours, motif), et
 * `support.ts` entraîne `db/index.ts` et `api/_shared/auth.ts` dans son
 * graphe d'import, ce qui casserait la testabilité sans base de ce module
 * (même esprit que `shared/code-vault-pg-error.ts`, LOT 2, qui reste lui
 * aussi sans dépendance lourde).
 */
function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function actorPersonRefOf(actor: VaultActor): string | null {
  return "personRef" in actor ? actor.personRef : null;
}

type SupportRequesterType = "eleve" | "parent" | "professeur" | "personnel";

function requesterTypeOf(actor: VaultActor): SupportRequesterType {
  switch (actor.profile) {
    case "eleve":
      return "eleve";
    case "parent":
      return "parent";
    case "professeur":
    case "professeur_principal":
      return "professeur";
    case "service":
    case "superadmin":
      return "personnel";
  }
}

export type VaultEscalationInput = {
  institutionId: string;
  actor: VaultActor;
  /** Service support qui doit traiter le ticket (`referent_numerique`, `intendance`, ...). */
  service: SupportService;
  journeyType: CodeVaultJourneyType;
  reasonCode: string;
  /** Personne concernée par la remise, si différente de l'acteur (ex. professeur principal → élève). */
  subjectPersonRef: string | null;
};

export type VaultEscalationTicket = { publicCode: string; created: boolean };

/**
 * Ouvre (ou retrouve, si déjà ouvert pour le même motif) un ticket support
 * réel. La clé d'idempotence est déterministe — établissement, parcours,
 * motif, acteur, bénéficiaire — pour qu'un rejeu de la même décision
 * `open_referral` (ex. double clic, nouvelle tentative après un rafraîchissement)
 * ne crée jamais un second ticket : `on conflict ... do nothing`, comme la
 * route publique (`api/support/requests/index.ts`).
 */
export async function createVaultEscalationTicket(
  tx: VaultTx,
  input: VaultEscalationInput
): Promise<VaultEscalationTicket> {
  const actorPersonRef = actorPersonRefOf(input.actor);
  const subjectPersonRef = input.subjectPersonRef;
  const beneficiaryIsSubject = subjectPersonRef !== null && subjectPersonRef !== actorPersonRef;
  const idempotencyKeyHash = sha256(
    [
      "code-vault-escalation-v1",
      input.institutionId,
      input.journeyType,
      input.reasonCode,
      actorPersonRef ?? "no-actor-person-ref",
      subjectPersonRef ?? "no-subject-person-ref",
    ].join(":")
  );
  const subject = `Coffre de codes — ${input.journeyType} — ${input.reasonCode}`;
  const description = [
    "Escalade automatique ouverte par un parcours du coffre de codes, sans intervention humaine à la saisie.",
    `Parcours concerné : ${input.journeyType}.`,
    `Motif renvoyé par le parcours : ${input.reasonCode}.`,
    "Aucune valeur de code n'est portée par ce ticket : voir `subject_context` pour les références techniques.",
  ].join(" ");

  const inserted = await tx.execute(sql`
    insert into public.support_requests (
      institution_id, idempotency_key_hash, requester_type,
      requester_first_name, requester_last_name,
      beneficiary_type, subject_context, category, subcategory,
      subject, description, status, priority, assigned_team, preferred_channel, fallback_allowed
    ) values (
      ${input.institutionId}, ${idempotencyKeyHash}, ${requesterTypeOf(input.actor)},
      'Escalade automatique', 'Coffre de codes',
      ${beneficiaryIsSubject ? "eleve" : "self"},
      jsonb_build_object(
        'source', 'code_vault_escalation',
        'journeyType', ${input.journeyType}::text,
        'reasonCode', ${input.reasonCode}::text,
        'actorProfile', ${input.actor.profile}::text,
        'actorPersonRef', ${actorPersonRef}::text,
        'subjectPersonRef', ${subjectPersonRef}::text
      ),
      'autre', ${input.reasonCode}::text,
      ${subject}::text, ${description}::text,
      'nouveau', 'p3', ${input.service}::text, 'web', false
    )
    on conflict (institution_id, idempotency_key_hash) do nothing
    returning id, public_code
  `);
  const [created] = rowsOf<{ id: string; public_code: string }>(inserted);
  if (created) {
    await tx.execute(sql`
      insert into public.support_events (
        request_id, event_type, actor_type, actor_id, to_value, correlation_id
      ) values (
        ${created.id}::uuid, 'request.created', 'system', ${actorPersonRef}::text,
        jsonb_build_object('source', 'code_vault_escalation', 'journeyType', ${input.journeyType}::text),
        gen_random_uuid()
      )
    `);
    return { publicCode: created.public_code, created: true };
  }

  const [existing] = rowsOf<{ public_code: string }>(
    await tx.execute(sql`
      select public_code from public.support_requests
      where institution_id = ${input.institutionId} and idempotency_key_hash = ${idempotencyKeyHash}
      limit 1
    `)
  );
  if (!existing) throw new Error("code_vault_escalation_ticket_upsert_returned_no_row");
  return { publicCode: existing.public_code, created: false };
}
