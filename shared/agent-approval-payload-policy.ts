import {
  SUPPORT_SERVICES,
  supportServiceLabel,
  type SupportService,
} from "./support-agent-access.js";

export const AGENT_APPROVAL_ITEM_LIMIT = 200;

export type AgentApprovalStatus = "pending" | "approved" | "rejected" | "expired" | "cancelled";

export type AgentApprovalPayloadItem = {
  id: string;
  serviceCode: SupportService;
  serviceLabel: string;
  toolLabel: string;
  skillName: string;
  skillVersion: string;
  status: AgentApprovalStatus;
  requestedFromRole: string;
  requestedAt: string;
  decidedAt: string | null;
  expiresAt: string;
  decisionReason: string | null;
  requestedByMe: boolean;
  canDecide: boolean;
  details: Array<{ label: string; value: string }>;
};

export type AgentApprovalsPayload = {
  generatedAt: string;
  reviewer: {
    role: string;
    services: Array<{ code: SupportService; label: string }>;
    canViewAll: boolean;
  };
  summary: {
    pending: number;
    actionable: number;
    decided: number;
    expired: number;
  };
  items: AgentApprovalPayloadItem[];
  truncated: boolean;
};

export type AgentApprovalDecisionPayload = {
  approvalId: string;
  status: "approved" | "rejected";
  decidedAt: string;
};

const ROOT_FIELDS = new Set(["generatedAt", "reviewer", "summary", "items", "truncated"]);
const REVIEWER_FIELDS = new Set(["role", "services", "canViewAll"]);
const REVIEWER_SERVICE_FIELDS = new Set(["code", "label"]);
const SUMMARY_FIELDS = new Set(["pending", "actionable", "decided", "expired"]);
const ITEM_FIELDS = new Set([
  "id",
  "serviceCode",
  "serviceLabel",
  "toolLabel",
  "skillName",
  "skillVersion",
  "status",
  "requestedFromRole",
  "requestedAt",
  "decidedAt",
  "expiresAt",
  "decisionReason",
  "requestedByMe",
  "canDecide",
  "details",
]);
const DETAIL_FIELDS = new Set(["label", "value"]);
const DECISION_FIELDS = new Set(["approvalId", "status", "decidedAt"]);
const STATUSES = new Set<AgentApprovalStatus>([
  "pending",
  "approved",
  "rejected",
  "expired",
  "cancelled",
]);
const REVIEWER_ROLES = new Set([
  "Superadministration",
  "Direction",
  "Responsable de service",
  "Agent habilité",
]);
const DETAIL_LABELS = new Set([
  "Action préparée",
  "Objet",
  "Dossier",
  "Destinataire",
  "Document",
  "Destination",
]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactFields(value: Record<string, unknown>, fields: Set<string>): boolean {
  const keys = Object.keys(value);
  return keys.length === fields.size && keys.every((key) => fields.has(key));
}

function isBoundedText(value: unknown, max: number, min = 1): value is string {
  return typeof value === "string" && value.length >= min && value.length <= max;
}

function isCanonicalIsoDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString() === value;
}

function isSafeCount(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= AGENT_APPROVAL_ITEM_LIMIT;
}

function isSupportService(value: unknown): value is SupportService {
  return typeof value === "string" && SUPPORT_SERVICES.includes(value as SupportService);
}

function isReviewerService(value: unknown): value is { code: SupportService; label: string } {
  return isRecord(value)
    && hasExactFields(value, REVIEWER_SERVICE_FIELDS)
    && isSupportService(value.code)
    && value.label === supportServiceLabel(value.code);
}

function isApprovalDetail(value: unknown): value is { label: string; value: string } {
  return isRecord(value)
    && hasExactFields(value, DETAIL_FIELDS)
    && typeof value.label === "string"
    && DETAIL_LABELS.has(value.label)
    && isBoundedText(value.value, 240);
}

function isApprovalItem(value: unknown, generatedAt: string): value is AgentApprovalPayloadItem {
  if (!isRecord(value)
    || !hasExactFields(value, ITEM_FIELDS)
    || typeof value.id !== "string" || !UUID_PATTERN.test(value.id)
    || !isSupportService(value.serviceCode)
    || value.serviceLabel !== supportServiceLabel(value.serviceCode)
    || !isBoundedText(value.toolLabel, 120)
    || !isBoundedText(value.skillName, 120)
    || !isBoundedText(value.skillVersion, 40)
    || typeof value.status !== "string" || !STATUSES.has(value.status as AgentApprovalStatus)
    || !isBoundedText(value.requestedFromRole, 40) || !REVIEWER_ROLES.has(value.requestedFromRole)
    || !isCanonicalIsoDate(value.requestedAt)
    || (value.decidedAt !== null && !isCanonicalIsoDate(value.decidedAt))
    || !isCanonicalIsoDate(value.expiresAt)
    || (value.decisionReason !== null && !isBoundedText(value.decisionReason, 500, 2))
    || typeof value.requestedByMe !== "boolean"
    || typeof value.canDecide !== "boolean"
    || !Array.isArray(value.details)
    || value.details.length > DETAIL_LABELS.size
    || !value.details.every(isApprovalDetail)
    || new Set(value.details.map((detail) => detail.label)).size !== value.details.length) {
    return false;
  }
  const requestedAt = Date.parse(value.requestedAt);
  const expiresAt = Date.parse(value.expiresAt);
  const decidedAt = value.decidedAt === null ? null : Date.parse(value.decidedAt);
  if (expiresAt < requestedAt || (decidedAt !== null && decidedAt < requestedAt)) return false;
  if (value.status === "pending" && decidedAt !== null) return false;
  if ((value.status === "approved" || value.status === "rejected") && decidedAt === null) return false;
  if (value.status === "rejected" && value.decisionReason === null) return false;
  if (value.canDecide && (
    value.status !== "pending"
    || value.requestedByMe
    || expiresAt <= Date.parse(generatedAt)
  )) return false;
  return true;
}

export function isAgentApprovalsPayload(value: unknown): value is AgentApprovalsPayload {
  if (!isRecord(value)
    || !hasExactFields(value, ROOT_FIELDS)
    || !isCanonicalIsoDate(value.generatedAt)) {
    return false;
  }
  const generatedAt = value.generatedAt;
  if (!isRecord(value.reviewer)
    || !hasExactFields(value.reviewer, REVIEWER_FIELDS)
    || typeof value.reviewer.role !== "string" || !REVIEWER_ROLES.has(value.reviewer.role)
    || !Array.isArray(value.reviewer.services)
    || value.reviewer.services.length < 1
    || value.reviewer.services.length > SUPPORT_SERVICES.length
    || !value.reviewer.services.every(isReviewerService)
    || new Set(value.reviewer.services.map((service) => service.code)).size !== value.reviewer.services.length
    || typeof value.reviewer.canViewAll !== "boolean"
    || !isRecord(value.summary)
    || !hasExactFields(value.summary, SUMMARY_FIELDS)
    || !isSafeCount(value.summary.pending)
    || !isSafeCount(value.summary.actionable)
    || !isSafeCount(value.summary.decided)
    || !isSafeCount(value.summary.expired)
    || value.summary.actionable > value.summary.pending
    || value.summary.pending + value.summary.decided + value.summary.expired > AGENT_APPROVAL_ITEM_LIMIT
    || !Array.isArray(value.items)
    || value.items.length > AGENT_APPROVAL_ITEM_LIMIT
    || !value.items.every((item) => isApprovalItem(item, generatedAt))
    || new Set(value.items.map((item) => item.id)).size !== value.items.length
    || typeof value.truncated !== "boolean") {
    return false;
  }
  const reviewerServices = new Set(value.reviewer.services.map((service) => service.code));
  return value.reviewer.canViewAll
    || value.items.every((item) => reviewerServices.has(item.serviceCode));
}

export function isAgentApprovalDecisionPayload(
  value: unknown,
  expected: { approvalId: string; status: "approved" | "rejected" }
): value is AgentApprovalDecisionPayload {
  return isRecord(value)
    && hasExactFields(value, DECISION_FIELDS)
    && value.approvalId === expected.approvalId
    && typeof value.approvalId === "string"
    && UUID_PATTERN.test(value.approvalId)
    && value.status === expected.status
    && isCanonicalIsoDate(value.decidedAt);
}
