import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import {
  hasCoherentSupportQueuePagination,
  hasUniqueSupportQueueRows,
  hasUniqueSupportQueueServices,
} from "../shared/support-queue-payload-policy.ts";

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
  assert.match(page, /function isNonNegativeInteger\(/);
  assert.match(page, /Object\.values\(value\.subjectContext\)\.every\(\(item\) => typeof item === "string"\)/);
  assert.match(page, /typeof value\.canViewAll === "boolean"/);
  assert.match(page, /typeof value\.canRoute === "boolean"/);
  assert.match(page, /typeof value\.canManageTemplates === "boolean"/);
});

test("validates before replacing the visible queue", () => {
  const validation = page.indexOf("if (!isAgentQueuePayload(payload))");
  const replacement = page.indexOf("setRequests(payload.requests)");
  assert.notEqual(validation, -1);
  assert.notEqual(replacement, -1);
  assert.ok(validation < replacement);
});
