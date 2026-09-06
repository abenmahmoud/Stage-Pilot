// Tests sans base du LOT 5 (`docs/operations/PLAN_BRANCHEMENT_COFFRE_2026-09-06.md`) :
// `decideEntInactifScreenState` (`shared/code-vault-ent-inactif-screen.ts`)
// contre les formes réelles renvoyées par `handleEntInactifVaultRequest`
// (`api/_shared/code-vault-ent-inactif-route.ts`, LOT 3), même méthode que
// `test-flash-validation-route.mjs`.
import assert from "node:assert/strict";
import test from "node:test";

import {
  decideEntInactifScreenState,
  ENT_INACTIF_PHASE_AFTER_DISPLAY_EXPIRY,
} from "../shared/code-vault-ent-inactif-screen.ts";

test("un refus renvoie l'état denied avec le motif exact", () => {
  const state = decideEntInactifScreenState({ outcome: "denied", reason: "self_only" });
  assert.deepEqual(state, { kind: "denied", reason: "self_only" });
});

test("une demande de preuve renvoie le canal exact reçu de la route", () => {
  const state = decideEntInactifScreenState({
    outcome: "step",
    action: { kind: "send_proof", channel: "phone" },
  });
  assert.deepEqual(state, { kind: "send_proof", channel: "phone" });
});

test("l'attente de vérification ne porte aucune donnée superflue", () => {
  const state = decideEntInactifScreenState({
    outcome: "step",
    action: { kind: "await_verification" },
  });
  assert.deepEqual(state, { kind: "awaiting_verification" });
});

test("le quatrième affichage refusé (quota) bascule sur le formulaire enrichi avec son motif", () => {
  const state = decideEntInactifScreenState({
    outcome: "step",
    action: { kind: "form_fallback", reasonCode: "ent_inactif_daily_quota_exceeded" },
  });
  assert.deepEqual(state, { kind: "form_fallback", reasonCode: "ent_inactif_daily_quota_exceeded" });
});

test("une remise déjà expirée renvoyée en form_fallback ne fabrique jamais un état revealed", () => {
  const state = decideEntInactifScreenState({
    outcome: "step",
    action: { kind: "form_fallback", reasonCode: "ent_inactif_code_defective" },
  });
  assert.equal(state.kind, "form_fallback");
});

test("l'invitation à réinitialiser le mot de passe est un état distinct", () => {
  const state = decideEntInactifScreenState({
    outcome: "step",
    action: { kind: "invite_password_reset" },
  });
  assert.deepEqual(state, { kind: "password_reset_invited" });
});

test("un affichage réussi convertit revealedAt en Date et ne porte jamais de valeur de code", () => {
  const state = decideEntInactifScreenState({
    outcome: "displayed",
    remainingDisplaysToday: 2,
    revealedAt: "2026-09-06T10:00:00.000Z",
  });
  assert.equal(state.kind, "revealed");
  assert.ok(state.revealedAt instanceof Date);
  assert.equal(state.revealedAt.toISOString(), "2026-09-06T10:00:00.000Z");
  assert.equal(state.remainingDisplaysToday, 2);
  assert.equal(
    state.value,
    null,
    "aucun point de lecture du coffre n'existe encore (LOT 3/4/5) : la valeur ne peut être que nulle"
  );
});

test("la phase redemandée après expiration d'un affichage est toujours before_proof, jamais verified", () => {
  assert.equal(ENT_INACTIF_PHASE_AFTER_DISPLAY_EXPIRY, "before_proof");
});
