import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  parseCommunicationApprovalPayload,
  parseCommunicationAssistPayload,
  parseCommunicationDetailPayload,
  parseCommunicationDraftMutationPayload,
  parseCommunicationPublicationPayload,
  parseCommunicationRetryPayload,
  parseCommunicationReviewPayload,
  parseCommunicationTemplateMutationPayload,
} from "../shared/communication-admin-action-payload.ts";

const PAGE_PATH = new URL("../src/pages/admin/CommunicationsPage.tsx", import.meta.url);
const TEMPLATE_ROUTE_PATH = new URL("../api/communications/admin/templates.ts", import.meta.url);
const COMMUNICATION_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_ID = "22222222-2222-4222-8222-222222222222";
const VERSION_ID = "33333333-3333-4333-8333-333333333333";
const OLDER_VERSION_ID = "44444444-4444-4444-8444-444444444444";
const TEMPLATE_ID = "55555555-5555-4555-8555-555555555555";
const NEWER = "2026-08-31T14:00:00.000Z";
const OLDER = "2026-08-31T13:00:00.000Z";

function communication(overrides = {}) {
  return {
    id: COMMUNICATION_ID,
    status: "draft",
    visibility: "internal",
    category: "information",
    templateKey: null,
    publicSlug: null,
    currentVersion: 2,
    publishedAt: null,
    updatedAt: NEWER,
    title: "Information fictive",
    summary: "Résumé fictif sans donnée personnelle.",
    bodyMarkdown: "Contenu fictif à relire.",
    structuredFacts: { dates: [], times: [], places: [], documents: [], actions: [] },
    openQuestions: [],
    ...overrides,
  };
}

function version(overrides = {}) {
  return {
    id: VERSION_ID,
    version: 2,
    status: "draft",
    createdAt: OLDER,
    updatedAt: NEWER,
    ...overrides,
  };
}

function mutationSummary(overrides = {}) {
  return {
    id: COMMUNICATION_ID,
    status: "draft",
    visibility: "internal",
    currentVersion: 2,
    updatedAt: NEWER,
    ...overrides,
  };
}

function assistInput() {
  return {
    action: "correct",
    title: "Information fictive",
    summary: "Résumé fictif.",
    bodyMarkdown: "Texte fictif à corriger.",
    category: "information",
    templateKey: null,
  };
}

function assistSuggestion(overrides = {}) {
  return {
    title: "Information fictive corrigée",
    summary: "Résumé fictif corrigé.",
    bodyMarkdown: "Texte fictif corrigé.",
    structuredFacts: { dates: [], times: [], places: [], documents: [], actions: [] },
    openQuestions: [],
    reviewNotes: ["Orthographe corrigée."],
    ...overrides,
  };
}

test("validates a complete detail and its exact descending history", () => {
  const payload = {
    communication: communication(),
    versions: [
      version(),
      version({ id: OLDER_VERSION_ID, version: 1, createdAt: OLDER, updatedAt: OLDER }),
    ],
  };
  assert.deepEqual(parseCommunicationDetailPayload(payload, COMMUNICATION_ID), payload);

  const invalid = [
    { ...payload, extra: true },
    { ...payload, communication: communication({ id: OTHER_ID }) },
    { ...payload, communication: communication({ bodyMarkdown: "mot de passe: Azerty123!" }) },
    { ...payload, versions: [version()] },
    { ...payload, versions: [version({ version: 1 }), version({ id: OLDER_VERSION_ID, version: 2 })] },
    { ...payload, versions: [version(), version()] },
    { ...payload, versions: [version({ status: "approved" }), version({ id: OLDER_VERSION_ID, version: 1 })] },
  ];
  for (const candidate of invalid) {
    assert.equal(parseCommunicationDetailPayload(candidate, COMMUNICATION_ID), null);
  }
});

test("accepts only the documented create and update response variants", () => {
  const create = {
    communication: mutationSummary({ currentVersion: 1 }),
    version: { id: VERSION_ID, version: 1 },
    duplicate: false,
  };
  const createDuplicate = {
    communication: mutationSummary({ status: "review", visibility: "public" }),
    duplicate: true,
  };
  const update = {
    communication: mutationSummary(),
    version: version(),
    duplicate: false,
  };
  const updateDuplicate = {
    communication: mutationSummary(),
    version: { id: VERSION_ID, version: 2, status: "draft" },
    duplicate: true,
  };
  assert.deepEqual(parseCommunicationDraftMutationPayload(create, null), create);
  assert.deepEqual(parseCommunicationDraftMutationPayload(createDuplicate, null), createDuplicate);
  assert.deepEqual(parseCommunicationDraftMutationPayload(update, COMMUNICATION_ID), update);
  assert.deepEqual(parseCommunicationDraftMutationPayload(updateDuplicate, COMMUNICATION_ID), updateDuplicate);

  for (const candidate of [
    { communication: mutationSummary({ currentVersion: 1 }), duplicate: false },
    { ...create, communication: mutationSummary({ id: OTHER_ID, currentVersion: 1 }) },
    { ...update, communication: mutationSummary({ status: "approved" }) },
    { ...update, version: version({ version: 1 }) },
    { ...updateDuplicate, extra: true },
  ]) assert.equal(parseCommunicationDraftMutationPayload(candidate, COMMUNICATION_ID), null);
});

test("binds review, approval and publication to the expected communication", () => {
  const review = {
    communication: mutationSummary({ status: "review", visibility: "public" }),
    version: version({ status: "review" }),
    duplicate: false,
  };
  const approval = {
    communication: { ...mutationSummary({ status: "approved", visibility: "public" }), approvedAt: NEWER },
    version: { id: VERSION_ID, version: 2, status: "approved", approvedAt: NEWER },
    duplicate: false,
  };
  const publication = {
    communication: {
      id: COMMUNICATION_ID,
      status: "published",
      visibility: "public",
      publicSlug: "information-fictive-11111111",
      publishedAt: NEWER,
    },
    duplicate: false,
  };
  assert.deepEqual(parseCommunicationReviewPayload(review, COMMUNICATION_ID, "public"), review);
  assert.deepEqual(parseCommunicationApprovalPayload(approval, COMMUNICATION_ID), approval);
  assert.deepEqual(parseCommunicationPublicationPayload(publication, COMMUNICATION_ID), publication);

  const duplicateReview = {
    communication: mutationSummary({ status: "review", visibility: "internal" }),
    duplicate: true,
  };
  const duplicateApproval = {
    communication: { ...mutationSummary({ status: "approved" }), approvedAt: NEWER },
    duplicate: true,
  };
  assert.deepEqual(parseCommunicationReviewPayload(duplicateReview, COMMUNICATION_ID, "internal"), duplicateReview);
  assert.deepEqual(parseCommunicationApprovalPayload(duplicateApproval, COMMUNICATION_ID), duplicateApproval);

  assert.equal(parseCommunicationReviewPayload(review, OTHER_ID, "public"), null);
  assert.equal(parseCommunicationReviewPayload(review, COMMUNICATION_ID, "internal"), null);
  assert.equal(parseCommunicationApprovalPayload({
    ...approval,
    version: { ...approval.version, approvedAt: OLDER },
  }, COMMUNICATION_ID), null);
  assert.equal(parseCommunicationPublicationPayload({
    ...publication,
    communication: { ...publication.communication, id: OTHER_ID },
  }, COMMUNICATION_ID), null);
  assert.equal(parseCommunicationPublicationPayload({
    ...publication,
    communication: { ...publication.communication, publicSlug: "../faux" },
  }, COMMUNICATION_ID), null);
});

test("validates assistance, template persistence and manual retry acknowledgements", () => {
  const request = assistInput();
  const suggestion = assistSuggestion();
  assert.deepEqual(parseCommunicationAssistPayload({ suggestion }, request), { suggestion });
  assert.equal(parseCommunicationAssistPayload({ suggestion: assistSuggestion({ title: "clé API: sk-1234567890abcdefghijkl" }) }, request), null);
  assert.equal(parseCommunicationAssistPayload({ suggestion, extra: true }, request), null);

  const templateInput = {
    templateKey: "hebdo",
    label: "Hebdo personnalisé",
    defaultCategory: "information",
    titleHint: "Informations de la semaine",
    summaryHint: "Résumé fictif.",
    bodyMarkdown: "## Informations\n\nContenu fictif.",
    active: true,
  };
  const templatePayload = {
    template: {
      id: TEMPLATE_ID,
      ...templateInput,
      version: 3,
      updatedAt: NEWER,
      customized: true,
    },
  };
  assert.deepEqual(parseCommunicationTemplateMutationPayload(templatePayload, templateInput), templatePayload);
  assert.equal(parseCommunicationTemplateMutationPayload({
    template: { ...templatePayload.template, label: "Réponse substituée" },
  }, templateInput), null);
  assert.equal(parseCommunicationTemplateMutationPayload({
    template: { ...templatePayload.template, institutionId: OTHER_ID },
  }, templateInput), null);

  const createdRetry = { allowed: true, reason: "manual_retry_allowed", created: true, duplicate: false };
  const duplicateRetry = { allowed: true, reason: "manual_retry_allowed", created: false, duplicate: true };
  assert.deepEqual(parseCommunicationRetryPayload(createdRetry), createdRetry);
  assert.deepEqual(parseCommunicationRetryPayload(duplicateRetry), duplicateRetry);
  for (const invalid of [
    { ...createdRetry, allowed: false },
    { ...createdRetry, created: true, duplicate: true },
    { ...createdRetry, reason: "role_forbidden" },
    { ...createdRetry, jobId: OTHER_ID },
  ]) assert.equal(parseCommunicationRetryPayload(invalid), null);
});

test("validates every action before a success side effect and minimizes the template response", async () => {
  const [page, templateRoute] = await Promise.all([
    readFile(PAGE_PATH, "utf8"),
    readFile(TEMPLATE_ROUTE_PATH, "utf8"),
  ]);
  const checks = [
    ["parseCommunicationDetailPayload(response, selectedId)", "setSelectedDetail(payload.communication)"],
    ["parseCommunicationRetryPayload(response)", "setConfirmingRetryId(null)"],
    ["parseCommunicationAssistPayload(response, requestInput)", "setDraft((current)"],
    ["parseCommunicationReviewPayload(response, selectedDetail.id, reviewVisibility)", "setNotice(\"La communication est transmise"],
    ["parseCommunicationApprovalPayload(response, selectedDetail.id)", "setNotice(selectedDetail.visibility"],
    ["parseCommunicationPublicationPayload(response, selectedDetail.id)", "setNotice(\"La communication est publiée"],
    ["parseCommunicationTemplateMutationPayload(response, templateInput)", "setEditingTemplate(null)"],
    ["parseCommunicationDraftMutationPayload(response, editingId)", "setNotice("],
  ];
  for (const [validation, sideEffect] of checks) {
    const validationIndex = page.indexOf(validation);
    const sideEffectIndex = page.indexOf(sideEffect, validationIndex);
    assert.ok(validationIndex >= 0 && sideEffectIndex > validationIndex, `${validation} must precede ${sideEffect}`);
  }
  assert.doesNotMatch(page, /apiFetch<\{\s*communication:|apiFetch<CreatePayload>|apiFetch<\{\s*suggestion:/);
  assert.match(page, /apiFetch<unknown>\(`communications\/admin\/\$\{selectedId\}`\)/);
  assert.doesNotMatch(templateRoute, /\.returning\(\);/);
  assert.match(templateRoute, /return \{ template: \{ \.\.\.result, customized: true \} \}/);
  for (const forbidden of ["institutionId:", "createdBy:", "updatedBy:"]) {
    const returningStart = templateRoute.indexOf(".returning({");
    const returningEnd = templateRoute.indexOf("});", returningStart);
    assert.doesNotMatch(templateRoute.slice(returningStart, returningEnd), new RegExp(forbidden));
  }
});
