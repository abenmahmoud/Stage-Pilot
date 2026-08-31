import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  isIdentityDirectoryActionPayload,
  isIdentityDirectoryListPayload,
  isIdentityDirectoryReportPayload,
  isIdentityDirectoryReservationPayload,
} from "../shared/identity-directory-admin-payload-policy.ts";
import { parseIdentityDirectoryDecisionInput } from "../shared/identity-directory-admin-input.ts";
import { parseIdentityDirectoryInput } from "../shared/identity-directory-input.ts";

const importId = "11111111-1111-4111-8111-111111111111";
const secondId = "22222222-2222-4222-8222-222222222222";
const institutionId = "33333333-3333-4333-8333-333333333333";
const actorId = "44444444-4444-4444-8444-444444444444";
const fileId = "55555555-5555-4555-8555-555555555555";
const justification = "Validation humaine documentée pour ce répertoire fictif.";

const listItem = {
  id: importId,
  title: "Répertoire fictif de rentrée",
  purposeDescription: "Jeu fictif destiné aux tests de vérification d’identité.",
  originalName: "repertoire-fictif.csv",
  sizeBytes: 42_000,
  status: "review",
  rowCount: 1,
  validRowCount: 1,
  rejectedRowCount: 0,
  createdAt: "2026-09-01T08:00:00.000Z",
};

const action = {
  import: {
    id: importId,
    status: "approved",
    updatedAt: "2026-09-01T08:05:00.000Z",
  },
  duplicate: false,
};

const row = {
  id: 1,
  sourceSheet: "Identites",
  rowNumber: 2,
  recordType: "person",
  personRef: "TEST-STUDENT-001",
  personType: "student",
  subjectPersonRef: null,
  relationshipType: null,
  objectRef: null,
  classRef: "2GT-TEST",
  serviceCode: null,
  validFrom: "2026-09-01",
  validUntil: null,
  validationStatus: "valid",
  issues: [],
};

const report = {
  import: {
    id: importId,
    status: "review",
    rowCount: 1,
    validRowCount: 1,
    rejectedRowCount: 0,
    validationSummary: { warningRowCount: 0, issueCounts: {} },
  },
  rows: [row],
  pagination: { page: 1, pageSize: 100, total: 1 },
};

test("accepts one exact, bounded and descending import list", () => {
  assert.equal(isIdentityDirectoryListPayload({
    imports: [listItem, {
      ...listItem,
      id: secondId,
      status: "retired",
      createdAt: "2026-08-31T08:00:00.000Z",
    }],
  }), true);
});

test("rejects list leaks, duplicates, bad counts and bad ordering", () => {
  assert.equal(isIdentityDirectoryListPayload({ imports: [listItem], cursor: "hidden" }), false);
  assert.equal(isIdentityDirectoryListPayload({
    imports: [{ ...listItem, storagePath: "hidden" }],
  }), false);
  assert.equal(isIdentityDirectoryListPayload({ imports: [listItem, listItem] }), false);
  assert.equal(isIdentityDirectoryListPayload({
    imports: [listItem, { ...listItem, id: secondId, createdAt: "2026-09-02T08:00:00.000Z" }],
  }), false);
  assert.equal(isIdentityDirectoryListPayload({ imports: [{ ...listItem, validRowCount: 2 }] }), false);
  assert.equal(isIdentityDirectoryListPayload({
    imports: Array.from({ length: 101 }, (_, index) => ({
      ...listItem,
      id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    })),
  }), false);
});

test("accepts only an exact private upload reservation", () => {
  const reservation = {
    import: { ...action.import, status: "reserved" },
    upload: {
      bucket: "identity-ingest",
      path: `${institutionId}/${actorId}/2026/09/${fileId}.csv`,
      token: "a".repeat(32),
    },
  };
  assert.equal(isIdentityDirectoryReservationPayload(reservation), true);
  assert.equal(isIdentityDirectoryReservationPayload({ ...reservation, storageKey: "hidden" }), false);
  assert.equal(isIdentityDirectoryReservationPayload({
    ...reservation,
    upload: { ...reservation.upload, path: `${institutionId}/../secret.csv` },
  }), false);
  assert.equal(isIdentityDirectoryReservationPayload({
    ...reservation,
    upload: { ...reservation.upload, token: "short" },
  }), false);
});

test("accepts only the expected action acknowledgement", () => {
  assert.equal(isIdentityDirectoryActionPayload(action, importId, ["approved"]), true);
  assert.equal(isIdentityDirectoryActionPayload(action, secondId, ["approved"]), false);
  assert.equal(isIdentityDirectoryActionPayload(action, importId, ["active"]), false);
  assert.equal(isIdentityDirectoryActionPayload({ ...action, actorId: "hidden" }, importId, ["approved"]), false);
  assert.equal(isIdentityDirectoryActionPayload({
    ...action,
    import: { ...action.import, updatedAt: "2026-02-30T08:05:00.000Z" },
  }, importId, ["approved"]), false);
});

test("accepts one exact redacted report", () => {
  assert.equal(isIdentityDirectoryReportPayload(report, importId, 1), true);
});

test("rejects report leaks, malformed rows and incoherent pagination", () => {
  assert.equal(isIdentityDirectoryReportPayload({ ...report, checksum: "hidden" }, importId, 1), false);
  assert.equal(isIdentityDirectoryReportPayload({
    ...report,
    import: { ...report.import, validationSummary: { ...report.import.validationSummary, personCount: 1 } },
  }, importId, 1), false);
  assert.equal(isIdentityDirectoryReportPayload({
    ...report,
    rows: [{ ...row, personalEmail: "hidden@example.test" }],
  }, importId, 1), false);
  assert.equal(isIdentityDirectoryReportPayload({
    ...report,
    rows: [{ ...row, issues: [{ severity: "error", code: "unknown_code", column: "person_ref" }] }],
  }, importId, 1), false);
  assert.equal(isIdentityDirectoryReportPayload({
    ...report,
    pagination: { page: 1, pageSize: 50, total: 1 },
  }, importId, 1), false);
  assert.equal(isIdentityDirectoryReportPayload({ ...report, rows: [] }, importId, 1), false);
  assert.equal(isIdentityDirectoryReportPayload({
    ...report,
    rows: [row, row],
    import: { ...report.import, rowCount: 2, validRowCount: 2 },
    pagination: { page: 1, pageSize: 100, total: 2 },
  }, importId, 1), false);
});

test("requires exact decision and reservation command fields", () => {
  assert.deepEqual(parseIdentityDirectoryDecisionInput({ justification }, "approve"), { justification });
  assert.deepEqual(parseIdentityDirectoryDecisionInput({ confirmation: "ACTIVER", justification }, "activate"), { justification });
  assert.deepEqual(parseIdentityDirectoryDecisionInput({ confirmation: "RETIRER", justification }, "retire"), { justification });
  assert.throws(
    () => parseIdentityDirectoryDecisionInput({ confirmation: "ACTIVER", justification, actorId: "hidden" }, "activate"),
    /décision est invalide/
  );
  assert.throws(
    () => parseIdentityDirectoryDecisionInput({ confirmation: "activer", justification }, "activate"),
    /confirmation/
  );
  assert.throws(
    () => parseIdentityDirectoryInput({
      title: "Test",
      purposeDescription: "Import fictif strictement réservé aux tests.",
      sourceType: "csv",
      originalName: "test.csv",
      mimeType: "text/csv",
      sizeBytes: 100,
      institutionId: "hidden",
    }),
    /données sont invalides/
  );
});

test("validates every browser response before state, upload or success", () => {
  const page = readFileSync(new URL("../src/pages/admin/IdentityDirectoryPage.tsx", import.meta.url), "utf8");
  const reportPage = readFileSync(new URL("../src/pages/admin/IdentityDirectoryReport.tsx", import.meta.url), "utf8");

  const listRead = page.indexOf('apiFetch<unknown>("identity/admin/imports")');
  const listCheck = page.indexOf("isIdentityDirectoryListPayload(result)", listRead);
  const listWrite = page.indexOf("setImports(result.imports)", listCheck);
  assert.ok(listRead !== -1 && listRead < listCheck && listCheck < listWrite);

  const reservationRead = page.indexOf('apiFetch<unknown>("identity/admin/imports", {');
  const reservationCheck = page.indexOf("isIdentityDirectoryReservationPayload(reservation)", reservationRead);
  const upload = page.indexOf("uploadPrivateFile(uploadFile", reservationCheck);
  assert.ok(reservationRead !== -1 && reservationRead < reservationCheck && reservationCheck < upload);

  const confirmationRead = page.indexOf("const confirmation = await apiFetch<unknown>");
  const confirmationCheck = page.indexOf("isIdentityDirectoryActionPayload(", confirmationRead);
  const success = page.indexOf("setNotice(", confirmationCheck);
  assert.ok(confirmationRead !== -1 && confirmationRead < confirmationCheck && confirmationCheck < success);

  assert.match(reportPage, /const loadId = \+\+loadIdRef\.current/);
  assert.match(reportPage, /isIdentityDirectoryReportPayload\(result, importId, nextPage\)/);
  assert.match(reportPage, /if \(loadId !== loadIdRef\.current\) return;/);
  assert.equal(reportPage.match(/const result = await apiFetch<unknown>/g)?.length, 4);
  assert.equal(reportPage.match(/isIdentityDirectoryActionPayload\(result, importId/g)?.length, 3);
});

test("projects and validates minimal server payloads", () => {
  const paths = [
    "../api/identity/admin/imports/index.ts",
    "../api/identity/admin/imports/[id]/confirm.ts",
    "../api/identity/admin/imports/[id]/report.ts",
    "../api/identity/admin/imports/[id]/approve.ts",
    "../api/identity/admin/imports/[id]/activate.ts",
    "../api/identity/admin/imports/[id]/retire.ts",
  ];
  const sources = paths.map((path) => readFileSync(new URL(path, import.meta.url), "utf8"));
  for (const source of sources) assert.match(source, /isIdentityDirectory(?:List|Reservation|Action|Report)Payload/);
  assert.match(sources[2], /Array\.isArray\(value\)/);
  assert.match(sources[2], /parsed > 250/);
  assert.match(sources[2], /page > maximumPage/);
  const view = readFileSync(new URL("../api/_shared/identity-directory-view.ts", import.meta.url), "utf8");
  assert.match(view, /identityDirectoryListView/);
  assert.match(view, /identityDirectoryActionView/);
  assert.match(view, /identityDirectoryReportImportView/);
  assert.doesNotMatch(view, /storagePath:/);
  assert.doesNotMatch(view, /storageBucket:/);
  assert.doesNotMatch(view, /checksum:/);
});
