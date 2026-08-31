import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  COMMUNICATION_DOCUMENT_BUCKET,
  parseCommunicationDocumentConfirmationPayload,
  parseCommunicationDocumentListPayload,
  parseCommunicationDocumentReservationPayload,
} from "../shared/communication-document-payload.ts";

const PAGE_PATH = new URL("../src/pages/admin/CommunicationsPage.tsx", import.meta.url);
const SERVER_SHARED_PATH = new URL("../api/_shared/communication-documents.ts", import.meta.url);
const DOCUMENT_ID = "11111111-1111-4111-8111-111111111111";
const COMMUNICATION_ID = "22222222-2222-4222-8222-222222222222";
const FILE_UUID = "33333333-3333-4333-8333-333333333333";
const CREATED_AT = "2026-08-31T08:00:00.000Z";
const UPLOADED_AT = "2026-08-31T08:01:00.000Z";
const UPDATED_AT = "2026-08-31T08:02:00.000Z";
const PDF = {
  originalName: "Information-fictive.pdf",
  mimeType: "application/pdf",
  sizeBytes: 12_345,
};

function document(overrides = {}) {
  return {
    id: DOCUMENT_ID,
    communicationId: null,
    ...PDF,
    status: "quarantined",
    analysisError: null,
    uploadedAt: UPLOADED_AT,
    analyzedAt: null,
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
    ...overrides,
  };
}

function reservation(overrides = {}) {
  return {
    document: {
      id: DOCUMENT_ID,
      ...PDF,
      status: "reserved",
      createdAt: CREATED_AT,
    },
    upload: {
      bucket: COMMUNICATION_DOCUMENT_BUCKET,
      path: `private/2026/08/${FILE_UUID}.pdf`,
      token: "header.payload.signature-with-safe-ascii",
    },
    ...overrides,
  };
}

test("accepts bounded list, reservation and confirmation payloads", () => {
  assert.deepEqual(parseCommunicationDocumentListPayload({ documents: [document()] }), {
    documents: [document()],
  });
  assert.deepEqual(parseCommunicationDocumentReservationPayload(reservation(), PDF), reservation());
  const normalizedReservation = reservation({
    document: { ...reservation().document, originalName: "Réunion-fictive.pdf" },
  });
  assert.deepEqual(
    parseCommunicationDocumentReservationPayload(
      normalizedReservation,
      { ...PDF, originalName: "Re\u0301union-fictive.pdf" }
    ),
    normalizedReservation
  );
  const confirmation = { document: document(), duplicate: false };
  assert.deepEqual(
    parseCommunicationDocumentConfirmationPayload(confirmation, { id: DOCUMENT_ID, ...PDF }),
    confirmation
  );

  const used = document({ status: "used", communicationId: COMMUNICATION_ID });
  assert.deepEqual(parseCommunicationDocumentListPayload({ documents: [used] }), { documents: [used] });
});

test("rejects malformed, duplicate, oversized and inconsistent list entries", () => {
  const invalid = [
    { documents: [document({ extra: "forbidden" })] },
    { documents: [document(), document()] },
    { documents: [document({ id: "not-a-uuid" })] },
    { documents: [document({ status: "clean" })] },
    { documents: [document({ communicationId: COMMUNICATION_ID })] },
    { documents: [document({ status: "used" })] },
    { documents: [document({ originalName: "../secret.pdf" })] },
    { documents: [document({ sizeBytes: 10 * 1024 * 1024 + 1 })] },
    { documents: [document({ updatedAt: "2026-08-31T07:59:00.000Z" })] },
    { documents: [document({ analysisError: "x".repeat(1_001) })] },
    { documents: [document({ status: "reserved" })] },
    { documents: Array.from({ length: 101 }, (_, index) => document({
      id: `${index.toString(16).padStart(8, "0")}-1111-4111-8111-111111111111`,
    })) },
    { documents: [], extra: true },
  ];
  for (const payload of invalid) assert.equal(parseCommunicationDocumentListPayload(payload), null);
});

test("rejects substituted signed upload coordinates before storage access", () => {
  const invalid = [
    reservation({ upload: { ...reservation().upload, bucket: "public" } }),
    reservation({ upload: { ...reservation().upload, path: "../secret.pdf" } }),
    reservation({ upload: { ...reservation().upload, path: `private/2026/13/${FILE_UUID}.pdf` } }),
    reservation({ upload: { ...reservation().upload, path: `private/2026/08/${FILE_UUID}.docx` } }),
    reservation({ upload: { ...reservation().upload, token: "short" } }),
    reservation({ upload: { ...reservation().upload, token: "header.payload.\nsecret" } }),
    reservation({ upload: { ...reservation().upload, token: "header.payload.signé-par-serveur" } }),
    reservation({ document: { ...reservation().document, originalName: "Substitution.pdf" } }),
    reservation({ document: { ...reservation().document, sizeBytes: PDF.sizeBytes + 1 } }),
    { ...reservation(), unexpected: true },
  ];
  for (const payload of invalid) {
    assert.equal(parseCommunicationDocumentReservationPayload(payload, PDF), null);
  }
});

test("requires the exact confirmed document before announcing quarantine", () => {
  const valid = { document: document(), duplicate: false };
  const invalid = [
    { ...valid, extra: true },
    { document: document({ id: COMMUNICATION_ID }), duplicate: false },
    { document: document({ uploadedAt: null }), duplicate: false },
    { document: document({ status: "reserved", uploadedAt: null }), duplicate: false },
    { document: document({ status: "processing" }), duplicate: false },
    { document: document({ originalName: "Autre.pdf" }), duplicate: false },
    { document: document(), duplicate: "false" },
  ];
  for (const payload of invalid) {
    assert.equal(
      parseCommunicationDocumentConfirmationPayload(payload, { id: DOCUMENT_ID, ...PDF }),
      null
    );
  }
  const duplicate = { document: document({ status: "processing" }), duplicate: true };
  assert.deepEqual(
    parseCommunicationDocumentConfirmationPayload(duplicate, { id: DOCUMENT_ID, ...PDF }),
    duplicate
  );
});

test("validates runtime payloads before storage and success side effects", async () => {
  const [page, serverShared] = await Promise.all([
    readFile(PAGE_PATH, "utf8"),
    readFile(SERVER_SHARED_PATH, "utf8"),
  ]);
  const listRead = page.indexOf('apiFetch<unknown>("communications/admin/documents")');
  const listValidation = page.indexOf("parseCommunicationDocumentListPayload(documentPayload)", listRead);
  const listState = page.indexOf("setDocuments(validatedDocuments.documents)", listValidation);
  assert.ok(listRead >= 0 && listValidation > listRead && listState > listValidation);

  const reservationRead = page.indexOf('apiFetch<unknown>("communications/admin/documents", {');
  const reservationValidation = page.indexOf(
    "parseCommunicationDocumentReservationPayload(reservationPayload, requestedDocument)",
    reservationRead
  );
  const storageAccess = page.indexOf(".from(reserve.upload.bucket)", reservationValidation);
  assert.ok(reservationRead >= 0 && reservationValidation > reservationRead && storageAccess > reservationValidation);

  const confirmationRead = page.indexOf("const confirmationPayload = await apiFetch<unknown>", storageAccess);
  const confirmationValidation = page.indexOf(
    "parseCommunicationDocumentConfirmationPayload(",
    confirmationRead
  );
  const successNotice = page.indexOf("setNotice(confirmation.duplicate", confirmationValidation);
  assert.ok(confirmationRead > storageAccess && confirmationValidation > confirmationRead && successNotice > confirmationValidation);
  assert.match(serverShared, /import \{ COMMUNICATION_DOCUMENT_BUCKET \} from "\.\.\/\.\.\/shared\/communication-document-payload\.js"/);
  assert.doesNotMatch(page, /apiFetch<\{\s*document:\s*CommunicationDocument/);
});
