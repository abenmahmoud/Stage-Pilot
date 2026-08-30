import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCommunicationEmailPreview,
  safeCommunicationPreviewHref,
} from "../shared/communication-email-preview.ts";

test("builds the future email from the same bounded editorial content", () => {
  assert.deepEqual(buildCommunicationEmailPreview({
    title: "Réunion de rentrée",
    summary: "Les équipes sont attendues à 9 h.",
    bodyMarkdown: "## À retenir\n\nMerci de consulter le document.",
  }), {
    senderName: "Lycée Blaise Cendrars",
    recipientState: "not_selected",
    subject: "Réunion de rentrée",
    preheader: "Les équipes sont attendues à 9 h.",
    bodyMarkdown: "## À retenir\n\nMerci de consulter le document.",
    canonicalLinkState: "pending_publication",
    canSend: false,
  });
});

test("uses safe placeholders for an unfinished local draft", () => {
  const preview = buildCommunicationEmailPreview({ title: "", summary: "", bodyMarkdown: "" });
  assert.equal(preview.subject, "Titre du message");
  assert.equal(preview.preheader, "Communication de l’établissement");
  assert.equal(preview.bodyMarkdown, "Le contenu du message apparaîtra ici.");
  assert.equal(preview.canSend, false);
});

test("derives a plain bounded preheader without leaking markdown destinations", () => {
  const preview = buildCommunicationEmailPreview({
    title: "Information",
    summary: "",
    bodyMarkdown: "[Consulter](https://example.test/private) **le document** " + "utile ".repeat(80),
  });
  assert.match(preview.preheader, /^Consulter le document utile/);
  assert.doesNotMatch(preview.preheader, /example\.test|https?:/);
  assert.ok(preview.preheader.length <= 160);
});

test("rejects unbounded content and any recipient or delivery field", () => {
  assert.throws(() => buildCommunicationEmailPreview({
    title: "Information",
    summary: "",
    bodyMarkdown: "Texte",
    recipient: "person@example.test",
  }), /unknown_field/);
  assert.throws(() => buildCommunicationEmailPreview({
    title: "x".repeat(181),
    summary: "",
    bodyMarkdown: "Texte",
  }), /title_invalid/);
});

test("allows only relative or credential-free HTTPS links in previews", () => {
  assert.equal(safeCommunicationPreviewHref("/informations/exemple"), "/informations/exemple");
  assert.equal(safeCommunicationPreviewHref("https://lycee.example.test/info"), "https://lycee.example.test/info");
  assert.equal(safeCommunicationPreviewHref("http://lycee.example.test/info"), null);
  assert.equal(safeCommunicationPreviewHref("javascript:alert(1)"), null);
  assert.equal(safeCommunicationPreviewHref("mailto:person@example.test"), null);
  assert.equal(safeCommunicationPreviewHref("https://user:pass@example.test/info"), null);
  assert.equal(safeCommunicationPreviewHref("/information\\suite"), null);
  assert.equal(safeCommunicationPreviewHref("/information\njavascript:alert(1)"), null);
});
