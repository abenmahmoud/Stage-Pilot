import type { SupportService } from "./support-agent-access.js";

export const AGENT_APPROVAL_ROLES = [
  "staff",
  "service_manager",
  "direction",
  "superadmin",
] as const;

export type AgentApprovalRole = (typeof AGENT_APPROVAL_ROLES)[number];
export type AgentApprovalDecision = "approved" | "rejected";

export type AgentApprovalDecisionInput = {
  decision: AgentApprovalDecision;
  reason: string | null;
};

const PRESENTATION_FIELDS: Array<{
  key: string;
  label: string;
  max: number;
}> = [
  { key: "summary", label: "Action préparée", max: 240 },
  { key: "subject", label: "Objet", max: 180 },
  { key: "requestCode", label: "Dossier", max: 40 },
  { key: "recipientLabel", label: "Destinataire", max: 120 },
  { key: "documentLabel", label: "Document", max: 160 },
  { key: "destination", label: "Destination", max: 120 },
];

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("La décision est invalide.");
  }
  return value as Record<string, unknown>;
}

function cleanReason(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") throw new Error("Le motif est invalide.");
  const clean = value.trim();
  if (clean.length < 2 || clean.length > 500) {
    throw new Error("Le motif doit contenir entre 2 et 500 caractères.");
  }
  return clean;
}

export function parseAgentApprovalDecision(value: unknown): AgentApprovalDecisionInput {
  const input = record(value);
  const unknownKeys = Object.keys(input).filter(
    (key) => key !== "decision" && key !== "reason"
  );
  if (unknownKeys.length > 0) throw new Error("La décision contient un champ interdit.");
  if (input.decision !== "approved" && input.decision !== "rejected") {
    throw new Error("La décision est invalide.");
  }
  const reason = cleanReason(input.reason);
  if (input.decision === "rejected" && reason === null) {
    throw new Error("Expliquez brièvement le refus.");
  }
  return { decision: input.decision, reason };
}

export function resolveAgentApprovalRole(
  authRole: string,
  membershipRole: string
): AgentApprovalRole | null {
  if (authRole === "superadmin" && membershipRole === "admin") return "superadmin";
  if (authRole === "proviseur" && membershipRole === "admin") return "direction";
  if (
    (authRole === "agent" || authRole === "administration") &&
    (membershipRole === "service_manager" || membershipRole === "admin")
  ) {
    return "service_manager";
  }
  if (
    (authRole === "agent" || authRole === "administration") &&
    membershipRole === "agent"
  ) {
    return "staff";
  }
  return null;
}

export function approvalIsExpired(status: string, expiresAt: Date, now: Date): boolean {
  return (
    (status === "pending" || status === "approved") &&
    expiresAt.getTime() <= now.getTime()
  );
}

export function presentAgentActionInput(value: unknown): Array<{
  label: string;
  value: string;
}> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const input = value as Record<string, unknown>;
  return PRESENTATION_FIELDS.flatMap(({ key, label, max }) => {
    const field = input[key];
    if (typeof field !== "string") return [];
    const clean = field.trim().replace(/\s+/g, " ");
    if (!clean) return [];
    return [{ label, value: clean.slice(0, max) }];
  });
}

export function canDecideAgentApproval(input: {
  approvalStatus: string;
  expiresAt: Date;
  requestedFromRole: string;
  reviewerRole: AgentApprovalRole;
  requestedByUserId: string;
  reviewerUserId: string;
  serviceCode: SupportService;
  allowedServices: SupportService[];
  canViewAll: boolean;
  now: Date;
}): boolean {
  return (
    input.approvalStatus === "pending" &&
    !approvalIsExpired(input.approvalStatus, input.expiresAt, input.now) &&
    input.requestedFromRole === input.reviewerRole &&
    input.requestedByUserId !== input.reviewerUserId &&
    (input.canViewAll || input.allowedServices.includes(input.serviceCode))
  );
}
