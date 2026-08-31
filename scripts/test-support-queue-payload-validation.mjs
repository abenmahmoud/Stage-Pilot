import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import {
  hasCoherentSupportQueuePagination,
  hasUniqueSupportQueueRows,
  hasUniqueSupportQueueServices,
  isKnownSupportQueueService,
  isValidSupportQueueAccess,
  isValidSupportQueueCoreRow,
  SUPPORT_QUEUE_SERVICES,
} from "../shared/support-queue-payload-policy.ts";
import { SUPPORT_SERVICES } from "../shared/support-agent-access.ts";

const page = readFileSync(new URL("../src/pages/prototype/LyceeConnectPrototype.tsx", import.meta.url), "utf8");

test("distinguishes queue rows from complete request details", () => {
  assert.match(page, /type AgentRequestCore = \{/);
  assert.match(page, /type AgentQueueRequest = AgentRequestCore & \{/);
  assert.match(page, /type AgentRequest = AgentRequestCore & \{/);
  assert.match(page, /useState<AgentQueueRequest\[]>\(\[]\)/);
});

test("validates every row and nested queue section", () => {
  assert.match(page, /value\.requests\.every\(isAgentQueueRequest\)/);
  assert.match(page, /isAgentQueueStats\(value\.stats\)/);
  assert.match(page, /value\.serviceStats\.every\(isAgentServiceStats\)/);
  assert.match(page, /isAgentQueuePagination\(value\.pagination\)/);
  assert.match(page, /isAgentAccess\(value\.access\)/);
  assert.match(page, /hasUniqueSupportQueueRows\(value\.requests\)/);
  assert.match(page, /hasUniqueSupportQueueServices\(value\.serviceStats\)/);
  assert.match(page, /hasCoherentSupportQueuePagination\(value\.requests\.length, value\.pagination\)/);
});

test("rejects duplicated request numbers and service aggregates", () => {
  assert.equal(hasUniqueSupportQueueRows([
    { publicCode: "BC-2026-000101" },
    { publicCode: "BC-2026-000102" },
  ]), true);
  assert.equal(hasUniqueSupportQueueRows([
    { publicCode: "BC-2026-000101" },
    { publicCode: "BC-2026-000101" },
  ]), false);
  assert.equal(hasUniqueSupportQueueServices([
    { service: null },
    { service: "administration" },
  ]), true);
  assert.equal(hasUniqueSupportQueueServices([
    { service: "vie_scolaire" },
    { service: "vie_scolaire" },
  ]), false);
});

test("accepts only pagination coherent with the visible rows", () => {
  assert.equal(hasCoherentSupportQueuePagination(30, {
    page: 1,
    pageSize: 30,
    total: 61,
    totalPages: 3,
  }), true);
  assert.equal(hasCoherentSupportQueuePagination(1, {
    page: 3,
    pageSize: 30,
    total: 61,
    totalPages: 3,
  }), true);
  assert.equal(hasCoherentSupportQueuePagination(0, {
    page: 1,
    pageSize: 30,
    total: 0,
    totalPages: 1,
  }), true);
  assert.equal(hasCoherentSupportQueuePagination(31, {
    page: 1,
    pageSize: 30,
    total: 31,
    totalPages: 2,
  }), false);
  assert.equal(hasCoherentSupportQueuePagination(1, {
    page: 3,
    pageSize: 30,
    total: 61,
    totalPages: 2,
  }), false);
  assert.equal(hasCoherentSupportQueuePagination(0, {
    page: 2,
    pageSize: 30,
    total: 31,
    totalPages: 2,
  }), false);
});

test("rejects malformed counters, access flags and subject context", () => {
  assert.match(page, /Number\.isSafeInteger\(value\)/);
  assert.match(page, /isValidSupportQueueCoreRow\(value\)/);
  assert.match(page, /isValidSupportQueueAccess\(value\)/);
  assert.match(page, /Number\(value\.urgent\) <= Number\(value\.open\)/);
});

const validQueueRow = {
  publicCode: "BC-2026-000101",
  requesterType: "parent",
  requesterFirstName: "Nadia",
  requesterLastName: "Martin",
  beneficiaryType: "eleve",
  beneficiaryFirstName: "Samir",
  beneficiaryLastName: "Martin",
  subjectContext: {
    className: "2GT4",
    internalSummaryFr: "Le responsable demande une aide de connexion.",
    identityVerifiedBy: null,
  },
  category: "ent",
  subject: "Accès ENT",
  status: "nouveau",
  priority: "p3",
  assignedTo: "123e4567-e89b-12d3-a456-426614174000",
  assignedTeam: "referent_numerique",
  slaDueAt: "2026-08-31T12:00:00.000Z",
  createdAt: "2026-08-31T08:00:00.000Z",
  updatedAt: "2026-08-31T08:05:00.000Z",
};

test("accepts a bounded queue row and keeps service enums synchronized", () => {
  assert.equal(isValidSupportQueueCoreRow(validQueueRow), true);
  assert.deepEqual(SUPPORT_QUEUE_SERVICES, SUPPORT_SERVICES);
  assert.equal(isKnownSupportQueueService(null), true);
  assert.equal(isKnownSupportQueueService("vie_scolaire"), true);
});

test("rejects unknown enums, malformed identifiers and oversized text", () => {
  assert.equal(isValidSupportQueueCoreRow({ ...validQueueRow, status: "invented" }), false);
  assert.equal(isValidSupportQueueCoreRow({ ...validQueueRow, priority: "p0" }), false);
  assert.equal(isValidSupportQueueCoreRow({ ...validQueueRow, assignedTeam: "external" }), false);
  assert.equal(isValidSupportQueueCoreRow({ ...validQueueRow, publicCode: "BC-26-101" }), false);
  assert.equal(isValidSupportQueueCoreRow({ ...validQueueRow, assignedTo: "not-a-uuid" }), false);
  assert.equal(isValidSupportQueueCoreRow({ ...validQueueRow, subject: "x".repeat(181) }), false);
  assert.equal(isValidSupportQueueCoreRow({
    ...validQueueRow,
    subjectContext: { internalSummaryFr: "x".repeat(701) },
  }), false);
});

test("rejects malformed or over-broad access payloads", () => {
  const access = {
    role: "agent",
    label: "Agent vie scolaire",
    serviceCodes: ["vie_scolaire"],
    canViewAll: false,
    canRoute: false,
    canManageTemplates: false,
  };
  assert.equal(isValidSupportQueueAccess(access), true);
  assert.equal(isValidSupportQueueAccess({ ...access, role: "root" }), false);
  assert.equal(isValidSupportQueueAccess({ ...access, serviceCodes: ["vie_scolaire", "vie_scolaire"] }), false);
  assert.equal(isValidSupportQueueAccess({ ...access, serviceCodes: ["external"] }), false);
});

test("validates before replacing the visible queue", () => {
  const validation = page.indexOf("if (!isAgentQueuePayload(payload))");
  const replacement = page.indexOf("setRequests(payload.requests)");
  assert.notEqual(validation, -1);
  assert.notEqual(replacement, -1);
  assert.ok(validation < replacement);
});
