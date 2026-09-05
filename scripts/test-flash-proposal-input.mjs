import assert from "node:assert/strict";
import test from "node:test";

import {
  FlashProposalInputError,
  parseFlashProposalInput,
} from "../shared/flash-proposal-input.ts";

function validBase(overrides = {}) {
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

test("une proposition normale minimale et valide est acceptee", () => {
  const parsed = parseFlashProposalInput(validBase());
  assert.equal(parsed.title, "Sortie pédagogique reportée");
  assert.equal(parsed.importance, "normale");
  assert.deepEqual(parsed.channels, []);
  assert.deepEqual(parsed.groupRefs, ["classe:2nde4"]);
  assert.ok(parsed.expiresAt instanceof Date);
});

test("un champ inconnu est refuse (aucune cle de debug ne doit passer)", () => {
  assert.throws(
    () => parseFlashProposalInput(validBase({ debug: true })),
    (error) => error instanceof FlashProposalInputError && error.reason === "unknown_field"
  );
});

test("un titre trop court ou trop long est refuse", () => {
  assert.throws(
    () => parseFlashProposalInput(validBase({ title: "A" })),
    (error) => error instanceof FlashProposalInputError && error.reason === "title_invalid"
  );
  assert.throws(
    () => parseFlashProposalInput(validBase({ title: "A".repeat(181) })),
    (error) => error instanceof FlashProposalInputError && error.reason === "title_invalid"
  );
});

test("un texte vide est refuse", () => {
  assert.throws(
    () => parseFlashProposalInput(validBase({ bodyMarkdown: "" })),
    (error) => error instanceof FlashProposalInputError && error.reason === "body_markdown_invalid"
  );
});

test("une importance inconnue est refusee", () => {
  assert.throws(
    () => parseFlashProposalInput(validBase({ importance: "critique" })),
    (error) => error instanceof FlashProposalInputError && error.reason === "importance_invalid"
  );
});

test("une flash normale avec un canal est refusee : normale = site seul", () => {
  assert.throws(
    () => parseFlashProposalInput(validBase({ channels: ["push"] })),
    (error) => error instanceof FlashProposalInputError && error.reason === "channels_invalid_for_importance"
  );
});

test("une flash importante sans push est refusee : push est obligatoire", () => {
  assert.throws(
    () => parseFlashProposalInput(validBase({ importance: "importante", channels: ["email"] })),
    (error) => error instanceof FlashProposalInputError && error.reason === "channels_missing_required"
  );
});

test("une flash importante avec push et email facultatif est acceptee", () => {
  const parsed = parseFlashProposalInput(
    validBase({ importance: "importante", channels: ["push", "email"] })
  );
  assert.deepEqual(parsed.channels, ["push", "email"]);
});

test("une flash importante avec sms est refusee : sms est reserve a l'urgent", () => {
  assert.throws(
    () => parseFlashProposalInput(validBase({ importance: "importante", channels: ["push", "sms"] })),
    (error) => error instanceof FlashProposalInputError && error.reason === "channels_invalid_for_importance"
  );
});

test("une flash urgente sans email est refusee : push et email sont obligatoires", () => {
  assert.throws(
    () => parseFlashProposalInput(validBase({ importance: "urgente", channels: ["push"] })),
    (error) => error instanceof FlashProposalInputError && error.reason === "channels_missing_required"
  );
});

test("une flash urgente avec push, email et sms est acceptee", () => {
  const parsed = parseFlashProposalInput(
    validBase({ importance: "urgente", channels: ["push", "email", "sms"] })
  );
  assert.deepEqual(parsed.channels, ["push", "email", "sms"]);
});

test("un canal duplique est refuse", () => {
  assert.throws(
    () => parseFlashProposalInput(validBase({ importance: "importante", channels: ["push", "push"] })),
    (error) => error instanceof FlashProposalInputError && error.reason === "channels_duplicate"
  );
});

test("une audience vide est refusee", () => {
  assert.throws(
    () => parseFlashProposalInput(validBase({ groupRefs: [] })),
    (error) => error instanceof FlashProposalInputError && error.reason === "group_refs_invalid"
  );
});

test("une reference de groupe invalide est refusee (meme filtre que flash-audience-correction)", () => {
  assert.throws(
    () => parseFlashProposalInput(validBase({ groupRefs: ["a@b"] })),
    (error) => error instanceof FlashProposalInputError && error.reason === "group_refs_invalid"
  );
});

test("une reference de groupe dupliquee est refusee", () => {
  assert.throws(
    () => parseFlashProposalInput(validBase({ groupRefs: ["classe:2nde4", "classe:2nde4"] })),
    (error) => error instanceof FlashProposalInputError && error.reason === "group_refs_duplicate"
  );
});

test("une expiration absente ou passee est refusee : l'expiration est obligatoire", () => {
  assert.throws(
    () => parseFlashProposalInput(validBase({ expiresAt: "" })),
    (error) => error instanceof FlashProposalInputError && error.reason === "expires_at_invalid"
  );
  assert.throws(
    () => parseFlashProposalInput(validBase({ expiresAt: new Date(Date.now() - 1000).toISOString() })),
    (error) => error instanceof FlashProposalInputError && error.reason === "expires_at_invalid"
  );
});

test("un corps qui n'est pas un objet est refuse", () => {
  assert.throws(
    () => parseFlashProposalInput(null),
    (error) => error instanceof FlashProposalInputError && error.reason === "body_invalid"
  );
  assert.throws(
    () => parseFlashProposalInput([]),
    (error) => error instanceof FlashProposalInputError && error.reason === "body_invalid"
  );
});
