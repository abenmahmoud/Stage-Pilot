import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import "./test-legacy-editorial-apply-action.mjs";
import {
  SITE_CONTENT_ADMIN_PAYLOAD_LIMITS,
  parseSiteContentAdminDetailPayload,
  parseSiteContentAdminListPayload,
  parseSiteContentAdminMutationPayload,
  projectSiteContentAdminDetailPayload,
  projectSiteContentAdminListPayload,
  projectSiteContentAdminMutationPayload,
} from "../shared/site-content-admin-payload.ts";

const ITEM_ID = "11111111-1111-4111-8111-111111111111";
const COPY_ID = "22222222-2222-4222-8222-222222222222";
const TEMPLATE_ID = "33333333-3333-4333-8333-333333333333";
const ASSET_ID = "44444444-4444-4444-8444-444444444444";
const VERSION_ID = "55555555-5555-4555-8555-555555555555";
const ACTOR_ID = "66666666-6666-4666-8666-666666666666";
const ORIGIN = "https://school-project.supabase.co";
const NOW = "2026-09-01T08:00:00.000Z";
const SIGNED_URL = `${ORIGIN}/storage/v1/object/sign/site-content/${ACTOR_ID}/2026/09/${ASSET_ID}.pdf?token=signed-token-value-1234567890`;

function summary(overrides = {}) {
  return {
    id: ITEM_ID,
    contentType: "article",
    title: "Rentrée fictive",
    category: "Vie du lycée",
    status: "brouillon",
    version: 2,
    needsReview: false,
    sourceSystem: null,
    updatedAt: NOW,
    ...overrides,
  };
}

function template(overrides = {}) {
  return {
    id: TEMPLATE_ID,
    slug: "actualite-simple",
    name: "Actualité simple",
    contentType: "article",
    description: "Modèle fictif",
    defaultTitle: "",
    defaultSummary: "",
    defaultBodyMarkdown: "## Information",
    active: true,
    version: 1,
    ...overrides,
  };
}

function asset(overrides = {}) {
  return {
    id: ASSET_ID,
    originalName: "document-fictif.pdf",
    mimeType: "application/pdf",
    sizeBytes: 12_345,
    assetKind: "document",
    title: "Document fictif",
    altText: null,
    status: "ready",
    importKey: null,
    ...overrides,
  };
}

function list(overrides = {}) {
  return { items: [summary()], templates: [template()], assets: [asset()], ...overrides };
}

function detailItem(overrides = {}) {
  return {
    id: ITEM_ID,
    contentType: "article",
    slug: "rentree-fictive",
    title: "Rentrée fictive",
    summary: "Information de démonstration.",
    bodyMarkdown: "## Bienvenue\n\nDonnées entièrement fictives.",
    category: "Vie du lycée",
    audience: "tous",
    status: "brouillon",
    templateId: TEMPLATE_ID,
    featured: false,
    metaTitle: null,
    metaDescription: null,
    publishAt: null,
    expiresAt: null,
    sourceSystem: null,
    sourceUrl: null,
    sourceUpdatedAt: null,
    sourceDisposition: null,
    needsReview: false,
    importedAt: null,
    reviewedAt: null,
    ...overrides,
  };
}

function linkedAsset(overrides = {}) {
  return {
    ...asset(),
    assetRole: "document",
    publicLabel: "Télécharger le document fictif",
    position: 0,
    url: SIGNED_URL,
    ...overrides,
  };
}

function version(overrides = {}) {
  return { id: VERSION_ID, version: 2, createdAt: NOW, ...overrides };
}

function detail(overrides = {}) {
  return { item: detailItem(), assets: [linkedAsset()], versions: [version()], ...overrides };
}

test("accepts exact bounded list and detail payloads", () => {
  assert.deepEqual(parseSiteContentAdminListPayload(list()), list());
  assert.deepEqual(
    parseSiteContentAdminDetailPayload(detail(), { itemId: ITEM_ID, configuredOrigin: ORIGIN }),
    detail(),
  );
});

test("rejects internal fields, duplicate rows and oversized collections", () => {
  for (const payload of [
    { ...list(), actorId: ACTOR_ID },
    list({ items: [{ ...summary(), createdBy: ACTOR_ID }] }),
    list({ assets: [{ ...asset(), storagePath: `${ACTOR_ID}/secret.pdf` }] }),
    list({ items: [summary(), summary()] }),
    list({ templates: [template(), template({ id: COPY_ID })] }),
    list({ assets: Array.from({ length: SITE_CONTENT_ADMIN_PAYLOAD_LIMITS.assets + 1 }, () => asset()) }),
  ]) assert.equal(parseSiteContentAdminListPayload(payload), null);
});

test("rejects foreign signed URLs, wrong item binding and version disorder", () => {
  for (const payload of [
    detail({ item: { ...detailItem(), approvedBy: ACTOR_ID } }),
    detail({ item: detailItem({ id: COPY_ID }) }),
    detail({ assets: [linkedAsset({ url: SIGNED_URL.replace(ORIGIN, "https://other.supabase.co") })] }),
    detail({ assets: [linkedAsset({ storagePath: `${ACTOR_ID}/2026/09/${ASSET_ID}.pdf` })] }),
    detail({ versions: [version({ version: 1 }), version({ id: COPY_ID, version: 2 })] }),
  ]) assert.equal(
    parseSiteContentAdminDetailPayload(payload, { itemId: ITEM_ID, configuredOrigin: ORIGIN }),
    null,
  );
});

test("server projections strip database actors and storage paths", () => {
  const projectedList = projectSiteContentAdminListPayload({
    items: [{ ...summary(), createdBy: ACTOR_ID, approvedBy: ACTOR_ID, updatedAt: new Date(NOW) }],
    templates: [{ ...template(), createdBy: ACTOR_ID }],
    assets: [{ ...asset(), storageBucket: "site-content", storagePath: "private/path", createdBy: ACTOR_ID }],
  });
  assert.deepEqual(projectedList, list());

  const projectedDetail = projectSiteContentAdminDetailPayload({
    item: { ...detailItem(), createdBy: ACTOR_ID, updatedBy: ACTOR_ID },
    assets: [{ ...linkedAsset(), storagePath: "private/path", createdBy: ACTOR_ID }],
    versions: [{ ...version(), createdBy: ACTOR_ID, createdAt: new Date(NOW) }],
  }, ORIGIN);
  assert.deepEqual(projectedDetail, detail());
});

test("binds every mutation receipt to its action and target", () => {
  const matrix = [
    ["create", { id: COPY_ID, status: "brouillon", version: 1, needsReview: false }, undefined],
    ["update", { id: ITEM_ID, status: "brouillon", version: 3, needsReview: false }, ITEM_ID],
    ["submit_review", { id: ITEM_ID, status: "a_valider", version: 3, needsReview: false }, ITEM_ID],
    ["publish", { id: ITEM_ID, status: "publie", version: 3, needsReview: false }, ITEM_ID],
    ["archive", { id: ITEM_ID, status: "archive", version: 3, needsReview: false }, ITEM_ID],
    ["duplicate", { id: COPY_ID, status: "brouillon", version: 1, needsReview: false }, ITEM_ID],
    ["restore", { id: ITEM_ID, status: "brouillon", version: 4, needsReview: true }, ITEM_ID],
    ["verify_source", { id: ITEM_ID, status: "brouillon", version: 3, needsReview: false }, ITEM_ID],
    ["apply_editorial_corrections", { id: ITEM_ID, status: "brouillon", version: 4, needsReview: true }, ITEM_ID],
  ];
  for (const [action, item, expectedItemId] of matrix) {
    const payload = projectSiteContentAdminMutationPayload(
      { ...item, createdBy: ACTOR_ID, bodyMarkdown: "interne" },
      action,
      expectedItemId,
    );
    assert.deepEqual(
      parseSiteContentAdminMutationPayload(payload, { action, itemId: expectedItemId }),
      payload,
    );
    assert.equal(Object.hasOwn(payload, "createdBy"), false);
  }
});

test("rejects confused or leaked mutation receipts", () => {
  const valid = projectSiteContentAdminMutationPayload(
    { id: ITEM_ID, status: "publie", version: 3, needsReview: false },
    "publish",
    ITEM_ID,
  );
  for (const payload of [
    { ...valid, action: "archive" },
    { ...valid, itemId: COPY_ID },
    { ...valid, status: "brouillon" },
    { ...valid, approvedBy: ACTOR_ID },
  ]) assert.equal(
    parseSiteContentAdminMutationPayload(payload, { action: "publish", itemId: ITEM_ID }),
    null,
  );
});

test("validates server replies before replacing editor state", async () => {
  const page = await readFile(new URL("../src/pages/admin/ContentManagerPage.tsx", import.meta.url), "utf8");
  const indexRoute = await readFile(new URL("../api/content/admin/index.ts", import.meta.url), "utf8");
  const detailRoute = await readFile(new URL("../api/content/admin/[id].ts", import.meta.url), "utf8");
  const actionRoute = await readFile(new URL("../api/content/admin/[id]/action.ts", import.meta.url), "utf8");

  const listRead = page.indexOf('apiFetch<unknown>("content/admin")');
  const listValidation = page.indexOf("parseSiteContentAdminListPayload(response)", listRead);
  const listState = page.indexOf("setItems(data.items)", listValidation);
  const detailRead = page.indexOf("apiFetch<unknown>(`content/admin/${id}`)");
  const detailValidation = page.indexOf("parseSiteContentAdminDetailPayload(response", detailRead);
  const detailState = page.indexOf("setDraft(nextDraft)", detailValidation);
  assert.ok(listRead >= 0 && listValidation > listRead && listState > listValidation);
  assert.ok(detailRead >= 0 && detailValidation > detailRead && detailState > detailValidation);
  assert.match(indexRoute, /projectSiteContentAdminListPayload/);
  assert.match(indexRoute, /projectSiteContentAdminMutationPayload\(item, "create"\)/);
  assert.match(detailRoute, /projectSiteContentAdminDetailPayload/);
  assert.match(detailRoute, /projectSiteContentAdminMutationPayload\(item, "update", id\)/);
  assert.equal(actionRoute.match(/projectSiteContentAdminMutationPayload\(item, action, id\)/g)?.length, 7);
  assert.match(detailRoute, /limit\(SITE_CONTENT_ADMIN_PAYLOAD_LIMITS\.linkedAssets\)/);
  assert.match(detailRoute, /limit\(SITE_CONTENT_ADMIN_PAYLOAD_LIMITS\.versions\)/);
  assert.doesNotMatch(page, /apiFetch<\{ item: Item/);
});
