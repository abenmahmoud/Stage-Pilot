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

test("un affichage réussi convertit revealedAt en Date et transporte la valeur telle quelle (drapeau fermé)", () => {
  const state = decideEntInactifScreenState({
    outcome: "displayed",
    remainingDisplaysToday: 2,
    revealedAt: "2026-09-06T10:00:00.000Z",
    value: null,
    reason: "reveal_disabled",
  });
  assert.equal(state.kind, "revealed");
  assert.ok(state.revealedAt instanceof Date);
  assert.equal(state.revealedAt.toISOString(), "2026-09-06T10:00:00.000Z");
  assert.equal(state.remainingDisplaysToday, 2);
  assert.equal(state.value, null, "drapeau fermé : ce module ne fabrique jamais de valeur");
  assert.equal(state.reason, "reveal_disabled");
});

test("un affichage réussi avec remise trouvée transporte la valeur déchiffrée sans la recalculer", () => {
  const state = decideEntInactifScreenState({
    outcome: "displayed",
    remainingDisplaysToday: 1,
    revealedAt: "2026-09-06T10:00:00.000Z",
    value: "Cantine2026Eleve456",
    reason: null,
  });
  assert.equal(state.kind, "revealed");
  assert.equal(state.value, "Cantine2026Eleve456");
  assert.equal(state.reason, null);
});

test("un affichage réussi sans ligne chiffrée trouvée porte le motif not_displayed", () => {
  const state = decideEntInactifScreenState({
    outcome: "displayed",
    remainingDisplaysToday: 3,
    revealedAt: "2026-09-06T10:00:00.000Z",
    value: null,
    reason: "not_displayed",
  });
  assert.equal(state.value, null);
  assert.equal(state.reason, "not_displayed");
});

test("la phase redemandée après expiration d'un affichage est toujours before_proof, jamais verified", () => {
  assert.equal(ENT_INACTIF_PHASE_AFTER_DISPLAY_EXPIRY, "before_proof");
});
