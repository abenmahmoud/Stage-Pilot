import assert from "node:assert/strict";
import test from "node:test";

import {
  FlashDecisionInputError,
  parseFlashDecisionInput,
} from "../shared/flash-decision-input.ts";

function validContent(overrides = {}) {
  return {
    title: "Sortie pédagogique reportée",
    bodyMarkdown: "La sortie de la classe de Seconde A est reportée au 12 septembre.",
    importance: "normale",
    channels: [],
    groupRefs: ["classe:2nde4"],
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    ...overrides,
  };
}

test("valider sans contenu est accepté : content reste null", () => {
  const parsed = parseFlashDecisionInput({ decision: "validee" });
  assert.equal(parsed.decision, "validee");
  assert.equal(parsed.content, null);
});

test("refuser sans contenu est accepté", () => {
  const parsed = parseFlashDecisionInput({ decision: "refusee" });
  assert.equal(parsed.decision, "refusee");
  assert.equal(parsed.content, null);
});

test("valider avec un contenu edité est une modification : reutilise parseFlashProposalInput", () => {
  const parsed = parseFlashDecisionInput({
    decision: "validee",
    content: validContent({ title: "Sortie pédagogique confirmée" }),
  });
  assert.equal(parsed.decision, "validee");
  assert.ok(parsed.content);
  assert.equal(parsed.content.title, "Sortie pédagogique confirmée");
});

test("refuser avec un contenu est refusé : un refus ne modifie rien", () => {
  assert.throws(
    () => parseFlashDecisionInput({ decision: "refusee", content: validContent() }),
    (error) => error instanceof FlashDecisionInputError && error.reason === "content_not_allowed_for_refusal"
  );
});

test("une décision inconnue est refusée (publiee n'est pas atteignable depuis une décision)", () => {
  assert.throws(
    () => parseFlashDecisionInput({ decision: "publiee" }),
    (error) => error instanceof FlashDecisionInputError && error.reason === "decision_invalid"
  );
  assert.throws(
    () => parseFlashDecisionInput({ decision: "modifiee" }),
    (error) => error instanceof FlashDecisionInputError && error.reason === "decision_invalid"
  );
});

test("un champ inconnu est refusé", () => {
  assert.throws(
    () => parseFlashDecisionInput({ decision: "validee", motif: "parce que" }),
    (error) => error instanceof FlashDecisionInputError && error.reason === "unknown_field"
  );
});

test("un contenu édité invalide remonte l'erreur du module réutilisé, préfixée", () => {
  assert.throws(
    () => parseFlashDecisionInput({ decision: "validee", content: validContent({ title: "A" }) }),
    (error) => error instanceof FlashDecisionInputError && error.reason === "content_title_invalid"
  );
  assert.throws(
    () => parseFlashDecisionInput({ decision: "validee", content: validContent({ groupRefs: [] }) }),
    (error) => error instanceof FlashDecisionInputError && error.reason === "content_group_refs_invalid"
  );
});

test("un corps qui n'est pas un objet est refusé", () => {
  assert.throws(
    () => parseFlashDecisionInput(null),
    (error) => error instanceof FlashDecisionInputError && error.reason === "body_invalid"
  );
  assert.throws(
    () => parseFlashDecisionInput([]),
    (error) => error instanceof FlashDecisionInputError && error.reason === "body_invalid"
  );
  assert.throws(
    () => parseFlashDecisionInput("validee"),
    (error) => error instanceof FlashDecisionInputError && error.reason === "body_invalid"
  );
});
