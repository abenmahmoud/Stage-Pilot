import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { isValidSupportAgentDetailPayload } from "../shared/support-agent-detail-payload-policy.ts";

const page = readFileSync(
  new URL("../src/pages/prototype/LyceeConnectPrototype.tsx", import.meta.url),
  "utf8"
);
const route = readFileSync(
  new URL("../api/support/agent/requests/[code].ts", import.meta.url),
  "utf8"
);

const phoneContactId = "123e4567-e89b-12d3-a456-426614174001";
const messageId = "123e4567-e89b-12d3-a456-426614174002";

const validDetail = {
  request: {
    publicCode: "BC-2026-000101",
    requesterType: "parent",
    requesterFirstName: "Nadia",
    requesterLastName: "Martin",
    beneficiaryType: "eleve",
    beneficiaryFirstName: "Samir",
    beneficiaryLastName: "Martin",
    subjectContext: {
      className: "2GT4",
      identityVerifiedBy: null,
    },
    category: "ent",
    subject: "Accès ENT",
    description: "Le compte ne permet plus de se connecter.",
    status: "en_cours",
    priority: "p3",
    assignedTo: "123e4567-e89b-12d3-a456-426614174003",
    assignedTeam: "referent_numerique",
    slaDueAt: "2026-08-31T12:00:00.000Z",
    createdAt: "2026-08-31T08:00:00.000Z",
    updatedAt: "2026-08-31T08:05:00.000Z",
    identityStatus: "contact_verifie",
    identityMethod: "email_magic_link",
    identityVerifiedAt: null,
  },
  contacts: [
    {
      id: phoneContactId,
      channel: "phone",
      value: "+33612345678",
      isPrimary: true,
      isVerified: true,
    },
    {
      id: "123e4567-e89b-12d3-a456-426614174004",
      channel: "email",
      value: "parent.fixture@example.invalid",
      isPrimary: false,
      isVerified: true,
    },
  ],
  messages: [
    {
      id: messageId,
      direction: "inbound",
      channel: "web",
      authorLabel: "Demandeur",
      bodyText: "Je souhaite retrouver mon accès.",
      deliveryStatus: "stored",
      createdAt: "2026-08-31T08:00:00.000Z",
    },
  ],
  attachments: [
    {
      id: "123e4567-e89b-12d3-a456-426614174005",
      messageId: null,
      direction: "requester",
      originalName: "capture-fictive.png",
      sizeBytes: 12_000,
      scanStatus: "clean",
      releasedAt: null,
      createdAt: "2026-08-31T08:01:00.000Z",
      canAttachToReply: false,
      canRemoveDraft: false,
    },
  ],
  callbacks: [
    {
      id: "123e4567-e89b-12d3-a456-426614174006",
      phoneContactId,
      dueAt: "2026-08-31T09:00:00.000Z",
      status: "todo",
      outcome: null,
      completedAt: null,
      createdAt: "2026-08-31T08:02:00.000Z",
      assigned: false,
      assignedToCurrentAgent: false,
    },
  ],
  duplicateReview: null,
  routingReview: {
    status: "pending",
    usedAi: true,
    initialCategory: "ent",
    initialService: "referent_numerique",
    createdAt: "2026-08-31T08:00:30.000Z",
    reviewedAt: null,
  },
  access: {
    role: "agent",
    label: "Agent référent numérique",
    serviceCodes: ["referent_numerique"],
    canViewAll: false,
    canRoute: false,
    canManageTemplates: false,
  },
};

test("accepts one complete bounded agent detail", () => {
  assert.equal(isValidSupportAgentDetailPayload(validDetail), true);
  assert.equal(isValidSupportAgentDetailPayload({
    ...validDetail,
    attachments: [{
      ...validDetail.attachments[0],
      direction: "agent",
      canAttachToReply: true,
      canRemoveDraft: true,
    }],
  }), true);
});

test("rejects hidden fields and oversized visible text", () => {
  assert.equal(isValidSupportAgentDetailPayload({
    ...validDetail,
    request: { ...validDetail.request, idempotencyKeyHash: "a".repeat(64) },
  }), false);
  assert.equal(isValidSupportAgentDetailPayload({
    ...validDetail,
    messages: [{ ...validDetail.messages[0], bodyText: "x".repeat(20_001) }],
  }), false);
  assert.equal(isValidSupportAgentDetailPayload({
    ...validDetail,
    contacts: [{ ...validDetail.contacts[0], value: "123" }],
  }), false);
});

test("rejects duplicated or dangling detail references", () => {
  assert.equal(isValidSupportAgentDetailPayload({
    ...validDetail,
    messages: [validDetail.messages[0], validDetail.messages[0]],
  }), false);
  assert.equal(isValidSupportAgentDetailPayload({
    ...validDetail,
    callbacks: [{ ...validDetail.callbacks[0], phoneContactId: "123e4567-e89b-12d3-a456-426614174099" }],
  }), false);
  assert.equal(isValidSupportAgentDetailPayload({
    ...validDetail,
    attachments: [{ ...validDetail.attachments[0], messageId: "123e4567-e89b-12d3-a456-426614174099" }],
  }), false);
});

test("rejects impossible identity, callback and attachment states", () => {
  assert.equal(isValidSupportAgentDetailPayload({
    ...validDetail,
    request: { ...validDetail.request, identityStatus: "identite_confirmee", identityMethod: "phone_callback" },
  }), false);
  assert.equal(isValidSupportAgentDetailPayload({
    ...validDetail,
    callbacks: [{ ...validDetail.callbacks[0], status: "done", outcome: null, completedAt: null }],
  }), false);
  assert.equal(isValidSupportAgentDetailPayload({
    ...validDetail,
    attachments: [{
      ...validDetail.attachments[0],
      direction: "agent",
      canAttachToReply: true,
      canRemoveDraft: false,
    }],
  }), false);
});

test("minimizes request and message rows before returning the detail", () => {
  const getSection = route.slice(route.indexOf("const [contacts, messages"));
  assert.doesNotMatch(getSection, /request:\s*\{\s*\.\.\.request/);
  assert.doesNotMatch(getSection, /\.select\(\)\s*\.from\(supportMessages\)/);
  assert.match(getSection, /id: supportMessages\.id,[\s\S]*bodyText: supportMessages\.bodyText,[\s\S]*createdAt: supportMessages\.createdAt/);
  assert.match(getSection, /request:\s*\{[\s\S]*publicCode: request\.publicCode,[\s\S]*identityStatus,/);
  for (const forbidden of [
    "idempotencyKeyHash: request.idempotencyKeyHash",
    "sourceIpHash: request.sourceIpHash",
    "clientIdempotencyKeyHash: supportMessages.clientIdempotencyKeyHash",
    "providerMessageId: supportMessages.providerMessageId",
  ]) {
    assert.equal(getSection.includes(forbidden), false, `${forbidden} must stay server-side`);
  }
});

test("validates every detail refresh before replacing state", () => {
  assert.match(page, /function isAgentRequestDetail\(value: unknown\): value is AgentRequestDetail \{\s*return isValidSupportAgentDetailPayload\(value\);/);
  assert.match(page, /async function fetchAgentRequestDetail\(code: string\)/);
  assert.match(page, /const payload = await apiFetch<unknown>\(`/);
  assert.match(page, /if \(!isAgentRequestDetail\(payload\)\)/);
  assert.doesNotMatch(page, /apiFetch<AgentRequestDetail>/);
});
