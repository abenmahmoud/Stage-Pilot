// Test sans base du LOT 4 (`docs/operations/PLAN_BRANCHEMENT_COFFRE_2026-09-06.md`) :
// vérifie le contrôle de flux de `createVaultEscalationTicket` avec un `tx`
// fabriqué (même méthode que `test-code-vault-pg-error.mjs`, LOT 2) — la
// forme réelle des requêtes SQL insérées (jsonb, idempotence en base) reste
// prouvée par la recette PostgreSQL locale
// (`scripts/test-local-code-vault-service-delivery-route.mjs`), pas ici.
import assert from "node:assert/strict";
import test from "node:test";

import { createVaultEscalationTicket } from "../api/_shared/code-vault-support-escalation.ts";

function fakeTx(responses) {
  const calls = [];
  return {
    calls,
    execute: async () => {
      const response = responses[calls.length] ?? [];
      calls.push(response);
      return response;
    },
  };
}

const BASE_INPUT = {
  institutionId: "institution-lot4",
  actor: { profile: "eleve", personRef: "eleve-lot4-01", institutionId: "institution-lot4" },
  service: "intendance",
  journeyType: "cantine",
  reasonCode: "cantine_badge_not_found",
  subjectPersonRef: "eleve-lot4-01",
};

test("crée un ticket et journalise un événement quand l'insertion réussit", async () => {
  const tx = fakeTx([[{ id: "req-1", public_code: "BC-2026-000001" }], []]);
  const result = await createVaultEscalationTicket(tx, BASE_INPUT);
  assert.deepEqual(result, { publicCode: "BC-2026-000001", created: true });
  assert.equal(tx.calls.length, 2, "insertion du ticket, puis insertion de l'événement");
});

test("retrouve le ticket déjà ouvert quand l'insertion entre en conflit d'idempotence", async () => {
  const tx = fakeTx([[], [{ public_code: "BC-2026-000002" }]]);
  const result = await createVaultEscalationTicket(tx, BASE_INPUT);
  assert.deepEqual(result, { publicCode: "BC-2026-000002", created: false });
  assert.equal(tx.calls.length, 2, "insertion (sans effet) puis relecture par la clé d'idempotence");
});

test("échoue explicitement si le conflit d'idempotence ne retrouve aucune ligne", async () => {
  const tx = fakeTx([[], []]);
  await assert.rejects(
    createVaultEscalationTicket(tx, BASE_INPUT),
    /code_vault_escalation_ticket_upsert_returned_no_row/
  );
});

test("le bénéficiaire diffère de l'acteur : beneficiary_type devient 'eleve', jamais 'self'", async () => {
  const tx = fakeTx([[{ id: "req-3", public_code: "BC-2026-000003" }], []]);
  const result = await createVaultEscalationTicket(tx, {
    ...BASE_INPUT,
    actor: {
      profile: "professeur_principal",
      personRef: "pp-lot4-01",
      institutionId: "institution-lot4",
      validatedClassRefs: ["classe-1"],
    },
    subjectPersonRef: "eleve-lot4-beneficiaire",
  });
  assert.deepEqual(result, { publicCode: "BC-2026-000003", created: true });
});
