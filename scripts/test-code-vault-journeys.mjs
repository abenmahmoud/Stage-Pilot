import assert from "node:assert/strict";
import test from "node:test";

import {
  CODE_VAULT_JOURNEY_TYPES,
  VAULT_PROOF_CHANNELS,
  canVaultJourneyAgentModifyContact,
  decideEntInactifJourneyStep,
  decideEntActifJourneyStep,
  decideCantineJourneyStep,
  decideKoxoJourneyStep,
  decideMessagerieAcademiqueJourneyStep,
  buildModelVisibleMessagerieAcademiqueFact,
} from "../shared/code-vault-journeys.ts";

test("les cinq parcours du plan sont couverts, et les deux canaux de preuve sont email/téléphone", () => {
  assert.deepEqual(
    [...CODE_VAULT_JOURNEY_TYPES],
    ["ent_inactif", "ent_actif", "cantine", "koxo", "messagerie_academique"]
  );
  assert.deepEqual([...VAULT_PROOF_CHANNELS], ["email", "phone"]);
});

test("l'agent ne modifie structurellement jamais une coordonnée", () => {
  assert.equal(canVaultJourneyAgentModifyContact(), false);
});

test("ENT inactif : preuve vers une coordonnée déjà au dossier, puis composant sécurisé, puis invitation à réinitialiser", () => {
  assert.deepEqual(
    decideEntInactifJourneyStep({ phase: "before_proof", proofChannel: "email" }),
    { kind: "send_proof", channel: "email" }
  );
  assert.deepEqual(
    decideEntInactifJourneyStep({ phase: "before_proof", proofChannel: "phone" }),
    { kind: "send_proof", channel: "phone" }
  );
  assert.deepEqual(
    decideEntInactifJourneyStep({ phase: "awaiting_verification", proofChannel: "email" }),
    { kind: "await_verification" }
  );
  assert.deepEqual(
    decideEntInactifJourneyStep({ phase: "verified", proofChannel: "email" }),
    { kind: "reveal_in_secure_display", service: "ent" }
  );
  assert.deepEqual(
    decideEntInactifJourneyStep({ phase: "revealed", proofChannel: "email" }),
    { kind: "invite_password_reset" }
  );
});

test("ENT actif : guider la réinitialisation ; échec ou coordonnée incorrecte escalade vers le référent numérique", () => {
  assert.deepEqual(decideEntActifJourneyStep({ outcome: "start" }), {
    kind: "guide_password_reset",
  });
  assert.deepEqual(decideEntActifJourneyStep({ outcome: "succeeded" }), { kind: "done" });
  assert.deepEqual(decideEntActifJourneyStep({ outcome: "failed" }), {
    kind: "open_referral",
    service: "referent_numerique",
    reasonCode: "ent_reset_failed",
  });
  assert.deepEqual(decideEntActifJourneyStep({ outcome: "coordinate_incorrect" }), {
    kind: "open_referral",
    service: "referent_numerique",
    reasonCode: "ent_coordinate_incorrect",
  });
});

test("cantine : preuve puis numéro annuel de badge ; erreur vers l'intendance", () => {
  assert.deepEqual(
    decideCantineJourneyStep({ phase: "before_proof", proofChannel: "email" }),
    { kind: "send_proof", channel: "email" }
  );
  assert.deepEqual(
    decideCantineJourneyStep({ phase: "verified", proofChannel: "email" }),
    { kind: "reveal_in_secure_display", service: "cantine" }
  );
  assert.deepEqual(
    decideCantineJourneyStep({ phase: "lookup_failed", proofChannel: "email" }),
    { kind: "open_referral", service: "intendance", reasonCode: "cantine_badge_not_found" }
  );
});

test("koxo : preuve puis code fixe ; erreur vers le référent numérique", () => {
  assert.deepEqual(
    decideKoxoJourneyStep({ phase: "verified", proofChannel: "phone" }),
    { kind: "reveal_in_secure_display", service: "koxo" }
  );
  assert.deepEqual(
    decideKoxoJourneyStep({ phase: "lookup_failed", proofChannel: "phone" }),
    { kind: "open_referral", service: "referent_numerique", reasonCode: "koxo_code_not_found" }
  );
});

test("messagerie académique : seul l'email est vérifiable, les autres cas passent par le formulaire enrichi", () => {
  assert.deepEqual(
    decideMessagerieAcademiqueJourneyStep({ emailVerifiable: false, phase: "before_proof" }),
    { kind: "form_fallback", reasonCode: "messagerie_academique_email_not_verifiable" }
  );
  assert.deepEqual(
    decideMessagerieAcademiqueJourneyStep({ emailVerifiable: true, phase: "before_proof" }),
    { kind: "send_proof", channel: "email" }
  );
  assert.deepEqual(
    decideMessagerieAcademiqueJourneyStep({ emailVerifiable: true, phase: "awaiting_verification" }),
    { kind: "await_verification" }
  );
  assert.deepEqual(
    decideMessagerieAcademiqueJourneyStep({ emailVerifiable: true, phase: "verified" }),
    { kind: "confirm_academic_email_only" }
  );
});

test("le fait visible par le modèle sur la messagerie académique ne peut structurellement pas porter l'identifiant académique", () => {
  const interneAvecIdentifiant = {
    emailVerifiable: true,
    emailVerified: true,
    status: "confirmed",
    identifiantAcademique: "j.dupont@ac-secret.example",
  };

  const fact = buildModelVisibleMessagerieAcademiqueFact(interneAvecIdentifiant);
  const serialized = JSON.stringify(fact);
  assert.equal(serialized.includes("ac-secret"), false);
  assert.deepEqual(Object.keys(fact).sort(), ["emailVerifiable", "emailVerified", "status"]);
});
