import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  assertCommunicationPublicContent,
  communicationPublicCategory,
  communicationPublicSlug,
  parseCommunicationReviewRequest,
} from "../shared/communication-publication.ts";

const safeContent = {
  title: "Information fictive de rentrée",
  summary: "Une information vérifiée par la direction.",
  bodyMarkdown: "Le document sera disponible dans le portail officiel.",
  openQuestions: [],
};

test("accepts only an explicit internal or public review intent", () => {
  assert.deepEqual(parseCommunicationReviewRequest({ confirmation: "VERIFIER", visibility: "public" }), {
    confirmation: "VERIFIER",
    visibility: "public",
  });
  assert.deepEqual(parseCommunicationReviewRequest({ confirmation: "VERIFIER", visibility: "internal" }), {
    confirmation: "VERIFIER",
    visibility: "internal",
  });
  assert.throws(() => parseCommunicationReviewRequest({ confirmation: "VERIFIER", visibility: "targeted" }), /review_visibility_invalid/);
  assert.throws(() => parseCommunicationReviewRequest({ confirmation: "VALIDER", visibility: "public" }), /review_confirmation_invalid/);
  assert.throws(() => parseCommunicationReviewRequest({ confirmation: "VERIFIER", visibility: "public", recipients: [] }), /review_request_invalid/);
});

test("keeps public slugs stable, bounded and free of accents", () => {
  const slug = communicationPublicSlug("Réunion de rentrée : élèves et parents", "b4d8eaa0-12a3-45ce-9012-abcdef123456");
  assert.equal(slug, "reunion-de-rentree-eleves-et-parents-cdef123456");
  assert.match(slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  assert.ok(slug.length <= 119);
  assert.equal(communicationPublicCategory("rentree"), "Rentrée");
  assert.equal(communicationPublicCategory("inconnue"), "Vie du lycée");
});

test("refuses unresolved, oversized, secret-bearing or contact-bearing public content", () => {
  assert.doesNotThrow(() => assertCommunicationPublicContent(safeContent));
  assert.throws(() => assertCommunicationPublicContent({ ...safeContent, openQuestions: ["Date à confirmer"] }), /open_questions_remaining/);
  assert.throws(() => assertCommunicationPublicContent({ ...safeContent, bodyMarkdown: "mot de passe: Azerty123!" }), /secret_forbidden/);
  assert.throws(() => assertCommunicationPublicContent({ ...safeContent, bodyMarkdown: "Écrivez à personne@example.com" }), /email_address_forbidden/);
  assert.throws(() => assertCommunicationPublicContent({ ...safeContent, bodyMarkdown: "Appelez le 06 12 34 56 78" }), /phone_number_forbidden/);
  assert.throws(() => assertCommunicationPublicContent({ ...safeContent, summary: "x".repeat(601) }), /public_content_too_long/);
  assert.throws(() => assertCommunicationPublicContent({ ...safeContent, bodyMarkdown: "x".repeat(30_001) }), /public_content_too_long/);
});

test("approves only under direction, MFA, scope and a row lock", async () => {
  const route = await readFile(new URL("../api/communications/admin/[id]/approve.ts", import.meta.url), "utf8");
  assert.match(route, /requireCommunicationManager\(req\)/);
  assert.match(route, /for update/i);
  assert.match(route, /eq\(communications\.institutionId, context\.institutionId\)/);
  assert.match(route, /eq\(communicationVersions\.institutionId, context\.institutionId\)/);
  assert.match(route, /eq\(communicationVersions\.status, "review"\)/);
  assert.match(route, /status: "approved"/);
  assert.match(route, /communication\.approved/);
  assert.doesNotMatch(route, /bodyMarkdown|title: communicationVersions\.title|summary: communicationVersions\.summary/);
});

test("publishes the approved version atomically without exposing its content in the response", async () => {
  const route = await readFile(new URL("../api/communications/admin/[id]/publish.ts", import.meta.url), "utf8");
  const gate = await readFile(new URL("../api/_shared/communications.ts", import.meta.url), "utf8");
  assert.match(route, /requireCommunicationPublisher\(req\)/);
  assert.match(gate, /readCommunicationFeatureFlags\(\)\.publicationEnabled/);
  assert.match(gate, /communicationSettings\.publicationEnabled/);
  assert.match(route, /for update/i);
  assert.match(route, /root\.status !== "approved"/);
  assert.match(route, /root\.visibility !== "public"/);
  assert.match(route, /current\.status !== "approved"/);
  assert.match(route, /approvedBy: root\.approvedBy/);
  assert.match(route, /reviewedBy: root\.approvedBy/);
  assert.match(route, /assertCommunicationPublicContent\(current\)/);
  assert.match(route, /insert\(siteContentItems\)/);
  assert.match(route, /insert\(siteContentVersions\)/);
  assert.match(route, /status: "published"/);
  assert.match(route, /communication\.published/);
  const response = route.slice(route.lastIndexOf("return { communication, duplicate: false }"));
  assert.doesNotMatch(response, /bodyMarkdown|summary|title|openQuestions|approvedBy|siteContentId/);
});

test("keeps the UI publication action separate and disabled by default", async () => {
  const flags = await readFile(new URL("../src/lib/feature-flags.ts", import.meta.url), "utf8");
  const page = await readFile(new URL("../src/pages/admin/CommunicationsPage.tsx", import.meta.url), "utf8");
  assert.match(flags, /VITE_COMMUNICATION_PUBLICATION_ENABLED === "true"/);
  assert.match(page, /confirmation: "VALIDER"/);
  assert.match(page, /confirmation: "PUBLIER"/);
  assert.match(page, /disabled=\{publishing \|\| !COMMUNICATION_PUBLICATION_UI_ENABLED\}/);
  assert.match(page, /La publication créera une page datée dans « À la une »/);
  assert.doesNotMatch(page, /type="email"|recipientEmail|contactRef|audienceGroupRefs/);
});
