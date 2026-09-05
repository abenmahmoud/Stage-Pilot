import assert from "node:assert/strict";
import test from "node:test";

import {
  VAULT_MAX_DAILY_DISPLAYS,
  VAULT_DISPLAY_VISIBILITY_SECONDS,
  decideVaultDisplayQuota,
  isVaultDisplayStillVisible,
  canAutoReplaceDefectiveVaultCode,
} from "../shared/code-vault-policy.ts";

test("trois affichages maximum par jour, le quatrième bascule vers le formulaire", () => {
  assert.equal(VAULT_MAX_DAILY_DISPLAYS, 3);

  assert.deepEqual(decideVaultDisplayQuota({ displayCountToday: 0 }), {
    allowed: true,
    remainingDisplaysToday: 2,
  });
  assert.deepEqual(decideVaultDisplayQuota({ displayCountToday: 2 }), {
    allowed: true,
    remainingDisplaysToday: 0,
  });
  assert.deepEqual(decideVaultDisplayQuota({ displayCountToday: 3 }), {
    allowed: false,
    reason: "daily_display_quota_exceeded",
  });
  assert.deepEqual(decideVaultDisplayQuota({ displayCountToday: 4 }), {
    allowed: false,
    reason: "daily_display_quota_exceeded",
  });
});

test("le code reste visible 30 minutes après la remise, puis devient invalide", () => {
  assert.equal(VAULT_DISPLAY_VISIBILITY_SECONDS, 30 * 60);

  const revealedAt = new Date("2026-09-05T10:00:00.000Z");

  assert.equal(isVaultDisplayStillVisible(revealedAt, new Date("2026-09-05T10:00:00.000Z")), true);
  assert.equal(isVaultDisplayStillVisible(revealedAt, new Date("2026-09-05T10:29:59.000Z")), true);
  assert.equal(isVaultDisplayStillVisible(revealedAt, new Date("2026-09-05T10:30:00.000Z")), false, "exactement 30 minutes : invalide");
  assert.equal(isVaultDisplayStillVisible(revealedAt, new Date("2026-09-05T11:00:00.000Z")), false);
});

test("aucune remise n'ayant encore eu lieu, le code n'est jamais visible", () => {
  assert.equal(isVaultDisplayStillVisible(null, new Date()), false);
});

test("une horloge en désaccord (revealedAt dans le futur) ne rend pas le code visible", () => {
  const now = new Date("2026-09-05T10:00:00.000Z");
  const revealedAt = new Date("2026-09-05T10:00:05.000Z");
  assert.equal(isVaultDisplayStillVisible(revealedAt, now), false);
});

test("un code défectueux n'a structurellement aucun chemin de remplacement automatique", () => {
  assert.equal(canAutoReplaceDefectiveVaultCode(), false);
});
