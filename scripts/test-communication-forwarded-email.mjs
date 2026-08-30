import assert from "node:assert/strict";
import test from "node:test";
import { prepareCommunicationForwardedEmailDraft } from "../shared/communication-forwarded-email.ts";

const context = {
  sourceAuthorized: true,
  externalMessageHash: "a".repeat(64),
  attachmentCount: 1,
};

test("creates only an internal reviewed draft from an authorized forwarded email", () => {
  const result = prepareCommunicationForwardedEmailDraft({
    subject: "TR: Information fictive",
    extractedText: `-------- Message transféré --------
De: Direction fictive <direction@example.invalid>
Date: 30 août 2026
Objet: Information fictive
À: Collecte fictive <collecte@example.invalid>

Bonjour,

Une information strictement fictive doit être relue.`,
  }, context);

  assert.equal(result.draft.sourceType, "forwarded_email");
  assert.equal(result.draft.title, "Information fictive");
  assert.match(result.draft.bodyMarkdown, /^Bonjour,/);
  assert.doesNotMatch(result.draft.bodyMarkdown, /direction@example|collecte@example|^De:/m);
  assert.match(result.sourceFingerprint, /^[a-f0-9]{64}$/);
  assert.deepEqual({
    visibility: result.visibility,
    status: result.status,
    requiresHumanReview: result.requiresHumanReview,
    canPublish: result.canPublish,
    canNotify: result.canNotify,
  }, {
    visibility: "internal",
    status: "draft",
    requiresHumanReview: true,
    canPublish: false,
    canNotify: false,
  });
});

test("refuses unauthorized sources, unknown fields and malformed private context", () => {
  const input = { subject: "Information", extractedText: "Contenu fictif." };
  assert.throws(() => prepareCommunicationForwardedEmailDraft(input, { ...context, sourceAuthorized: false }), /source_not_authorized/);
  assert.throws(() => prepareCommunicationForwardedEmailDraft({ ...input, recipients: [] }, context), /unknown_field/);
  assert.throws(() => prepareCommunicationForwardedEmailDraft(input, { ...context, externalMessageHash: "raw-message-id" }), /message_hash_invalid/);
  assert.throws(() => prepareCommunicationForwardedEmailDraft(input, { ...context, attachmentCount: 21 }), /attachment_count_invalid/);
});

test("uses the provider HMAC for a stable duplicate-resistant source fingerprint", () => {
  const input = { subject: "Information", extractedText: "Contenu fictif." };
  const first = prepareCommunicationForwardedEmailDraft(input, context).sourceFingerprint;
  assert.equal(first, prepareCommunicationForwardedEmailDraft(input, { ...context }).sourceFingerprint);
  assert.notEqual(first, prepareCommunicationForwardedEmailDraft(input, {
    ...context,
    externalMessageHash: "b".repeat(64),
  }).sourceFingerprint);
});

test("removes old reply history and neutralizes remote markdown images", () => {
  const result = prepareCommunicationForwardedEmailDraft({
    subject: "Fwd: Message fictif",
    extractedText: `Information actuelle.

![Affiche](https://images.example.invalid/pixel.png)

Le 29 août 2026, Exemple a écrit :
> Ancienne conversation privée.`,
  }, { ...context, attachmentCount: 0 });
  assert.match(result.draft.bodyMarkdown, /Image externe non chargée : Affiche/);
  assert.doesNotMatch(result.draft.bodyMarkdown, /https:\/\/|Ancienne conversation/);
});

test("flags personal data and blocks secrets or active markup before any AI help", () => {
  const privateResult = prepareCommunicationForwardedEmailDraft({
    subject: "Coordonnées fictives",
    extractedText: "Réponse : parent@example.invalid ou 06 12 34 56 78.",
  }, context);
  assert.deepEqual(privateResult.privacySignals, ["email_address", "phone_number"]);
  assert.equal(privateResult.redactionRequiredBeforeAi, true);
  assert.match(privateResult.draft.openQuestions.join(" "), /données personnelles/i);

  assert.throws(() => prepareCommunicationForwardedEmailDraft({
    subject: "Secret",
    extractedText: "Mot de passe : Azerty123!",
  }, context), /secret_forbidden/);
  assert.throws(() => prepareCommunicationForwardedEmailDraft({
    subject: "HTML",
    extractedText: "<script>alert('x')</script>",
  }, context), /unsafe_markup_forbidden/);
});
