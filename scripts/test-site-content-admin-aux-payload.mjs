import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  parseSiteContentAssetConfirmationPayload,
  parseSiteContentAssetListPayload,
  parseSiteContentAssetReservationPayload,
  parseSiteContentAssistPayload,
  parseSiteContentLegacyBatchPayload,
  parseSiteContentLegacyStatusPayload,
  parseSiteContentTemplateListPayload,
  parseSiteContentTemplateMutationPayload,
  projectSiteContentAssetConfirmationPayload,
  projectSiteContentAssetListPayload,
  projectSiteContentAssetReservationPayload,
  projectSiteContentAssistPayload,
  projectSiteContentLegacyBatchPayload,
  projectSiteContentLegacyStatusPayload,
  projectSiteContentTemplateListPayload,
  projectSiteContentTemplateMutationPayload,
} from "../shared/site-content-admin-aux-payload.ts";

const ASSET_ID = "11111111-1111-4111-8111-111111111111";
const TEMPLATE_ID = "22222222-2222-4222-8222-222222222222";
const ACTOR_ID = "33333333-3333-4333-8333-333333333333";
const OBJECT_ID = "44444444-4444-4444-8444-444444444444";
const ORIGIN = "https://school-project.supabase.co";
const TOKEN = "signed-upload-token-value-1234567890";
const PATH = `${ACTOR_ID}/2026/09/${OBJECT_ID}.pdf`;
const SIGNED_URL = `${ORIGIN}/storage/v1/object/sign/site-content/${PATH}?token=signed-download-token-value-1234567890`;

function assetInput(overrides = {}) {
  return {
    originalName: "document-fictif.pdf",
    mimeType: "application/pdf",
    sizeBytes: 12_345,
    title: "Document fictif",
    altText: null,
    ...overrides,
  };
}

function asset(status = "pending", overrides = {}) {
  return {
    id: ASSET_ID,
    ...assetInput(),
    assetKind: "document",
    status,
    importKey: null,
    ...overrides,
  };
}

function templateInput(overrides = {}) {
  return {
    id: "",
    slug: "actualite-simple",
    name: "Actualité simple",
    contentType: "article",
    description: "Modèle fictif",
    defaultTitle: "Titre proposé",
    defaultSummary: "Résumé proposé",
    defaultBodyMarkdown: "## Information\n\nTexte à compléter.",
    active: true,
    version: 0,
    ...overrides,
  };
}

function template(version = 1, overrides = {}) {
  return {
    ...templateInput({ id: TEMPLATE_ID }),
    version,
    ...overrides,
  };
}

function suggestion(overrides = {}) {
  return {
    suggestion: {
      title: "Information fictive",
      summary: "Résumé de démonstration.",
      bodyMarkdown: "## À retenir\n\nInformation entièrement fictive.",
      metaTitle: "Information fictive du lycée",
      metaDescription: "Une information de démonstration.",
      suggestedTitles: ["Information fictive", "Nouvelle fictive"],
      reviewNotes: ["Vérifier la date avant publication."],
      ...overrides,
    },
  };
}

test("binds a private upload reservation to the declared asset", () => {
  const payload = { asset: asset(), upload: { path: PATH, token: TOKEN } };
  assert.deepEqual(parseSiteContentAssetReservationPayload(payload, assetInput()), payload);
  assert.deepEqual(projectSiteContentAssetReservationPayload({
    asset: { ...asset(), storagePath: PATH, createdBy: ACTOR_ID },
    upload: { path: PATH, token: TOKEN, signedUrl: "internal" },
    expectedInput: assetInput(),
  }), payload);
});

test("rejects upload substitution, storage leaks and weak tokens", () => {
  const valid = { asset: asset(), upload: { path: PATH, token: TOKEN } };
  for (const payload of [
    { ...valid, actorId: ACTOR_ID },
    { ...valid, asset: { ...asset(), storagePath: PATH } },
    { ...valid, asset: asset("ready") },
    { ...valid, upload: { path: PATH.replace(".pdf", ".exe"), token: TOKEN } },
    { ...valid, upload: { path: PATH, token: "short" } },
  ]) assert.equal(parseSiteContentAssetReservationPayload(payload, assetInput()), null);
  assert.equal(
    parseSiteContentAssetReservationPayload(valid, assetInput({ sizeBytes: 99 })),
    null,
  );
});

test("accepts only the exact ready confirmation for the reserved asset", () => {
  const confirmed = { asset: asset("ready") };
  assert.deepEqual(parseSiteContentAssetConfirmationPayload(confirmed, asset()), confirmed);
  assert.deepEqual(projectSiteContentAssetConfirmationPayload(
    { ...asset("ready"), storagePath: PATH, createdBy: ACTOR_ID },
    { ...asset(), storagePath: PATH, createdBy: ACTOR_ID },
  ), confirmed);
  assert.equal(
    parseSiteContentAssetConfirmationPayload({ asset: asset("ready", { id: OBJECT_ID }) }, asset()),
    null,
  );
  assert.equal(
    parseSiteContentAssetConfirmationPayload({ asset: { ...asset("ready"), createdBy: ACTOR_ID } }, asset()),
    null,
  );
});

test("projects a bounded signed asset list without database coordinates", () => {
  const expected = { assets: [{ ...asset("ready"), signedUrl: SIGNED_URL }] };
  const projected = projectSiteContentAssetListPayload([{
    ...asset("ready"),
    signedUrl: SIGNED_URL,
    storageBucket: "site-content",
    storagePath: PATH,
    createdBy: ACTOR_ID,
  }], ORIGIN);
  assert.deepEqual(projected, expected);
  assert.deepEqual(parseSiteContentAssetListPayload(projected, ORIGIN), expected);
  assert.equal(parseSiteContentAssetListPayload({
    assets: [{ ...asset("ready"), signedUrl: SIGNED_URL.replace(ORIGIN, "https://other.supabase.co") }],
  }, ORIGIN), null);
});

test("binds template creation and optimistic update to their input", () => {
  const created = { template: template(1) };
  assert.deepEqual(
    parseSiteContentTemplateMutationPayload(created, templateInput(), "create"),
    created,
  );
  assert.deepEqual(projectSiteContentTemplateMutationPayload(
    { ...template(1), createdBy: ACTOR_ID },
    templateInput(),
    "create",
  ), created);

  const updateInput = templateInput({ id: TEMPLATE_ID, version: 1, name: "Actualité claire" });
  const updated = { template: template(2, { name: "Actualité claire" }) };
  assert.deepEqual(
    parseSiteContentTemplateMutationPayload(updated, updateInput, "update"),
    updated,
  );
  assert.equal(
    parseSiteContentTemplateMutationPayload(updated, { ...updateInput, version: 2 }, "update"),
    null,
  );
  assert.equal(
    parseSiteContentTemplateMutationPayload({ template: { ...updated.template, updatedBy: ACTOR_ID } }, updateInput, "update"),
    null,
  );
});

test("keeps template lists exact, bounded and unique", () => {
  const expected = { templates: [template()] };
  assert.deepEqual(projectSiteContentTemplateListPayload([{ ...template(), createdBy: ACTOR_ID }]), expected);
  assert.deepEqual(parseSiteContentTemplateListPayload(expected), expected);
  assert.equal(parseSiteContentTemplateListPayload({ templates: [template(), template()] }), null);
});

test("validates and bounds every editorial AI field", () => {
  assert.deepEqual(parseSiteContentAssistPayload(suggestion()), suggestion());
  assert.deepEqual(projectSiteContentAssistPayload(suggestion()), suggestion());
  for (const payload of [
    { ...suggestion(), model: "internal-model" },
    suggestion({ bodyMarkdown: "x".repeat(30_001) }),
    suggestion({ suggestedTitles: ["Même titre", "Même titre"] }),
    suggestion({ reviewNotes: ["mot de passe: secret123"] }),
  ]) assert.equal(parseSiteContentAssistPayload(payload), null);
});

test("returns only aggregated and coherent legacy import progress", () => {
  const expected = {
    phase: "media",
    nextOffset: 4,
    total: 10,
    done: false,
    successCount: 3,
    failureCount: 1,
  };
  assert.deepEqual(projectSiteContentLegacyBatchPayload({
    phase: "media",
    offset: 0,
    limit: 4,
    nextOffset: 4,
    total: 10,
    results: [{ ok: true, id: ASSET_ID }, { ok: false, error: "interne" }, { ok: true }, { ok: true }],
  }), expected);
  assert.deepEqual(
    parseSiteContentLegacyBatchPayload(expected, { phase: "media", offset: 0, limit: 4 }),
    expected,
  );
  for (const payload of [
    { ...expected, results: [{ error: "interne" }] },
    { ...expected, failureCount: 0 },
    { ...expected, nextOffset: 6 },
    { ...expected, done: true },
  ]) assert.equal(
    parseSiteContentLegacyBatchPayload(payload, { phase: "media", offset: 0, limit: 4 }),
    null,
  );
});

test("validates the fixed legacy inventory counters", () => {
  const payload = {
    source: "https://old-school.example.org",
    declared: { media: 81, accessibleMedia: 80, contents: 28 },
    imported: { media: 20, contents: 10 },
  };
  assert.deepEqual(parseSiteContentLegacyStatusPayload(payload), payload);
  assert.deepEqual(projectSiteContentLegacyStatusPayload(payload), payload);
  assert.equal(parseSiteContentLegacyStatusPayload({
    ...payload,
    imported: { media: 90, contents: 10 },
  }), null);
});

test("validates every auxiliary response before browser side effects", async () => {
  const page = await readFile(new URL("../src/pages/admin/ContentManagerPage.tsx", import.meta.url), "utf8");
  const assetsRoute = await readFile(new URL("../api/content/admin/assets.ts", import.meta.url), "utf8");
  const confirmRoute = await readFile(new URL("../api/content/admin/assets/[id]/confirm.ts", import.meta.url), "utf8");
  const templatesRoute = await readFile(new URL("../api/content/admin/templates.ts", import.meta.url), "utf8");
  const assistRoute = await readFile(new URL("../api/content/admin/assist.ts", import.meta.url), "utf8");
  const legacyRoute = await readFile(new URL("../api/content/admin/legacy-import.ts", import.meta.url), "utf8");
  const migration = await readFile(new URL("../supabase/migrations/20260901060000_fix_site_content_upload_audit_actions.sql", import.meta.url), "utf8");

  const reservationRead = page.indexOf('apiFetch<unknown>("content/admin/assets"');
  const reservationValidation = page.indexOf("parseSiteContentAssetReservationPayload", reservationRead);
  const upload = page.indexOf("uploadToSignedUrl", reservationValidation);
  const confirmationRead = page.indexOf("confirmationResponse", upload);
  const confirmationValidation = page.indexOf("parseSiteContentAssetConfirmationPayload", confirmationRead);
  const assetState = page.indexOf("setAssets", confirmationValidation);
  assert.ok(reservationRead >= 0 && reservationValidation > reservationRead && upload > reservationValidation);
  assert.ok(confirmationRead > upload && confirmationValidation > confirmationRead && assetState > confirmationValidation);

  const aiRead = page.indexOf('apiFetch<unknown>("content/admin/assist"');
  const aiValidation = page.indexOf("parseSiteContentAssistPayload", aiRead);
  const aiState = page.indexOf("setSuggestion(result.suggestion)", aiValidation);
  assert.ok(aiRead >= 0 && aiValidation > aiRead && aiState > aiValidation);

  const legacyRead = page.indexOf('apiFetch<unknown>("content/admin/legacy-import"');
  const legacyValidation = page.indexOf("parseSiteContentLegacyBatchPayload", legacyRead);
  const legacyProgress = page.indexOf("failures += batch.failureCount", legacyValidation);
  assert.ok(legacyRead >= 0 && legacyValidation > legacyRead && legacyProgress > legacyValidation);

  const templateRead = page.indexOf('apiFetch<unknown>("content/admin/templates"');
  const templateValidation = page.indexOf("parseSiteContentTemplateMutationPayload", templateRead);
  const templateState = page.indexOf("setCurrent(result.template)", templateValidation);
  assert.ok(templateRead >= 0 && templateValidation > templateRead && templateState > templateValidation);

  assert.match(assetsRoute, /projectSiteContentAssetListPayload/);
  assert.match(assetsRoute, /projectSiteContentAssetReservationPayload/);
  assert.match(confirmRoute, /projectSiteContentAssetConfirmationPayload/);
  assert.match(templatesRoute, /projectSiteContentTemplateListPayload/);
  assert.equal(templatesRoute.match(/projectSiteContentTemplateMutationPayload/g)?.length, 3);
  assert.match(templatesRoute, /expectedVersion !== current\.version/);
  assert.match(assistRoute, /projectSiteContentAssistPayload/);
  assert.match(legacyRoute, /projectSiteContentLegacyBatchPayload/);
  assert.match(legacyRoute, /projectSiteContentLegacyStatusPayload/);
  assert.match(legacyRoute, /count\(\)/);
  assert.doesNotMatch(legacyRoute, /return \{ phase: input\.phase, offset:/);
  for (const action of ["reserve_upload", "confirm_upload", "reject_upload"]) {
    assert.match(migration, new RegExp(`'${action}'`));
  }
});
