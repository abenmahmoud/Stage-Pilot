import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  AGENT_APPROVAL_ITEM_LIMIT,
  isAgentApprovalDecisionPayload,
  isAgentApprovalsPayload,
} from "../shared/agent-approval-payload-policy.ts";

const APPROVAL_ID = "11111111-1111-4111-8111-111111111111";
const ACTION_ID = "22222222-2222-4222-8222-222222222222";
const generatedAt = "2026-09-01T08:00:00.000Z";

const item = {
  id: APPROVAL_ID,
  serviceCode: "referent_numerique",
  serviceLabel: "Référent numérique",
  toolLabel: "Envoyer une réponse",
  skillName: "Référent numérique",
  skillVersion: "1.0.0",
  status: "pending",
  requestedFromRole: "Responsable de service",
  requestedAt: "2026-09-01T07:00:00.000Z",
  decidedAt: null,
  expiresAt: "2026-09-01T09:00:00.000Z",
  decisionReason: null,
  requestedByMe: false,
  canDecide: true,
  details: [{ label: "Dossier", value: "BC-TEST-0001" }],
};

const payload = {
  generatedAt,
  reviewer: {
    role: "Responsable de service",
    services: [{ code: "referent_numerique", label: "Référent numérique" }],
    canViewAll: false,
  },
  summary: { pending: 1, actionable: 1, decided: 0, expired: 0 },
  items: [item],
  truncated: false,
};

test("accepts one exact coherent approval inbox", () => {
  assert.equal(isAgentApprovalsPayload(payload), true);
  assert.equal(AGENT_APPROVAL_ITEM_LIMIT, 200);
});

test("rejects hidden fields, duplicates and incoherent reviewer scope", () => {
  assert.equal(isAgentApprovalsPayload({ ...payload, institutionId: ACTION_ID }), false);
  assert.equal(isAgentApprovalsPayload({ ...payload, items: [{ ...item, inputRedacted: {} }] }), false);
  assert.equal(isAgentApprovalsPayload({ ...payload, items: [item, item] }), false);
  assert.equal(isAgentApprovalsPayload({
    ...payload,
    reviewer: {
      ...payload.reviewer,
      services: [{ code: "referent_numerique", label: "Vie scolaire" }],
    },
  }), false);
  assert.equal(isAgentApprovalsPayload({
    ...payload,
    reviewer: {
      ...payload.reviewer,
      services: [{ code: "vie_scolaire", label: "Vie scolaire" }],
    },
  }), false);
});

test("rejects invalid dates, details and decision semantics", () => {
  assert.equal(isAgentApprovalsPayload({
    ...payload,
    generatedAt: "2026-09-01T08:00:00Z",
  }), false);
  assert.equal(isAgentApprovalsPayload({
    ...payload,
    items: [{ ...item, requestedByMe: true }],
  }), false);
  assert.equal(isAgentApprovalsPayload({
    ...payload,
    items: [{ ...item, details: [item.details[0], item.details[0]] }],
  }), false);
  assert.equal(isAgentApprovalsPayload({
    ...payload,
    summary: { ...payload.summary, pending: 0 },
  }), false);
  assert.equal(isAgentApprovalsPayload({
    ...payload,
    items: [{ ...item, status: "approved" }],
  }), false);
  assert.equal(isAgentApprovalsPayload({
    ...payload,
    items: [{ ...item, status: "rejected", decidedAt: "2026-09-01T07:30:00.000Z" }],
  }), false);
});

test("binds a decision confirmation to the expected approval and status", () => {
  const decision = {
    approvalId: APPROVAL_ID,
    status: "approved",
    decidedAt: "2026-09-01T08:01:00.000Z",
  };
  assert.equal(isAgentApprovalDecisionPayload(decision, {
    approvalId: APPROVAL_ID,
    status: "approved",
  }), true);
  assert.equal(isAgentApprovalDecisionPayload({ ...decision, actionId: ACTION_ID }, {
    approvalId: APPROVAL_ID,
    status: "approved",
  }), false);
  assert.equal(isAgentApprovalDecisionPayload(decision, {
    approvalId: ACTION_ID,
    status: "approved",
  }), false);
  assert.equal(isAgentApprovalDecisionPayload(decision, {
    approvalId: APPROVAL_ID,
    status: "rejected",
  }), false);
});

test("validates server responses before returning them", async () => {
  const [listRoute, decisionRoute] = await Promise.all([
    readFile("api/support/agent/approvals/index.ts", "utf8"),
    readFile("api/support/agent/approvals/[id]/decision.ts", "utf8"),
  ]);
  assert.match(listRoute, /\.limit\(AGENT_APPROVAL_ITEM_LIMIT \+ 1\)/);
  assert.match(listRoute, /rows\.slice\(0, AGENT_APPROVAL_ITEM_LIMIT\)/);
  assert.match(listRoute, /return approvalsPayload\(\{/);
  assert.match(decisionRoute, /return decisionPayload\(\{/);
  assert.doesNotMatch(decisionRoute, /actionId: decision\.result_action_id/);
});

test("validates browser payloads before state or success changes", async () => {
  const page = await readFile("src/pages/admin/AgentApprovalsPage.tsx", "utf8");
  const listValidation = page.indexOf("isAgentApprovalsPayload(next)");
  const stateChange = page.indexOf("setPayload(next)", listValidation);
  const decisionValidation = page.indexOf("isAgentApprovalDecisionPayload(confirmation");
  const successNotice = page.indexOf("setNotice(", decisionValidation);
  assert.ok(listValidation >= 0 && stateChange > listValidation);
  assert.ok(decisionValidation >= 0 && successNotice > decisionValidation);
  assert.match(page, /apiFetch<unknown>\(`support\/agent\/approvals/);
});
