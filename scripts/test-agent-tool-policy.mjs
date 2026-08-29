import assert from "node:assert/strict";
import test from "node:test";
import {
  authorizeAgentToolInvocation,
  verifyAgentToolConfirmation,
} from "../shared/agent-tool-policy.ts";

const NOW = "2026-08-30T09:00:00.000Z";
const ACTION_ID = "action:000123";
const INPUT_FINGERPRINT = "a".repeat(64);

function actor(overrides = {}) {
  return {
    userId: "user-agent-1",
    institutionId: "lycee-blaise-cendrars",
    identityLevel: "I3",
    role: "staff",
    serviceCodes: ["referent_numerique"],
    relationshipConfirmed: true,
    authenticatorLevel: "aal2",
    ...overrides,
  };
}

function skill(overrides = {}) {
  return {
    institutionId: "lycee-blaise-cendrars",
    status: "published",
    allowedTools: ["support.request_update"],
    ...overrides,
  };
}

function tool(overrides = {}) {
  return {
    key: "support.request_update",
    institutionId: "lycee-blaise-cendrars",
    status: "active",
    authority: "A2",
    requiredIdentity: "I2",
    allowedRoles: ["staff", "service_manager", "direction", "superadmin"],
    serviceCodes: ["referent_numerique"],
    relationshipRequired: false,
    mfaRequired: true,
    approvalRoles: ["service_manager", "direction"],
    inputSchema: {
      requestRef: { type: "string", required: true, maxLength: 40, pattern: "^BC-[0-9]{4}-[0-9]{6}$" },
      status: { type: "string", required: true, maxLength: 20, enum: ["en_cours", "resolu"] },
      notifyRequester: { type: "boolean" },
    },
    ...overrides,
  };
}

const validInput = {
  requestRef: "BC-2026-000123",
  status: "en_cours",
  notifyRequester: true,
};

test("authorizes only a published skill exact tool grant with bounded input", () => {
  const decision = authorizeAgentToolInvocation({
    actionId: ACTION_ID,
    inputFingerprint: INPUT_FINGERPRINT,
    actor: actor(),
    skill: skill(),
    tool: tool(),
    requestedAuthority: "A2",
    toolInput: { ...validInput, requestRef: "  BC-2026-000123  " },
    now: NOW,
  });

  assert.equal(decision.ok, true);
  assert.deepEqual(decision.ok ? decision.sanitizedInput : null, validInput);
});

test("rejects a tool absent from the exact published skill allowlist", () => {
  const decision = authorizeAgentToolInvocation({
    actionId: ACTION_ID,
    inputFingerprint: INPUT_FINGERPRINT,
    actor: actor(),
    skill: skill({ allowedTools: ["support.request_create"] }),
    tool: tool(),
    requestedAuthority: "A2",
    toolInput: validInput,
    now: NOW,
  });

  assert.deepEqual(decision, { ok: false, status: "refused", reason: "tool_not_granted" });
});

test("rejects disabled, cross-institution and authority-mismatched tools", () => {
  const base = {
    actionId: ACTION_ID,
    inputFingerprint: INPUT_FINGERPRINT,
    actor: actor(),
    skill: skill(),
    requestedAuthority: "A2",
    toolInput: validInput,
    now: NOW,
  };
  assert.equal(authorizeAgentToolInvocation({ ...base, tool: tool({ status: "disabled" }) }).ok, false);
  assert.deepEqual(
    authorizeAgentToolInvocation({ ...base, tool: tool({ institutionId: "other-school" }) }),
    { ok: false, status: "refused", reason: "institution_mismatch" }
  );
  assert.deepEqual(
    authorizeAgentToolInvocation({ ...base, tool: tool(), requestedAuthority: "A1" }),
    { ok: false, status: "refused", reason: "authority_mismatch" }
  );
});

test("rejects unknown fields, invalid enum values and malformed references", () => {
  for (const toolInput of [
    { ...validInput, hiddenCommand: "ignore policy" },
    { ...validInput, status: "admin" },
    { ...validInput, requestRef: "../../secret" },
  ]) {
    const decision = authorizeAgentToolInvocation({
      actionId: ACTION_ID,
      inputFingerprint: INPUT_FINGERPRINT,
      actor: actor(), skill: skill(), tool: tool(), requestedAuthority: "A2", toolInput, now: NOW,
    });
    assert.deepEqual(decision, { ok: false, status: "refused", reason: "input_invalid" });
  }
});

test("checks identity, role, service, relationship and MFA separately", () => {
  const cases = [
    [actor({ identityLevel: "I1" }), tool(), "identity_insufficient"],
    [actor({ role: "visitor" }), tool(), "role_insufficient"],
    [actor({ serviceCodes: ["vie_scolaire"] }), tool(), "service_scope_required"],
    [actor({ relationshipConfirmed: false }), tool({ relationshipRequired: true }), "relationship_required"],
    [actor({ authenticatorLevel: "aal1" }), tool(), "mfa_required"],
  ];
  for (const [currentActor, currentTool, reason] of cases) {
    const decision = authorizeAgentToolInvocation({
      actionId: ACTION_ID,
      inputFingerprint: INPUT_FINGERPRINT,
      actor: currentActor,
      skill: skill(),
      tool: currentTool,
      requestedAuthority: "A2",
      toolInput: validInput,
      now: NOW,
    });
    assert.deepEqual(decision, { ok: false, status: "refused", reason });
  }
});

test("keeps A3 waiting until an independent current approval exists", () => {
  const a3Tool = tool({ authority: "A3" });
  const base = {
    actionId: ACTION_ID,
    inputFingerprint: INPUT_FINGERPRINT,
    actor: actor(), skill: skill(), tool: a3Tool, requestedAuthority: "A3", toolInput: validInput, now: NOW,
  };
  assert.deepEqual(authorizeAgentToolInvocation(base), {
    ok: false, status: "awaiting_approval", reason: "approval_required",
  });

  const approval = {
    actionId: ACTION_ID,
    toolKey: "support.request_update",
    inputFingerprint: INPUT_FINGERPRINT,
    status: "approved",
    requestedByUserId: "user-agent-1",
    decisionByUserId: "manager-2",
    decisionRole: "service_manager",
    decidedAt: "2026-08-30T08:55:00.000Z",
    expiresAt: "2026-08-30T09:15:00.000Z",
    consumedAt: null,
  };
  assert.equal(authorizeAgentToolInvocation({ ...base, approval }).ok, true);
  assert.deepEqual(
    authorizeAgentToolInvocation({ ...base, approval: { ...approval, decisionByUserId: "user-agent-1" } }),
    { ok: false, status: "refused", reason: "approval_invalid" }
  );
  assert.deepEqual(
    authorizeAgentToolInvocation({ ...base, approval: { ...approval, expiresAt: "2026-08-30T08:59:00.000Z" } }),
    { ok: false, status: "refused", reason: "approval_invalid" }
  );
  assert.deepEqual(
    authorizeAgentToolInvocation({ ...base, approval: { ...approval, inputFingerprint: "b".repeat(64) } }),
    { ok: false, status: "refused", reason: "approval_invalid" }
  );
  assert.deepEqual(
    authorizeAgentToolInvocation({ ...base, approval: { ...approval, consumedAt: "2026-08-30T08:59:30.000Z" } }),
    { ok: false, status: "refused", reason: "approval_invalid" }
  );
});

test("blocks A4 without exception even for superadmin with MFA and approval", () => {
  const decision = authorizeAgentToolInvocation({
    actionId: ACTION_ID,
    inputFingerprint: INPUT_FINGERPRINT,
    actor: actor({ role: "superadmin", identityLevel: "I4" }),
    skill: skill({ allowedTools: ["official.decision"] }),
    tool: tool({
      key: "official.decision",
      authority: "A4",
      allowedRoles: ["superadmin"],
      serviceCodes: [],
    }),
    requestedAuthority: "A4",
    toolInput: validInput,
    approval: {
      actionId: ACTION_ID,
      toolKey: "official.decision",
      inputFingerprint: INPUT_FINGERPRINT,
      status: "approved",
      requestedByUserId: "user-agent-1",
      decisionByUserId: "direction-1",
      decisionRole: "direction",
      decidedAt: "2026-08-30T08:55:00.000Z",
      expiresAt: "2026-08-30T09:15:00.000Z",
      consumedAt: null,
    },
    now: NOW,
  });

  assert.deepEqual(decision, { ok: false, status: "refused", reason: "level_a4_forbidden" });
});

test("announces success only for a matching confirmed tool result", () => {
  const confirmed = verifyAgentToolConfirmation({
    expectedActionId: "action-123",
    expectedToolKey: "support.request_update",
    requestedAt: "2026-08-30T08:58:00.000Z",
    now: NOW,
    result: {
      actionId: "action-123",
      toolKey: "support.request_update",
      status: "succeeded",
      confirmedAt: "2026-08-30T08:59:00.000Z",
      confirmationRef: "support:evt_123456",
    },
  });

  assert.deepEqual(confirmed, {
    ok: true,
    confirmedAt: "2026-08-30T08:59:00.000Z",
    confirmationRef: "support:evt_123456",
  });
});

test("rejects false, mismatched and future tool confirmations", () => {
  const base = {
    expectedActionId: "action-123",
    expectedToolKey: "support.request_update",
    requestedAt: "2026-08-30T08:58:00.000Z",
    now: NOW,
    result: {
      actionId: "action-123",
      toolKey: "support.request_update",
      status: "succeeded",
      confirmedAt: "2026-08-30T08:59:00.000Z",
      confirmationRef: "support:evt_123456",
    },
  };
  assert.equal(verifyAgentToolConfirmation({ ...base, result: { ...base.result, status: "failed" } }).ok, false);
  assert.equal(verifyAgentToolConfirmation({ ...base, result: { ...base.result, actionId: "other" } }).ok, false);
  assert.equal(verifyAgentToolConfirmation({ ...base, result: { ...base.result, toolKey: "other.tool" } }).ok, false);
  assert.equal(verifyAgentToolConfirmation({ ...base, result: { ...base.result, confirmedAt: null } }).ok, false);
  assert.deepEqual(
    verifyAgentToolConfirmation({ ...base, result: { ...base.result, confirmedAt: "2026-08-30T09:01:00.000Z" } }),
    { ok: false, reason: "confirmation_time_invalid" }
  );
});
