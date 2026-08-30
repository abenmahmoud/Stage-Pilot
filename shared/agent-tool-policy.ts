import { createHash } from "node:crypto";
import { identityAtLeast } from "./agent-identity-policy.js";
import type { AgentIdentityLevel } from "./agent-identity-policy.js";

export type { AgentIdentityLevel } from "./agent-identity-policy.js";
export type AgentActionAuthority = "A0" | "A1" | "A2" | "A3" | "A4";
export type AgentToolRole =
  | "visitor"
  | "requester"
  | "student"
  | "guardian"
  | "staff"
  | "service_manager"
  | "direction"
  | "superadmin";

export type AgentToolInputField =
  | {
      type: "string";
      required?: boolean;
      maxLength: number;
      enum?: string[];
      pattern?: string;
    }
  | {
      type: "integer";
      required?: boolean;
      minimum?: number;
      maximum?: number;
    }
  | {
      type: "boolean";
      required?: boolean;
    };

export type AgentToolDefinition = {
  key: string;
  institutionId: string;
  status: "active" | "disabled";
  authority: AgentActionAuthority;
  requiredIdentity: AgentIdentityLevel;
  allowedRoles: AgentToolRole[];
  serviceCodes: string[];
  relationshipRequired: boolean;
  mfaRequired: boolean;
  approvalRoles: AgentToolRole[];
  inputSchema: Record<string, AgentToolInputField>;
};

export type AgentToolSkillGrant = {
  institutionId: string;
  status: "draft" | "review" | "published" | "retired";
  allowedTools: string[];
};

export type AgentToolActor = {
  userId: string | null;
  institutionId: string;
  identityLevel: AgentIdentityLevel;
  role: AgentToolRole;
  serviceCodes: string[];
  relationshipConfirmed: boolean;
  authenticatorLevel: "aal1" | "aal2";
};

export type AgentToolApproval = {
  actionId: string;
  toolKey: string;
  inputFingerprint: string;
  status: "pending" | "approved" | "rejected" | "expired" | "cancelled";
  requestedByUserId: string;
  decisionByUserId: string | null;
  decisionRole: AgentToolRole | null;
  decidedAt: string | null;
  expiresAt: string;
  consumedAt: string | null;
};

export type AgentToolDecisionReason =
  | "level_a4_forbidden"
  | "tool_invalid"
  | "tool_disabled"
  | "skill_not_published"
  | "tool_not_granted"
  | "institution_mismatch"
  | "authority_mismatch"
  | "identity_insufficient"
  | "role_insufficient"
  | "service_scope_required"
  | "relationship_required"
  | "mfa_required"
  | "input_invalid"
  | "input_fingerprint_mismatch"
  | "approval_not_expected"
  | "identified_user_required_for_a3"
  | "approval_required"
  | "approval_invalid";

export type AgentToolDecision =
  | { ok: true; status: "authorized"; sanitizedInput: Record<string, string | number | boolean> }
  | { ok: false; status: "awaiting_approval" | "refused"; reason: AgentToolDecisionReason };

const TOOL_KEY_PATTERN = /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/;
function parsedTime(value: string | null): number {
  if (value === null) return Number.NaN;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function validateToolInput(
  schema: Record<string, AgentToolInputField>,
  value: unknown
): Record<string, string | number | boolean> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some((key) => !(key in schema))) return null;

  const sanitized: Record<string, string | number | boolean> = {};
  for (const [key, field] of Object.entries(schema)) {
    const candidate = input[key];
    if (candidate === undefined) {
      if (field.required) return null;
      continue;
    }
    if (field.type === "string") {
      const cleaned = typeof candidate === "string" ? candidate.trim() : "";
      if (
        typeof candidate !== "string" ||
        cleaned.length === 0 ||
        cleaned.length > field.maxLength ||
        (field.enum && !field.enum.includes(cleaned))
      ) {
        return null;
      }
      if (field.pattern) {
        let pattern: RegExp;
        try {
          pattern = new RegExp(field.pattern, "u");
        } catch {
          return null;
        }
        if (!pattern.test(cleaned)) return null;
      }
      sanitized[key] = cleaned;
      continue;
    }
    if (field.type === "integer") {
      if (
        typeof candidate !== "number" ||
        !Number.isSafeInteger(candidate) ||
        (field.minimum !== undefined && candidate < field.minimum) ||
        (field.maximum !== undefined && candidate > field.maximum)
      ) {
        return null;
      }
      sanitized[key] = candidate;
      continue;
    }
    if (typeof candidate !== "boolean") return null;
    sanitized[key] = candidate;
  }
  return sanitized;
}

export function fingerprintAgentToolInput(
  input: Record<string, string | number | boolean>
): string {
  const canonical = Object.fromEntries(
    Object.entries(input)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, value]) => [
        key,
        typeof value === "string" ? value.normalize("NFC") : value,
      ])
  );
  return createHash("sha256").update(JSON.stringify(canonical), "utf8").digest("hex");
}

function validApproval(input: {
  approval: AgentToolApproval | null;
  actor: AgentToolActor;
  tool: AgentToolDefinition;
  actionId: string;
  inputFingerprint: string;
  now: number;
}): boolean {
  const approval = input.approval;
  if (
    !approval ||
    approval.status !== "approved" ||
    approval.decisionByUserId === null ||
    approval.decisionRole === null ||
    approval.actionId !== input.actionId ||
    approval.toolKey !== input.tool.key ||
    approval.inputFingerprint !== input.inputFingerprint ||
    approval.consumedAt !== null ||
    input.actor.userId === null ||
    approval.requestedByUserId !== input.actor.userId ||
    approval.decisionByUserId === approval.requestedByUserId ||
    !input.tool.approvalRoles.includes(approval.decisionRole)
  ) {
    return false;
  }
  const decidedAt = parsedTime(approval.decidedAt);
  const expiresAt = parsedTime(approval.expiresAt);
  return (
    Number.isFinite(decidedAt) &&
    Number.isFinite(expiresAt) &&
    decidedAt <= input.now &&
    expiresAt > input.now &&
    decidedAt < expiresAt
  );
}

export function authorizeAgentToolInvocation(input: {
  actionId: string;
  inputFingerprint: string;
  actor: AgentToolActor;
  skill: AgentToolSkillGrant;
  tool: AgentToolDefinition;
  requestedAuthority: AgentActionAuthority;
  toolInput: unknown;
  approval?: AgentToolApproval | null;
  now: string;
}): AgentToolDecision {
  if (input.requestedAuthority === "A4" || input.tool.authority === "A4") {
    return { ok: false, status: "refused", reason: "level_a4_forbidden" };
  }
  if (!TOOL_KEY_PATTERN.test(input.tool.key)) {
    return { ok: false, status: "refused", reason: "tool_invalid" };
  }
  if (input.tool.status !== "active") {
    return { ok: false, status: "refused", reason: "tool_disabled" };
  }
  if (input.skill.status !== "published") {
    return { ok: false, status: "refused", reason: "skill_not_published" };
  }
  if (!input.skill.allowedTools.includes(input.tool.key)) {
    return { ok: false, status: "refused", reason: "tool_not_granted" };
  }
  if (
    input.actor.institutionId !== input.skill.institutionId ||
    input.actor.institutionId !== input.tool.institutionId
  ) {
    return { ok: false, status: "refused", reason: "institution_mismatch" };
  }
  if (input.requestedAuthority !== input.tool.authority) {
    return { ok: false, status: "refused", reason: "authority_mismatch" };
  }
  if (input.requestedAuthority !== "A3" && input.approval != null) {
    return { ok: false, status: "refused", reason: "approval_not_expected" };
  }
  if (
    !/^[a-zA-Z0-9][a-zA-Z0-9:_-]{7,119}$/.test(input.actionId) ||
    !/^[a-f0-9]{64}$/.test(input.inputFingerprint)
  ) {
    return { ok: false, status: "refused", reason: "input_invalid" };
  }
  if (!identityAtLeast(input.actor.identityLevel, input.tool.requiredIdentity)) {
    return { ok: false, status: "refused", reason: "identity_insufficient" };
  }
  if (!input.tool.allowedRoles.includes(input.actor.role)) {
    return { ok: false, status: "refused", reason: "role_insufficient" };
  }
  if (
    input.tool.serviceCodes.length > 0 &&
    !input.tool.serviceCodes.some((service) => input.actor.serviceCodes.includes(service))
  ) {
    return { ok: false, status: "refused", reason: "service_scope_required" };
  }
  if (input.tool.relationshipRequired && !input.actor.relationshipConfirmed) {
    return { ok: false, status: "refused", reason: "relationship_required" };
  }
  if (input.tool.mfaRequired && input.actor.authenticatorLevel !== "aal2") {
    return { ok: false, status: "refused", reason: "mfa_required" };
  }
  const sanitizedInput = validateToolInput(input.tool.inputSchema, input.toolInput);
  if (!sanitizedInput) {
    return { ok: false, status: "refused", reason: "input_invalid" };
  }
  if (fingerprintAgentToolInput(sanitizedInput) !== input.inputFingerprint) {
    return { ok: false, status: "refused", reason: "input_fingerprint_mismatch" };
  }
  if (input.requestedAuthority === "A3") {
    if (input.actor.userId === null) {
      return { ok: false, status: "refused", reason: "identified_user_required_for_a3" };
    }
    if (!input.approval || input.approval.status === "pending") {
      return { ok: false, status: "awaiting_approval", reason: "approval_required" };
    }
    const now = parsedTime(input.now);
    if (!Number.isFinite(now) || !validApproval({
      approval: input.approval,
      actor: input.actor,
      tool: input.tool,
      actionId: input.actionId,
      inputFingerprint: input.inputFingerprint,
      now,
    })) {
      return { ok: false, status: "refused", reason: "approval_invalid" };
    }
  }
  return { ok: true, status: "authorized", sanitizedInput };
}

export type AgentToolResultEnvelope = {
  actionId: string;
  toolKey: string;
  status: "succeeded" | "failed" | "refused";
  confirmedAt: string | null;
  confirmationRef: string | null;
};

export type AgentToolConfirmationReason =
  | "action_mismatch"
  | "tool_mismatch"
  | "status_not_succeeded"
  | "confirmation_missing"
  | "confirmation_time_invalid";

export function verifyAgentToolConfirmation(input: {
  expectedActionId: string;
  expectedToolKey: string;
  result: AgentToolResultEnvelope;
  requestedAt: string;
  now: string;
}): { ok: true; confirmedAt: string; confirmationRef: string } | { ok: false; reason: AgentToolConfirmationReason } {
  if (input.result.actionId !== input.expectedActionId) {
    return { ok: false, reason: "action_mismatch" };
  }
  if (input.result.toolKey !== input.expectedToolKey) {
    return { ok: false, reason: "tool_mismatch" };
  }
  if (input.result.status !== "succeeded") {
    return { ok: false, reason: "status_not_succeeded" };
  }
  if (
    input.result.confirmedAt === null ||
    input.result.confirmationRef === null ||
    !/^[a-zA-Z0-9][a-zA-Z0-9:_-]{7,119}$/.test(input.result.confirmationRef)
  ) {
    return { ok: false, reason: "confirmation_missing" };
  }
  const confirmedAt = parsedTime(input.result.confirmedAt);
  const requestedAt = parsedTime(input.requestedAt);
  const now = parsedTime(input.now);
  if (
    !Number.isFinite(confirmedAt) ||
    !Number.isFinite(requestedAt) ||
    !Number.isFinite(now) ||
    confirmedAt < requestedAt ||
    confirmedAt > now
  ) {
    return { ok: false, reason: "confirmation_time_invalid" };
  }
  return {
    ok: true,
    confirmedAt: input.result.confirmedAt,
    confirmationRef: input.result.confirmationRef,
  };
}
