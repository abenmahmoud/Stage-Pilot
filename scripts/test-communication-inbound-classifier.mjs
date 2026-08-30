import assert from "node:assert/strict";
import test from "node:test";
import { classifyCommunicationInbound } from "../shared/communication-inbound-classifier.ts";

test("proposes withdrawal without ever executing it", () => {
  const result = classifyCommunicationInbound({
    subject: "Retrait de la liste",
    bodyText: "Bonjour, retirez-moi de la liste s’il vous plaît.",
  });
  assert.equal(result.classification, "withdrawal");
  assert.equal(result.confidence, "high");
  assert.equal(result.proposedAction, "confirm_withdrawal");
  assert.equal(result.requiresHumanReview, true);
});

test("does not misclassify an explicit withdrawal negation", () => {
  const result = classifyCommunicationInbound({
    subject: "Question",
    bodyText: "Ne me retirez pas de la liste : pouvez-vous seulement corriger mon adresse ?",
  });
  assert.equal(result.classification, "contact_correction");
  assert.equal(result.proposedAction, "review_contact_correction");
  assert.ok(result.signalCodes.includes("contact_correction_fr_action"));
});

test("recognizes contact corrections and questions before the free reply fallback", () => {
  assert.equal(classifyCommunicationInbound({
    subject: "Coordonnées",
    bodyText: "Mon adresse email a changé.",
  }).classification, "contact_correction");
  assert.equal(classifyCommunicationInbound({
    subject: "Réunion",
    bodyText: "À quelle heure commence la réunion ?",
  }).classification, "question");
  assert.equal(classifyCommunicationInbound({
    subject: "Merci",
    bodyText: "Bien reçu, merci pour cette information.",
  }).classification, "free_reply");
});

test("supports bounded multilingual signals without an external model", () => {
  assert.equal(classifyCommunicationInbound({
    subject: "Unsubscribe",
    bodyText: "Please remove me from the mailing.",
  }).classification, "withdrawal");
  assert.equal(classifyCommunicationInbound({
    subject: "Cambio",
    bodyText: "Mi correo ha cambiado.",
  }).classification, "contact_correction");
  assert.equal(classifyCommunicationInbound({
    subject: "طلب",
    bodyText: "أريد إلغاء الاشتراك.",
  }).classification, "withdrawal");
});

test("flags secret-bearing replies without returning their content", () => {
  const secret = "ABC123-secret-value";
  const result = classifyCommunicationInbound({
    subject: "Question",
    bodyText: `Mon mot de passe est ${secret}, pouvez-vous m’aider ?`,
  });
  assert.equal(result.sensitive, true);
  assert.equal(result.proposedAction, "secure_manual_review");
  assert.ok(result.signalCodes.includes("sensitive_content_detected"));
  assert.doesNotMatch(JSON.stringify(result), new RegExp(secret, "i"));
});

test("rejects empty, unbounded and unknown input fields", () => {
  assert.throws(() => classifyCommunicationInbound({ subject: "", bodyText: "" }), /body_invalid/);
  assert.throws(() => classifyCommunicationInbound({ subject: "x".repeat(501), bodyText: "Texte" }), /subject_invalid/);
  assert.throws(() => classifyCommunicationInbound({ subject: "", bodyText: "Texte", senderEmail: "x@example.test" }), /unknown_field/);
});
