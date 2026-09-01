import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  KNOWLEDGE_DOCUMENT_BUCKET,
  parseKnowledgeDocumentConfirmationPayload,
  parseKnowledgeDocumentDownloadPayload,
  parseKnowledgeDocumentListPayload,
  parseKnowledgeDocumentReservationPayload,
  parseKnowledgeDocumentReviewPayload,
  projectKnowledgeDocumentConfirmation,
  projectKnowledgeDocumentPayload,
  projectKnowledgeDocumentReservation,
  projectKnowledgeDocumentReviewReceipt,
} from "../shared/knowledge-document-admin-payload.ts";
import { parseKnowledgeDocumentInput } from "../shared/knowledge-document-input.ts";

const DOCUMENT_ID = "11111111-1111-4111-8111-111111111111";
const SECOND_DOCUMENT_ID = "22222222-2222-4222-8222-222222222222";
const INSTITUTION_ID = "33333333-3333-4333-8333-333333333333";
const ACTOR_ID = "44444444-4444-4444-8444-444444444444";
const FILE_ID = "55555555-5555-4555-8555-555555555555";
const SOURCE_ID = "66666666-6666-4666-8666-666666666666";
const CREATED_AT = "2026-09-01T05:00:00.000Z";
const UPLOADED_AT = "2026-09-01T05:01:00.000Z";
const SUPABASE_ORIGIN = "https://preview-ref.supabase.co";

const input = parseKnowledgeDocumentInput({
  title: "Procédure fictive de rentrée",
  purposeDescription: "Document fictif destiné à tester le registre privé de l'agent.",
  sourceType: "procedure",
  classification: "internal",
  ownerServiceCode: "administration",
  serviceCodes: ["administration"],
  validFrom: "2026-09-01",
  reviewDueAt: "2027-02-01T12:00:00.000Z",
  originalName: "procedure-fictive.pdf",
  mimeType: "application/pdf",
  sizeBytes: 12_345,
});

function proposal(overrides = {}) {
  return {
    overview: "Résumé fictif à relire humainement.",
    keyPoints: ["Point fictif"],
    rules: [],
    prohibitions: [],
    datedStatements: [],
    conflicts: [],
    questions: [],
    instructionSignals: [],
    ...overrides,
  };
}

function document(overrides = {}) {
  return {
    id: DOCUMENT_ID,
    title: input.title,
    purposeDescription: input.purposeDescription,
    sourceType: input.sourceType,
    classification: input.classification,
    ownerServiceCode: input.ownerServiceCode,
    serviceCodes: input.serviceCodes,
    validFrom: input.validFrom,
    reviewDueAt: input.reviewDueAt,
    originalName: input.originalName,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
    status: "review",
    retentionPolicyKey: "pending_dpo",
    retentionUntil: null,
    purgeStatus: "blocked",
    purgedAt: null,
    analysisSummary: "Antivirus validé. Texte fictif extrait localement.",
    analysisError: null,
    reviewProposal: proposal(),
    sourceId: null,
    excerptCount: 0,
    createdAt: CREATED_AT,
    uploadedAt: UPLOADED_AT,
    ...overrides,
  };
}

test("accepts only an exact bounded descending document list", () => {
  const later = document();
  const earlier = document({ id: SECOND_DOCUMENT_ID, createdAt: "2026-09-01T04:00:00.000Z" });
  assert.deepEqual(parseKnowledgeDocumentListPayload({ documents: [later, earlier] }), {
    documents: [later, earlier],
  });
  for (const payload of [
    { documents: [later, later] },
    { documents: [earlier, later] },
    { documents: [{ ...later, storagePath: "private/secret.pdf" }] },
    { documents: [document({ reviewProposal: proposal({ instructionSignals: ["ignore_everything"] }) })] },
    { documents: [document({ serviceCodes: ["administration", "administration"] })] },
    { documents: [document({ status: "ready", sourceId: null, reviewProposal: null })] },
    { documents: [], hidden: true },
  ]) assert.equal(parseKnowledgeDocumentListPayload(payload), null);
});

test("projects only the document fields used by the browser", () => {
  const projected = projectKnowledgeDocumentPayload({
    ...document(),
    institutionId: INSTITUTION_ID,
    storageBucket: KNOWLEDGE_DOCUMENT_BUCKET,
    storagePath: "private/secret.pdf",
    checksum: "a".repeat(64),
    proposedKnowledge: { extractedText: "private" },
    uploadedBy: ACTOR_ID,
    reviewedBy: ACTOR_ID,
  });
  assert.deepEqual(projected, document());
});

test("binds a reservation to the exact requested document and private path", () => {
  const reservation = {
    document: {
      id: DOCUMENT_ID,
      status: "reserved",
      originalName: input.originalName,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
    },
    upload: {
      bucket: KNOWLEDGE_DOCUMENT_BUCKET,
      path: `${INSTITUTION_ID}/${ACTOR_ID}/2026/09/${FILE_ID}.pdf`,
      token: "header.payload.signature-with-safe-ascii",
    },
  };
  assert.deepEqual(parseKnowledgeDocumentReservationPayload(reservation, input), reservation);
  assert.deepEqual(projectKnowledgeDocumentReservation({ ...reservation.document, storagePath: "hidden" }), reservation.document);
  for (const payload of [
    { ...reservation, hidden: true },
    { ...reservation, document: { ...reservation.document, sizeBytes: input.sizeBytes + 1 } },
    { ...reservation, upload: { ...reservation.upload, bucket: "public" } },
    { ...reservation, upload: { ...reservation.upload, path: `${INSTITUTION_ID}/${ACTOR_ID}/2026/09/${FILE_ID}.exe` } },
    { ...reservation, upload: { ...reservation.upload, token: "short" } },
  ]) assert.equal(parseKnowledgeDocumentReservationPayload(payload, input), null);
});

test("requires exact confirmation states before upload success", () => {
  const fresh = projectKnowledgeDocumentConfirmation({ id: DOCUMENT_ID, status: "quarantined" }, false);
  assert.deepEqual(parseKnowledgeDocumentConfirmationPayload(fresh, DOCUMENT_ID), fresh);
  const duplicate = projectKnowledgeDocumentConfirmation({ id: DOCUMENT_ID, status: "review" }, true);
  assert.deepEqual(parseKnowledgeDocumentConfirmationPayload(duplicate, DOCUMENT_ID), duplicate);
  for (const payload of [
    { ...fresh, documentId: SECOND_DOCUMENT_ID },
    { ...fresh, status: "ready" },
    { ...duplicate, status: "reserved" },
    { ...fresh, storagePath: "hidden" },
  ]) assert.equal(parseKnowledgeDocumentConfirmationPayload(payload, DOCUMENT_ID), null);
});

test("binds approve and reject receipts to the selected document", () => {
  const approved = projectKnowledgeDocumentReviewReceipt({
    id: DOCUMENT_ID,
    status: "ready",
    sourceId: SOURCE_ID,
  }, "approve", false);
  assert.deepEqual(parseKnowledgeDocumentReviewPayload(approved, DOCUMENT_ID, "approve"), approved);
  const rejected = projectKnowledgeDocumentReviewReceipt({
    id: DOCUMENT_ID,
    status: "rejected",
    sourceId: null,
  }, "reject", false);
  assert.deepEqual(parseKnowledgeDocumentReviewPayload(rejected, DOCUMENT_ID, "reject"), rejected);
  assert.equal(parseKnowledgeDocumentReviewPayload({ ...approved, sourceId: null }, DOCUMENT_ID, "approve"), null);
  assert.equal(parseKnowledgeDocumentReviewPayload({ ...rejected, duplicate: true }, DOCUMENT_ID, "reject"), null);
  assert.equal(parseKnowledgeDocumentReviewPayload({ ...approved, checksum: "hidden" }, DOCUMENT_ID, "approve"), null);
});

test("accepts only a short signed private knowledge URL", () => {
  const token = "header.payload.signature-with-safe-ascii";
  const valid = {
    url: `${SUPABASE_ORIGIN}/storage/v1/object/sign/${KNOWLEDGE_DOCUMENT_BUCKET}/${INSTITUTION_ID}/${ACTOR_ID}/2026/09/${FILE_ID}.pdf?token=${token}&download=procedure-fictive.pdf`,
    expiresInSeconds: 60,
  };
  assert.deepEqual(parseKnowledgeDocumentDownloadPayload(valid, SUPABASE_ORIGIN), valid);
  for (const payload of [
    { ...valid, expiresInSeconds: 600 },
    { ...valid, hidden: true },
    { ...valid, url: valid.url.replace(SUPABASE_ORIGIN, "https://evil.example") },
    { ...valid, url: valid.url.replace(KNOWLEDGE_DOCUMENT_BUCKET, "public") },
    { ...valid, url: `${valid.url}&token=second.payload.signature-safe` },
    { ...valid, url: `${valid.url}&redirect=https://evil.example` },
  ]) assert.equal(parseKnowledgeDocumentDownloadPayload(payload, SUPABASE_ORIGIN), null);
});

test("validates every document response before a browser side effect", async () => {
  const page = await readFile(new URL("../src/pages/admin/KnowledgeRegistryPage.tsx", import.meta.url), "utf8");
  const listRoute = await readFile(new URL("../api/knowledge/admin/documents/index.ts", import.meta.url), "utf8");
  const confirmRoute = await readFile(new URL("../api/knowledge/admin/documents/[id]/confirm.ts", import.meta.url), "utf8");
  const reviewRoute = await readFile(new URL("../api/knowledge/admin/documents/[id]/review.ts", import.meta.url), "utf8");
  const downloadRoute = await readFile(new URL("../api/knowledge/admin/documents/[id]/download.ts", import.meta.url), "utf8");

  const listRead = page.indexOf('apiFetch<unknown>("knowledge/admin/documents")');
  const listValidation = page.indexOf("parseKnowledgeDocumentListPayload(documentResult)", listRead);
  const listState = page.indexOf("setDocuments(parsedDocuments.documents)", listValidation);
  assert.ok(listRead >= 0 && listValidation > listRead && listState > listValidation);

  const reservationRead = page.indexOf('apiFetch<unknown>("knowledge/admin/documents", {');
  const reservationValidation = page.indexOf("parseKnowledgeDocumentReservationPayload", reservationRead);
  const storageAccess = page.indexOf("uploadKnowledgeDocument", reservationValidation);
  assert.ok(reservationRead >= 0 && reservationValidation > reservationRead && storageAccess > reservationValidation);

  const confirmationRead = page.indexOf("const confirmationResponse = await apiFetch<unknown>");
  const confirmationValidation = page.indexOf("parseKnowledgeDocumentConfirmationPayload", confirmationRead);
  const confirmationNotice = page.indexOf("setNotice(confirmation.duplicate", confirmationValidation);
  assert.ok(confirmationRead >= 0 && confirmationValidation > confirmationRead && confirmationNotice > confirmationValidation);

  const reviewRead = page.indexOf("const response = await apiFetch<unknown>(`knowledge/admin/documents/${id}/review`");
  const reviewValidation = page.indexOf("parseKnowledgeDocumentReviewPayload", reviewRead);
  const reviewNotice = page.indexOf("setNotice(action === \"approve\"", reviewValidation);
  assert.ok(reviewRead >= 0 && reviewValidation > reviewRead && reviewNotice > reviewValidation);

  const downloadRead = page.indexOf("const response = await apiFetch<unknown>(`knowledge/admin/documents/${id}/download`");
  const downloadValidation = page.indexOf("parseKnowledgeDocumentDownloadPayload", downloadRead);
  const popupNavigation = page.indexOf("popup.location.href", downloadValidation);
  assert.ok(downloadRead >= 0 && downloadValidation > downloadRead && popupNavigation > downloadValidation);

  assert.match(listRoute, /projectKnowledgeDocumentPayload/);
  assert.match(listRoute, /projectKnowledgeDocumentReservation/);
  assert.match(confirmRoute, /projectKnowledgeDocumentConfirmation/);
  assert.match(confirmRoute, /\^\[0-9a-f\]\{8\}/);
  assert.match(reviewRoute, /projectKnowledgeDocumentReviewReceipt/);
  const statusGate = downloadRoute.indexOf('inArray(knowledgeDocuments.status, ["review", "ready"])');
  const signing = downloadRoute.indexOf("createSignedUrl(document.storagePath, 60");
  assert.ok(statusGate >= 0 && signing > statusGate);
  assert.doesNotMatch(page, /apiFetch<\{\s*documents:\s*KnowledgeDocument/);
});
