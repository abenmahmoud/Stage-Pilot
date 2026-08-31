import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  isSupportAgentAttachmentReservationInput,
  isSupportAgentCallbackCreateInput,
  isSupportAgentCallbackMutationInput,
  isSupportAgentInternalNoteInput,
  isSupportAgentTemplateInput,
  singleSupportAgentRouteValue,
} from "../shared/support-agent-mutation-input-policy.ts";

const source = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const requestRoute = source("../api/support/agent/requests/[code].ts");
const replyRoute = source("../api/support/agent/requests/[code]/reply.ts");
const translationRoute = source("../api/support/agent/requests/[code]/translate.ts");
const reservationRoute = source("../api/support/agent/requests/[code]/attachments.ts");
const noteRoute = source("../api/support/agent/requests/[code]/notes.ts");
const callbackRoute = source("../api/support/agent/requests/[code]/callbacks.ts");
const attachmentRoute = source("../api/support/agent/attachments/[id].ts");
const attachmentConfirmationRoute = source("../api/support/agent/attachments/[id]/confirm.ts");
const retryRoute = source("../api/support/agent/operations/[id]/retry.ts");
const approvalHelper = source("../api/_shared/agent-approvals.ts");
const metricsRoute = source("../api/support/agent/metrics.ts");
const approvalsRoute = source("../api/support/agent/approvals/index.ts");

const uuid = "123e4567-e89b-42d3-a456-426614174000";

test("accepts one route value and rejects missing, typed or repeated values", () => {
  assert.equal(singleSupportAgentRouteValue("BC-2026-000123"), "BC-2026-000123");
  assert.equal(singleSupportAgentRouteValue(undefined), null);
  assert.equal(singleSupportAgentRouteValue(["BC-2026-000123", "BC-2026-000124"]), null);
  assert.equal(singleSupportAgentRouteValue(42), null);
});

test("accepts only exact bounded shared templates", () => {
  assert.equal(isSupportAgentTemplateInput({ name: "Accueil", bodyText: "Bonjour" }), true);
  assert.equal(isSupportAgentTemplateInput({ name: "Accueil", bodyText: "Bonjour", category: "ent" }), true);
  for (const candidate of [
    { name: "Accueil", bodyText: "Bonjour", createdBy: uuid },
    { name: "Accueil" },
    { name: 42, bodyText: "Bonjour" },
    { name: "x".repeat(81), bodyText: "Bonjour" },
    { name: "Accueil", bodyText: "x".repeat(5_001) },
    { name: "Accueil", bodyText: "Bonjour", category: null },
  ]) {
    assert.equal(isSupportAgentTemplateInput(candidate), false);
  }
});

test("accepts only exact agent attachment reservations and notes", () => {
  const reservation = {
    fileName: "reponse.pdf",
    mimeType: "application/pdf",
    sizeBytes: 1_024,
  };
  assert.equal(isSupportAgentAttachmentReservationInput(reservation), true);
  for (const candidate of [
    { ...reservation, storagePath: "hidden" },
    { ...reservation, sizeBytes: "1024" },
    { ...reservation, sizeBytes: 10 * 1024 * 1024 + 1 },
    { mimeType: "application/pdf", sizeBytes: 1_024 },
  ]) {
    assert.equal(isSupportAgentAttachmentReservationInput(candidate), false);
  }
  assert.equal(isSupportAgentInternalNoteInput({ note: "À vérifier" }), true);
  assert.equal(isSupportAgentInternalNoteInput({ note: "À vérifier", public: true }), false);
  assert.equal(isSupportAgentInternalNoteInput({ note: 42 }), false);
  assert.equal(isSupportAgentInternalNoteInput({ note: "x".repeat(5_001) }), false);
});

test("accepts only action-specific callback fields", () => {
  assert.equal(isSupportAgentCallbackCreateInput({}), true);
  assert.equal(isSupportAgentCallbackCreateInput({ phoneContactId: uuid }), true);
  assert.equal(isSupportAgentCallbackCreateInput({ phoneContactId: uuid, assignedTo: uuid }), false);
  assert.equal(isSupportAgentCallbackCreateInput({ phoneContactId: [uuid] }), false);

  assert.equal(isSupportAgentCallbackMutationInput({ callbackId: uuid, action: "claim" }), true);
  assert.equal(isSupportAgentCallbackMutationInput({ callbackId: uuid, action: "complete", outcome: "Joint" }), true);
  assert.equal(isSupportAgentCallbackMutationInput({ callbackId: uuid, action: "cancel", outcome: "Annulé" }), true);
  for (const candidate of [
    { callbackId: uuid, action: "claim", outcome: "inutile" },
    { callbackId: uuid, action: "complete" },
    { callbackId: uuid, action: "complete", outcome: 42 },
    { callbackId: uuid, action: "complete", outcome: "x".repeat(1_001) },
    { callbackId: uuid, action: "delete", outcome: "non" },
    { callbackId: [uuid], action: "claim" },
  ]) {
    assert.equal(isSupportAgentCallbackMutationInput(candidate), false);
  }
});

test("mutation routes validate shared bodies before their first business query", () => {
  const checks = [
    [reservationRoute, "isSupportAgentAttachmentReservationInput(req.body)", "const [request] = await db"],
    [noteRoute, "isSupportAgentInternalNoteInput(req.body)", "const [request] = await db"],
    [callbackRoute, "isSupportAgentCallbackCreateInput(bodyInput)", "const [request] = await db"],
    [callbackRoute, "isSupportAgentCallbackMutationInput(bodyInput)", "const [request] = await db"],
    [source("../api/support/agent/templates.ts"), "isSupportAgentTemplateInput(req.body)", "await db"],
  ];
  for (const [route, validation, firstQuery] of checks) {
    const validationIndex = route.indexOf(validation);
    const queryIndex = route.indexOf(firstQuery, validationIndex);
    assert.ok(validationIndex !== -1 && queryIndex > validationIndex);
  }
});

test("agent dynamic routes and optional filters reject repeated values", () => {
  for (const route of [
    requestRoute,
    replyRoute,
    translationRoute,
    reservationRoute,
    noteRoute,
    callbackRoute,
    attachmentRoute,
    attachmentConfirmationRoute,
    retryRoute,
    approvalHelper,
  ]) {
    assert.match(route, /singleSupportAgentRouteValue\(req\.query\.(?:code|id)\)/);
    assert.doesNotMatch(route, /Array\.isArray\(req\.query\.(?:code|id)\)/);
  }
  assert.match(metricsRoute, /singleSupportAgentRouteValue\(req\.query\.days\)/);
  assert.match(approvalsRoute, /singleSupportAgentRouteValue\(req\.query\.view\)/);
});
