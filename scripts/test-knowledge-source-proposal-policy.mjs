import assert from "node:assert/strict";
import test from "node:test";
import {
  allowedProvenanceStatuses,
  detectPersonalOrSecretSignals,
  parseConversationProposalInput,
  parseFlashProposalActivationInput,
  parseKnowledgeSourceProposalDecisionInput,
} from "../shared/knowledge-source-proposal-policy.ts";

const CONVERSATION_ID = "11111111-1111-4111-8111-111111111111";

function baseConversationInput(overrides = {}) {
  return {
    conversationId: CONVERSATION_ID,
    title: "Procédure de contournement observée en conversation",
    candidateText: "Un usager a expliqué la procédure suivie pour obtenir un duplicata de carte, sans donnée personnelle.",
    classification: "internal",
    serviceCodes: ["vie_scolaire"],
    validFrom: "2026-09-06T00:00:00.000Z",
    expiresAt: "2026-12-31T00:00:00.000Z",
    provenanceStatus: "observed",
    usePolicy: "can_use_as_evidence",
    ...overrides,
  };
}

test("parses a valid conversation proposal", () => {
  const parsed = parseConversationProposalInput(baseConversationInput());
  assert.equal(parsed.origin, "conversation");
  assert.equal(parsed.conversationId, CONVERSATION_ID);
  assert.equal(parsed.provenanceStatus, "observed");
  assert.equal(parsed.usePolicy, "can_use_as_evidence");
});

test("rejects a conversation proposal with an invalid conversation id", () => {
  assert.throws(() => parseConversationProposalInput(baseConversationInput({ conversationId: "not-a-uuid" })));
});

test("rejects expiresAt before validFrom", () => {
  assert.throws(() =>
    parseConversationProposalInput(
      baseConversationInput({ validFrom: "2026-09-06T00:00:00.000Z", expiresAt: "2026-01-01T00:00:00.000Z" })
    )
  );
});

test("rejects a public classification scoped to a service", () => {
  assert.throws(() =>
    parseConversationProposalInput(baseConversationInput({ classification: "public", serviceCodes: ["ddfpt"] }))
  );
});

for (const provenanceStatus of ["imported", "superseded", "disputed"]) {
  test(`rejects provenance '${provenanceStatus}' for a conversation origin (rule 2 of the plan)`, () => {
    assert.throws(() => parseConversationProposalInput(baseConversationInput({ provenanceStatus })));
  });
}

test("rejects 'generated'/'inferred' provenance paired with can_use_as_instruction (LOT 1 rule enforced here too)", () => {
  assert.throws(() =>
    parseConversationProposalInput(
      baseConversationInput({ provenanceStatus: "generated", usePolicy: "can_use_as_instruction" })
    )
  );
  assert.throws(() =>
    parseConversationProposalInput(
      baseConversationInput({ provenanceStatus: "inferred", usePolicy: "can_use_as_instruction" })
    )
  );
});

test("allows 'generated' provenance paired with a non-instruction use policy", () => {
  const parsed = parseConversationProposalInput(
    baseConversationInput({ provenanceStatus: "generated", usePolicy: "requires_human_confirmation" })
  );
  assert.equal(parsed.provenanceStatus, "generated");
});

test("conversation origin allows exactly: observed, inferred, user_confirmed, generated", () => {
  assert.deepEqual(
    [...allowedProvenanceStatuses("conversation")].sort(),
    ["generated", "inferred", "observed", "user_confirmed"].sort()
  );
});

test("flash_publication origin allows exactly: imported, user_confirmed", () => {
  assert.deepEqual([...allowedProvenanceStatuses("flash_publication")].sort(), ["imported", "user_confirmed"]);
});

function baseFlashInput(overrides = {}) {
  return {
    classification: "public",
    serviceCodes: [],
    provenanceStatus: "imported",
    usePolicy: "can_use_as_instruction",
    ...overrides,
  };
}

test("parses a valid flash activation input", () => {
  const parsed = parseFlashProposalActivationInput(baseFlashInput());
  assert.equal(parsed.origin, "flash_publication");
  assert.equal(parsed.provenanceStatus, "imported");
});

test("rejects a flash activation input with a conversation-only provenance", () => {
  assert.throws(() => parseFlashProposalActivationInput(baseFlashInput({ provenanceStatus: "observed" })));
  assert.throws(() => parseFlashProposalActivationInput(baseFlashInput({ provenanceStatus: "generated" })));
});

test("parses a valid decision input", () => {
  const parsed = parseKnowledgeSourceProposalDecisionInput({
    action: "approve",
    note: "Vérifié avec le service concerné, contenu conforme.",
  });
  assert.equal(parsed.action, "approve");
});

test("rejects a decision note that is too short", () => {
  assert.throws(() => parseKnowledgeSourceProposalDecisionInput({ action: "approve", note: "ok" }));
});

test("detects an email address as a personal-data signal", () => {
  assert.deepEqual(detectPersonalOrSecretSignals("Contactez-moi à jean.dupont@example.test pour la suite."), [
    "email_address",
  ]);
});

test("detects a French phone number as a personal-data signal", () => {
  assert.deepEqual(detectPersonalOrSecretSignals("Mon numéro est le 06 12 34 56 78, rappelez-moi."), [
    "phone_number",
  ]);
});

test("detects a forbidden secret (password) as a signal", () => {
  const signals = detectPersonalOrSecretSignals("mon mot de passe est Sesame1234!");
  assert.ok(signals.includes("password"));
});

test("returns no signal for an ordinary sentence", () => {
  assert.deepEqual(detectPersonalOrSecretSignals("La cantine ferme à 13h30 le vendredi."), []);
});
