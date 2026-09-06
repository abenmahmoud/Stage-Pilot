// Test pur du LOT 2 (`docs/operations/PLAN_LECTURE_COFFRE_2026-09-06.md`,
// section « LOT 2 — Le drapeau, fermé ») : aucune base, aucun réseau.
//
// Couvre les deux états du drapeau `CODE_VAULT_REVEAL_ENABLED` autour de
// `resolveVaultCodeReveal` (`api/_shared/code-vault-read.ts`) :
// 1. Drapeau fermé (absent, "false", ou toute valeur autre que "true") :
//    `value: null` avec un motif explicite, et `code_vault_private_rows`
//    n'est jamais interrogée — même si la remise a été accordée.
// 2. Drapeau ouvert ("true" exactement) : le comportement retombe sur
//    `readVaultCodeValue` (LOT 1), round-trip inclus.
import assert from "node:assert/strict";
import test from "node:test";
import { randomBytes } from "node:crypto";

import { resolveVaultCodeReveal } from "../api/_shared/code-vault-read.ts";
import { encryptVaultCodeValue } from "../shared/code-vault-crypto.ts";

const INSTITUTION_A = "institution-lecture-lot2-a";
const ASSIGNMENT_A = "assignment-lecture-lot2-a";
const CODE_VALUE = "Cantine2026Eleve789";

function testEnv(overrides = {}) {
  return {
    CODE_VAULT_ENCRYPTION_KEY_VERSION: "v1",
    CODE_VAULT_ENCRYPTION_KEY_V1: randomBytes(32).toString("base64"),
    ...overrides,
  };
}

function fakeTx(rows) {
  const calls = [];
  return {
    calls,
    execute: async (query) => {
      calls.push(query);
      return rows;
    },
  };
}

function displayedOutcome() {
  return { outcome: "displayed", revealedAt: new Date(), remainingDisplaysToday: 2 };
}

function encryptedRow(env) {
  const config = { version: "v1", key: Buffer.from(env.CODE_VAULT_ENCRYPTION_KEY_V1, "base64") };
  const envelope = encryptVaultCodeValue({
    value: CODE_VALUE,
    institutionId: INSTITUTION_A,
    assignmentId: ASSIGNMENT_A,
    config,
  });
  return {
    key_version: envelope.keyVersion,
    payload_schema: envelope.payloadSchema,
    iv: envelope.iv,
    auth_tag: envelope.authTag,
    ciphertext: envelope.ciphertext,
  };
}

test("drapeau absent : value null, motif reveal_disabled, table jamais interrogée", async () => {
  const env = testEnv();
  delete env.CODE_VAULT_REVEAL_ENABLED;
  const tx = fakeTx([encryptedRow(env)]);
  const result = await resolveVaultCodeReveal(tx, {
    assignmentId: ASSIGNMENT_A,
    institutionId: INSTITUTION_A,
    displayOutcome: displayedOutcome(),
    env,
  });
  assert.deepEqual(result, { value: null, reason: "reveal_disabled" });
  assert.equal(tx.calls.length, 0, "aucune interrogation de code_vault_private_rows attendue");
});

test("drapeau à \"false\" : même résultat que fermé", async () => {
  const env = testEnv({ CODE_VAULT_REVEAL_ENABLED: "false" });
  const tx = fakeTx([encryptedRow(env)]);
  const result = await resolveVaultCodeReveal(tx, {
    assignmentId: ASSIGNMENT_A,
    institutionId: INSTITUTION_A,
    displayOutcome: displayedOutcome(),
    env,
  });
  assert.deepEqual(result, { value: null, reason: "reveal_disabled" });
  assert.equal(tx.calls.length, 0);
});

test("valeur mal écrite (\"TRUE\", \"1\", espace) : ferme quand même, comparaison stricte", async () => {
  for (const badValue of ["TRUE", "1", " true", "true "]) {
    const env = testEnv({ CODE_VAULT_REVEAL_ENABLED: badValue });
    const tx = fakeTx([encryptedRow(env)]);
    const result = await resolveVaultCodeReveal(tx, {
      assignmentId: ASSIGNMENT_A,
      institutionId: INSTITUTION_A,
      displayOutcome: displayedOutcome(),
      env,
    });
    assert.deepEqual(result, { value: null, reason: "reveal_disabled" }, `valeur refusée attendue pour ${JSON.stringify(badValue)}`);
    assert.equal(tx.calls.length, 0);
  }
});

test("drapeau fermé même avec une remise refusée : reste reveal_disabled, pas not_displayed", async () => {
  const env = testEnv({ CODE_VAULT_REVEAL_ENABLED: "false" });
  const tx = fakeTx([]);
  const result = await resolveVaultCodeReveal(tx, {
    assignmentId: ASSIGNMENT_A,
    institutionId: INSTITUTION_A,
    displayOutcome: { outcome: "quota_exceeded" },
    env,
  });
  assert.deepEqual(result, { value: null, reason: "reveal_disabled" });
  assert.equal(tx.calls.length, 0);
});

test("drapeau ouvert (\"true\") et remise accordée : round-trip jusqu'à la valeur d'origine", async () => {
  const env = testEnv({ CODE_VAULT_REVEAL_ENABLED: "true" });
  const tx = fakeTx([encryptedRow(env)]);
  const result = await resolveVaultCodeReveal(tx, {
    assignmentId: ASSIGNMENT_A,
    institutionId: INSTITUTION_A,
    displayOutcome: displayedOutcome(),
    env,
  });
  assert.deepEqual(result, { value: CODE_VALUE, reason: null });
  assert.equal(tx.calls.length, 1);
});

test("drapeau ouvert mais remise refusée (quota) : value null, motif not_displayed, table jamais interrogée", async () => {
  const env = testEnv({ CODE_VAULT_REVEAL_ENABLED: "true" });
  const tx = fakeTx([]);
  const result = await resolveVaultCodeReveal(tx, {
    assignmentId: ASSIGNMENT_A,
    institutionId: INSTITUTION_A,
    displayOutcome: { outcome: "quota_exceeded" },
    env,
  });
  assert.deepEqual(result, { value: null, reason: "not_displayed" });
  assert.equal(tx.calls.length, 0);
});

test("drapeau ouvert et remise accordée mais aucune ligne trouvée : value null, motif not_displayed", async () => {
  const env = testEnv({ CODE_VAULT_REVEAL_ENABLED: "true" });
  const tx = fakeTx([]);
  const result = await resolveVaultCodeReveal(tx, {
    assignmentId: ASSIGNMENT_A,
    institutionId: INSTITUTION_A,
    displayOutcome: displayedOutcome(),
    env,
  });
  assert.deepEqual(result, { value: null, reason: "not_displayed" });
  assert.equal(tx.calls.length, 1);
});
