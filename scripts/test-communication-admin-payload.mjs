import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  parseCommunicationFailuresPayload,
  parseCommunicationInboundPayload,
  parseCommunicationsPayload,
  parseCommunicationTemplatesPayload,
} from "../shared/communication-admin-payload.ts";
import { COMMUNICATION_TEMPLATE_CATALOG } from "../shared/communication-templates.ts";

const PAGE_PATH = new URL("../src/pages/admin/CommunicationsPage.tsx", import.meta.url);
const COMMUNICATION_ID = "11111111-1111-4111-8111-111111111111";
const SECOND_ID = "22222222-2222-4222-8222-222222222222";
const TEMPLATE_ID = "33333333-3333-4333-8333-333333333333";
const INBOUND_ID = "44444444-4444-4444-8444-444444444444";
const FAILURE_ID = "55555555-5555-4555-8555-555555555555";
const NEWER = "2026-08-31T10:00:00.000Z";
const OLDER = "2026-08-31T09:00:00.000Z";

function communication(overrides = {}) {
  return {
    id: COMMUNICATION_ID,
    status: "draft",
    visibility: "internal",
    category: "information",
    templateKey: null,
    publicSlug: null,
    currentVersion: 1,
    publishedAt: null,
    updatedAt: NEWER,
    title: "Information fictive",
    summary: "Résumé fictif sans donnée personnelle.",
    structuredFacts: { dates: [], times: [], places: [], documents: [], actions: [] },
    openQuestions: [],
    ...overrides,
  };
}

function templateCatalog() {
  return COMMUNICATION_TEMPLATE_CATALOG.map((template) => ({
    ...template,
    id: null,
    version: 0,
    updatedAt: null,
    customized: false,
  }));
}

function failure(overrides = {}) {
  return {
    id: FAILURE_ID,
    jobType: "send_delivery",
    attemptCount: 3,
    failureCode: "provider_timeout",
    failedAt: NEWER,
    title: "Envoi fictif à reprendre",
    version: 2,
    ...overrides,
  };
}

function inbound(overrides = {}) {
  return {
    id: INBOUND_ID,
    communicationId: null,
    status: "received",
    classification: null,
    receivedAt: NEWER,
    title: null,
    ...overrides,
  };
}

test("accepts complete bounded payloads from the four initial endpoints", () => {
  const published = communication({
    id: SECOND_ID,
    status: "published",
    visibility: "public",
    publicSlug: "information-fictive",
    publishedAt: OLDER,
    updatedAt: OLDER,
  });
  assert.deepEqual(
    parseCommunicationsPayload({ communications: [communication(), published] }),
    { communications: [communication(), published] }
  );

  const templates = templateCatalog();
  assert.deepEqual(parseCommunicationTemplatesPayload({ templates }), { templates });
  assert.deepEqual(parseCommunicationFailuresPayload({ failures: [failure()] }), { failures: [failure()] });
  assert.deepEqual(parseCommunicationInboundPayload({ inbound: [inbound()] }), { inbound: [inbound()] });
});

test("rejects malformed, duplicated, secret-bearing and incoherent communications", () => {
  const invalid = [
    { communications: [communication({ extra: true })] },
    { communications: [communication(), communication()] },
    { communications: [communication({ status: "sent" })] },
    { communications: [communication({ visibility: "targeted", publicSlug: "forbidden-slug" })] },
    { communications: [communication({ status: "published", visibility: "public" })] },
    { communications: [communication({ category: "Information" })] },
    { communications: [communication({ templateKey: "unknown" })] },
    { communications: [communication({ structuredFacts: { dates: [] } })] },
    { communications: [communication({ title: "mot de passe: Azerty123!" })] },
    { communications: [
      communication({ updatedAt: OLDER }),
      communication({ id: SECOND_ID, updatedAt: NEWER }),
    ] },
    { communications: [], extra: true },
    { communications: Array.from({ length: 101 }, () => communication()) },
  ];
  for (const payload of invalid) assert.equal(parseCommunicationsPayload(payload), null);
});

test("locks the six official fallbacks and validates every customization", () => {
  const customized = templateCatalog();
  customized[0] = {
    ...customized[0],
    id: TEMPLATE_ID,
    label: "Hebdo personnalisé",
    version: 2,
    updatedAt: NEWER,
    customized: true,
  };
  assert.deepEqual(parseCommunicationTemplatesPayload({ templates: customized }), { templates: customized });

  const alteredFallback = templateCatalog();
  alteredFallback[0] = { ...alteredFallback[0], label: "Faux modèle" };
  const duplicate = templateCatalog();
  duplicate[1] = { ...duplicate[1], templateKey: duplicate[0].templateKey };
  const badCustomization = templateCatalog();
  badCustomization[0] = { ...badCustomization[0], customized: true, id: "bad", version: 1, updatedAt: NEWER };
  const secret = templateCatalog();
  secret[0] = { ...secret[0], bodyMarkdown: "mot de passe: Azerty123!" };
  for (const payload of [
    { templates: templateCatalog().slice(0, 5) },
    { templates: alteredFallback },
    { templates: duplicate },
    { templates: badCustomization },
    { templates: secret },
    { templates: templateCatalog(), extra: true },
  ]) assert.equal(parseCommunicationTemplatesPayload(payload), null);
});

test("rejects unsafe failure and inbound inbox rows", () => {
  for (const payload of [
    { failures: [failure({ jobType: "publish" })] },
    { failures: [failure({ attemptCount: 21 })] },
    { failures: [failure({ id: "bad" })] },
    { failures: [failure({ title: "clé API: sk-1234567890abcdefghijkl" })] },
    { failures: [failure({ failedAt: OLDER }), failure({ id: SECOND_ID, failedAt: NEWER })] },
    { failures: [failure(), failure()] },
  ]) assert.equal(parseCommunicationFailuresPayload(payload), null);

  const linked = inbound({
    communicationId: COMMUNICATION_ID,
    classification: "question",
    title: "Réponse fictive",
  });
  assert.deepEqual(parseCommunicationInboundPayload({ inbound: [linked] }), { inbound: [linked] });
  for (const payload of [
    { inbound: [inbound({ status: "processed" })] },
    { inbound: [inbound({ classification: "automatic_action" })] },
    { inbound: [inbound({ communicationId: COMMUNICATION_ID })] },
    { inbound: [inbound({ title: "Réponse sans rattachement" })] },
    { inbound: [linked, linked] },
    { inbound: [inbound({ receivedAt: OLDER }), inbound({ id: SECOND_ID, receivedAt: NEWER })] },
    { inbound: [inbound({ communicationId: COMMUNICATION_ID, title: "mot de passe: Azerty123!" })] },
  ]) assert.equal(parseCommunicationInboundPayload(payload), null);
});

test("validates every endpoint before replacing any communication state", async () => {
  const page = await readFile(PAGE_PATH, "utf8");
  for (const endpoint of [
    "communications/admin",
    "communications/admin/templates",
    "communications/admin/failures",
    "communications/admin/inbound",
  ]) assert.match(page, new RegExp(`apiFetch<unknown>\\(\"${endpoint.replaceAll("/", "\\/")}\"`));

  const firstValidation = page.indexOf("const communicationPayload = parseCommunicationsPayload(communicationResponse)");
  const templateValidation = page.indexOf("parseCommunicationTemplatesPayload(templateResponse)", firstValidation);
  const failureValidation = page.indexOf("parseCommunicationFailuresPayload(failureResponse)", templateValidation);
  const inboundValidation = page.indexOf("parseCommunicationInboundPayload(inboundResponse)", failureValidation);
  const guard = page.indexOf("if (!communicationPayload || !templatePayload || !documentPayload || !failurePayload || !inboundPayload)", inboundValidation);
  const firstState = page.indexOf("setRows(communicationPayload.communications)", guard);
  assert.ok(firstValidation >= 0 && templateValidation > firstValidation && failureValidation > templateValidation);
  assert.ok(inboundValidation > failureValidation && guard > inboundValidation && firstState > guard);
  assert.match(page, /Aucun résultat n’a été remplacé/);
  assert.doesNotMatch(page, /apiFetch<CommunicationsPayload>|apiFetch<\{ templates: CommunicationTemplate\[\] \}>/);
});
