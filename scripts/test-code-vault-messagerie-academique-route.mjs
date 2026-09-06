// Test sans base du LOT 4 (`docs/operations/PLAN_BRANCHEMENT_COFFRE_2026-09-06.md`) :
// `parseMessagerieAcademiqueRequestInput` et `handleMessagerieAcademiqueVaultRequest`
// avec un `tx` fabriqué (même méthode que `test-code-vault-pg-error.mjs`,
// LOT 2) pour prouver que la confirmation ne remet jamais de code et
// journalise exactement un événement `consult`.
import assert from "node:assert/strict";
import test from "node:test";

import {
  handleMessagerieAcademiqueVaultRequest,
  parseMessagerieAcademiqueRequestInput,
} from "../api/_shared/code-vault-messagerie-academique-route.ts";

test("accepte une entrée valide et ne renvoie que les deux champs attendus", () => {
  const parsed = parseMessagerieAcademiqueRequestInput({ phase: "verified", emailVerifiable: true });
  assert.deepEqual(parsed, { phase: "verified", emailVerifiable: true });
});

test("rejette une valeur qui n'est pas un objet simple", () => {
  for (const value of [null, undefined, "verified", 42, ["verified"]]) {
    assert.throws(
      () => parseMessagerieAcademiqueRequestInput(value),
      /messagerie_academique_input_invalid/
    );
  }
});

test("rejette un champ inconnu ou un champ manquant", () => {
  assert.throws(
    () =>
      parseMessagerieAcademiqueRequestInput({
        phase: "verified",
        emailVerifiable: true,
        extra: "non-attendu",
      }),
    /messagerie_academique_input_invalid/
  );
  assert.throws(
    () => parseMessagerieAcademiqueRequestInput({ phase: "verified" }),
    /messagerie_academique_input_invalid/
  );
});

test("rejette une phase hors du parcours messagerie académique", () => {
  assert.throws(
    () => parseMessagerieAcademiqueRequestInput({ phase: "revealed", emailVerifiable: true }),
    /messagerie_academique_phase_invalid/
  );
});

test("rejette emailVerifiable non booléen", () => {
  assert.throws(
    () => parseMessagerieAcademiqueRequestInput({ phase: "verified", emailVerifiable: "oui" }),
    /messagerie_academique_email_verifiable_invalid/
  );
});

function fakeTx() {
  const calls = [];
  return {
    calls,
    execute: async (query) => {
      calls.push(query);
      return [];
    },
  };
}

test("email non vérifiable bascule sur le formulaire enrichi, sans toucher le journal", async () => {
  const tx = fakeTx();
  const result = await handleMessagerieAcademiqueVaultRequest(tx, {
    institutionId: "institution-lot4",
    actor: { profile: "eleve", personRef: "eleve-lot4-msg", institutionId: "institution-lot4" },
    phase: "before_proof",
    emailVerifiable: false,
  });
  assert.deepEqual(result, {
    outcome: "step",
    action: { kind: "form_fallback", reasonCode: "messagerie_academique_email_not_verifiable" },
  });
  assert.equal(tx.calls.length, 0, "aucune écriture avant la confirmation");
});

test("email vérifié confirme l'identité et journalise exactement un événement consult", async () => {
  const tx = fakeTx();
  const result = await handleMessagerieAcademiqueVaultRequest(tx, {
    institutionId: "institution-lot4",
    actor: { profile: "eleve", personRef: "eleve-lot4-msg", institutionId: "institution-lot4" },
    phase: "verified",
    emailVerifiable: true,
  });
  assert.deepEqual(result, { outcome: "confirmed" });
  assert.equal(tx.calls.length, 1, "un seul événement journalisé");
});

test("les phases précédentes renvoient l'action pure sans toucher le journal", async () => {
  const tx = fakeTx();
  const result = await handleMessagerieAcademiqueVaultRequest(tx, {
    institutionId: "institution-lot4",
    actor: { profile: "professeur", personRef: "prof-lot4-msg", institutionId: "institution-lot4" },
    phase: "awaiting_verification",
    emailVerifiable: true,
  });
  assert.deepEqual(result, { outcome: "step", action: { kind: "await_verification" } });
  assert.equal(tx.calls.length, 0);
});
