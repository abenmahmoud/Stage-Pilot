import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  SCHEDULE_IMPORT_BUCKET,
  parseScheduleImportListPayload,
  parseScheduleImportMutationPayload,
  parseScheduleImportReservationPayload,
  parseSchedulePageListPayload,
  parseSchedulePageMutationPayload,
  parseSchedulePrivateFilePayload,
  projectScheduleImportPayload,
  projectSchedulePageMappingPayload,
  projectSchedulePageSourcePayload,
} from "../shared/schedule-admin-payload.ts";

const SOURCE_ID = "11111111-1111-4111-8111-111111111111";
const PAGE_ID = "22222222-2222-4222-8222-222222222222";
const INSTITUTION_ID = "33333333-3333-4333-8333-333333333333";
const ACTOR_ID = "44444444-4444-4444-8444-444444444444";
const FILE_ID = "55555555-5555-4555-8555-555555555555";
const CREATED_AT = "2026-09-01T05:00:00.000Z";
const UPLOADED_AT = "2026-09-01T05:01:00.000Z";
const FRESH_UNTIL = "2026-09-08T23:59:59.999Z";
const SUPABASE_ORIGIN = "https://preview-ref.supabase.co";

const input = {
  sourceKind: "classes",
  schoolYear: "2026-2027",
  title: "Emplois du temps fictifs",
  purposeDescription: "Recette fictive strictement limitée à la preview isolée.",
  effectiveFrom: "2026-09-01",
  effectiveUntil: "2027-06-30",
  freshUntil: "2026-09-08",
  originalName: "emplois-fictifs.pdf",
  mimeType: "application/pdf",
  sizeBytes: 12_345,
};

function scheduleImport(overrides = {}) {
  return {
    id: SOURCE_ID,
    sourceKind: input.sourceKind,
    schoolYear: input.schoolYear,
    version: 1,
    title: input.title,
    purposeDescription: input.purposeDescription,
    effectiveFrom: input.effectiveFrom,
    effectiveUntil: input.effectiveUntil,
    freshUntil: FRESH_UNTIL,
    originalName: input.originalName,
    sizeBytes: input.sizeBytes,
    pageCount: null,
    status: "reserved",
    uploadedAt: null,
    createdAt: CREATED_AT,
    ...overrides,
  };
}

function mapping(overrides = {}) {
  return {
    id: PAGE_ID,
    pageNumber: 1,
    subjectType: "class",
    subjectRef: "2GT-TEST",
    reviewStatus: "draft",
    reviewedAt: null,
    ...overrides,
  };
}

test("accepts only one bounded and ordered import list", () => {
  const later = scheduleImport();
  const earlier = scheduleImport({
    id: "66666666-6666-4666-8666-666666666666",
    version: 2,
    createdAt: "2026-09-01T04:00:00.000Z",
  });
  assert.deepEqual(parseScheduleImportListPayload({ imports: [later, earlier] }), {
    imports: [later, earlier],
  });
  for (const payload of [
    { imports: [later, later] },
    { imports: [earlier, later] },
    { imports: [scheduleImport({ storagePath: "private.pdf" })] },
    { imports: [scheduleImport({ status: "active" })] },
    { imports: [scheduleImport({ freshUntil: "2027-07-01T00:00:00.000Z" })] },
    { imports: [scheduleImport({ originalName: "../secret.pdf" })] },
    { imports: [scheduleImport({ sizeBytes: 60 * 1024 * 1024 })] },
    { imports: [], hidden: true },
  ]) assert.equal(parseScheduleImportListPayload(payload), null);
});

test("binds a signed reservation to the exact requested PDF", () => {
  const reservation = {
    import: scheduleImport(),
    upload: {
      bucket: SCHEDULE_IMPORT_BUCKET,
      path: `${INSTITUTION_ID}/2026-2027/classes/${ACTOR_ID}/${FILE_ID}.pdf`,
      token: "header.payload.signature-with-safe-ascii",
    },
  };
  assert.deepEqual(parseScheduleImportReservationPayload(reservation, input), reservation);
  for (const payload of [
    { ...reservation, hidden: true },
    { ...reservation, import: scheduleImport({ title: "Titre substitué" }) },
    { ...reservation, upload: { ...reservation.upload, bucket: "public" } },
    { ...reservation, upload: { ...reservation.upload, path: "../secret.pdf" } },
    { ...reservation, upload: { ...reservation.upload, path: `${INSTITUTION_ID}/2026-2027/teachers/${ACTOR_ID}/${FILE_ID}.pdf` } },
    { ...reservation, upload: { ...reservation.upload, token: "short" } },
  ]) assert.equal(parseScheduleImportReservationPayload(payload, input), null);
});

test("requires exact state transitions before a success is visible", () => {
  const quarantined = scheduleImport({ status: "quarantined", uploadedAt: UPLOADED_AT });
  assert.deepEqual(
    parseScheduleImportMutationPayload(
      { import: quarantined, duplicate: false },
      { id: SOURCE_ID, freshStatus: "quarantined", duplicateStatuses: ["quarantined", "processing"] }
    ),
    { import: quarantined, duplicate: false }
  );
  const processing = scheduleImport({ status: "processing", uploadedAt: UPLOADED_AT });
  assert.deepEqual(
    parseScheduleImportMutationPayload(
      { import: processing, duplicate: true },
      { id: SOURCE_ID, freshStatus: "quarantined", duplicateStatuses: ["quarantined", "processing"] }
    ),
    { import: processing, duplicate: true }
  );
  assert.equal(
    parseScheduleImportMutationPayload(
      { import: processing, duplicate: false },
      { id: SOURCE_ID, freshStatus: "quarantined", duplicateStatuses: ["quarantined", "processing"] }
    ),
    null
  );
});

test("validates the page source, ordering and exact mutation", () => {
  const source = {
    id: SOURCE_ID,
    sourceKind: "classes",
    title: input.title,
    pageCount: 2,
    status: "review",
  };
  const pageOne = mapping();
  const pageTwo = mapping({
    id: "77777777-7777-4777-8777-777777777777",
    pageNumber: 2,
    subjectRef: "2GT-TEST-2",
    reviewStatus: "verified",
    reviewedAt: "2026-09-01T05:02:00.000Z",
  });
  assert.deepEqual(parseSchedulePageListPayload({ source, pages: [pageOne, pageTwo] }, SOURCE_ID), {
    source,
    pages: [pageOne, pageTwo],
  });
  assert.equal(parseSchedulePageListPayload({ source, pages: [pageTwo, pageOne] }, SOURCE_ID), null);
  assert.equal(parseSchedulePageListPayload({ source: { ...source, status: "approved" }, pages: [pageOne] }, SOURCE_ID), null);
  assert.equal(parseSchedulePageListPayload({ source: { ...source, pageCount: null }, pages: [pageOne] }, SOURCE_ID), null);
  assert.equal(parseSchedulePageListPayload({ source, pages: [pageOne, { ...pageTwo, subjectRef: pageOne.subjectRef }] }, SOURCE_ID), null);
  assert.equal(parseSchedulePageListPayload({ source: { ...source, sourceKind: "teachers" }, pages: [pageOne] }, SOURCE_ID), null);
  assert.deepEqual(
    parseSchedulePageMutationPayload({ mapping: pageOne }, {
      pageNumber: 1,
      subjectType: "class",
      subjectRef: "2GT-TEST",
      reviewStatus: "draft",
    }),
    { mapping: pageOne }
  );
  assert.equal(
    parseSchedulePageMutationPayload({ mapping: { ...pageOne, subjectRef: "SUBSTITUTED" } }, {
      pageNumber: 1,
      subjectType: "class",
      subjectRef: "2GT-TEST",
      reviewStatus: "draft",
    }),
    null
  );
});

test("accepts only a short signed URL from the configured private bucket", () => {
  const token = "header.payload.signature-with-safe-ascii";
  const valid = {
    url: `${SUPABASE_ORIGIN}/storage/v1/object/sign/${SCHEDULE_IMPORT_BUCKET}/private.pdf?token=${token}`,
    expiresInSeconds: 60,
  };
  assert.deepEqual(parseSchedulePrivateFilePayload(valid, SUPABASE_ORIGIN), valid);
  for (const payload of [
    { ...valid, expiresInSeconds: 600 },
    { ...valid, hidden: true },
    { ...valid, url: `https://evil.example/storage/v1/object/sign/${SCHEDULE_IMPORT_BUCKET}/private.pdf?token=${token}` },
    { ...valid, url: `${SUPABASE_ORIGIN}/storage/v1/object/sign/public/private.pdf?token=${token}` },
    { ...valid, url: `${valid.url}&token=second.payload.signature-safe` },
    { ...valid, url: `${valid.url}#page=1` },
  ]) assert.equal(parseSchedulePrivateFilePayload(payload, SUPABASE_ORIGIN), null);
});

test("server projections remove storage and actor fields", () => {
  const projected = projectScheduleImportPayload({
    ...scheduleImport(),
    storageBucket: SCHEDULE_IMPORT_BUCKET,
    storagePath: "secret/private.pdf",
    checksum: "a".repeat(64),
    uploadedBy: ACTOR_ID,
    validationSummary: { private: true },
  });
  assert.deepEqual(projected, scheduleImport());
  assert.deepEqual(projectSchedulePageMappingPayload({
    ...mapping(),
    institutionId: INSTITUTION_ID,
    sourceVersionId: SOURCE_ID,
    reviewedBy: null,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
  }), mapping());
  assert.deepEqual(projectSchedulePageSourcePayload({
    id: SOURCE_ID,
    sourceKind: "classes",
    title: input.title,
    pageCount: 2,
    status: "review",
    storagePath: "secret/private.pdf",
    validationSummary: { private: true },
  }), {
    id: SOURCE_ID,
    sourceKind: "classes",
    title: input.title,
    pageCount: 2,
    status: "review",
  });
});

test("validates every browser response before storage or visible success", async () => {
  const page = await readFile(new URL("../src/pages/admin/ScheduleImportPage.tsx", import.meta.url), "utf8");
  const routes = await Promise.all([
    "../api/schedule/admin/imports/index.ts",
    "../api/schedule/admin/imports/[id]/confirm.ts",
    "../api/schedule/admin/imports/[id]/approve.ts",
    "../api/schedule/admin/imports/[id]/activate.ts",
    "../api/schedule/admin/imports/[id]/rollback.ts",
    "../api/schedule/admin/imports/[id]/pages/index.ts",
    "../api/schedule/admin/imports/[id]/pages/[pageId]/verify.ts",
  ].map((path) => readFile(new URL(path, import.meta.url), "utf8")));

  const listRead = page.indexOf('apiFetch<unknown>("schedule/admin/imports")');
  const listValidation = page.indexOf("parseScheduleImportListPayload(response)", listRead);
  const listState = page.indexOf("setImports(result.imports)", listValidation);
  assert.ok(listRead >= 0 && listValidation > listRead && listState > listValidation);

  const reservationRead = page.indexOf('apiFetch<unknown>("schedule/admin/imports", {');
  const reservationValidation = page.indexOf("parseScheduleImportReservationPayload", reservationRead);
  const storageAccess = page.indexOf("uploadPrivateFile", reservationValidation);
  assert.ok(reservationRead >= 0 && reservationValidation > reservationRead && storageAccess > reservationValidation);

  const fileRead = page.indexOf("const response = await apiFetch<unknown>(`schedule/admin/imports/${selectedImportId}/file`)");
  const fileValidation = page.indexOf("parseSchedulePrivateFilePayload", fileRead);
  const popupNavigation = page.indexOf("popup.location.href", fileValidation);
  assert.ok(fileRead >= 0 && fileValidation > fileRead && popupNavigation > fileValidation);

  const promotionRead = page.indexOf("const response = await apiFetch<unknown>(`schedule/admin/imports/${target.id}/${action}`");
  const promotionValidation = page.indexOf("parseScheduleImportMutationPayload", promotionRead);
  const successNotice = page.indexOf("setNotice(", promotionValidation);
  assert.ok(promotionRead >= 0 && promotionValidation > promotionRead && successNotice > promotionValidation);

  for (const route of routes.slice(0, 5)) assert.match(route, /projectScheduleImportPayload/);
  for (const route of routes.slice(5)) assert.match(route, /projectSchedulePage(?:Mapping|Source)Payload/);
  assert.doesNotMatch(routes[0], /validationSummary:\s*scheduleSourceVersions\.validationSummary/);
  assert.doesNotMatch(page, /apiFetch<\{\s*imports:\s*ScheduleImport/);
});
