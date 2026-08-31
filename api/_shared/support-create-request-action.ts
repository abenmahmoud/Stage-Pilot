import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import {
  agentActions,
  agentSkills,
  agentSkillVersions,
} from "../../db/schema.js";
import {
  authorizeAgentToolInvocation,
  fingerprintAgentToolInput,
  verifyAgentToolConfirmation,
  type AgentToolDefinition,
} from "../../shared/agent-tool-policy.js";
import type { SupportAssistantActionGrant } from "../../shared/support-assistant-routing-receipt.js";
import type { SupportRequestInput } from "./support.js";
import { sha256 } from "./support.js";
import { HttpError } from "./auth.js";

export const SUPPORT_CREATE_REQUEST_TOOL_KEY = "support.create_request" as const;

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

type ActionRow = {
  id: string;
  institutionId: string;
  supportRequestId: string | null;
  skillVersionId: string;
  toolKey: string;
  authorityLevel: string;
  inputFingerprint: string;
  status: string;
  requesterRefHash: string;
  toolResult: unknown;
  confirmationRef: string | null;
  requestedAt: Date;
  confirmedAt: Date | null;
};

export type SupportCreateRequestActionState = {
  row: ActionRow;
  needsCompletion: boolean;
};

export type SupportCreateRequestActionConfirmation = {
  actionId: string;
  toolKey: typeof SUPPORT_CREATE_REQUEST_TOOL_KEY;
  status: "succeeded";
  requestPublicCode: string;
  confirmedAt: string;
  confirmationRef: string;
};

const TOOL_DEFINITION_BASE: Omit<AgentToolDefinition, "institutionId"> = {
  key: SUPPORT_CREATE_REQUEST_TOOL_KEY,
  status: "active",
  authority: "A2",
  requiredIdentity: "I0",
  allowedRoles: [
    "visitor",
    "requester",
    "student",
    "guardian",
    "staff",
    "service_manager",
    "direction",
    "superadmin",
  ],
  serviceCodes: [],
  relationshipRequired: false,
  mfaRequired: false,
  approvalRoles: [],
  inputSchema: {
    category: { type: "string", required: true, maxLength: 40 },
    service: {
      type: "string",
      required: true,
      maxLength: 40,
      enum: [
        "referent_numerique",
        "ddfpt",
        "secretariat",
        "vie_scolaire",
        "intendance",
        "direction",
        "administration",
      ],
    },
    requesterType: {
      type: "string",
      required: true,
      maxLength: 20,
      enum: ["eleve", "parent", "professeur", "personnel", "autre"],
    },
    preferredChannel: {
      type: "string",
      required: true,
      maxLength: 10,
      enum: ["email", "phone", "web"],
    },
    callbackRequested: { type: "boolean", required: true },
    hasEmail: { type: "boolean", required: true },
    hasPhone: { type: "boolean", required: true },
  },
};

export function supportCreateRequestActionInput(
  input: SupportRequestInput
): Record<string, string | boolean> {
  return {
    category: input.category,
    service: input.routing.service,
    requesterType: input.requesterType,
    preferredChannel: input.preferredChannel,
    callbackRequested: input.callbackRequested,
    hasEmail: input.email !== null,
    hasPhone: input.phone !== null,
  };
}

function allowedTools(value: unknown): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const definition = value as Record<string, unknown>;
  if (!Array.isArray(definition.allowedTools)) return [];
  return [...new Set(definition.allowedTools.filter((tool): tool is string =>
    typeof tool === "string"
    && tool.length <= 120
    && /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/.test(tool)
  ))].sort();
}

async function authorizedActionBinding(input: {
  tx: DbTransaction;
  institutionId: string;
  grant: SupportAssistantActionGrant;
  supportInput: SupportRequestInput;
  requesterRefHash: string;
  actionId: string;
  now: Date;
}): Promise<{
  skillVersionId: string;
  sanitizedInput: Record<string, string | number | boolean>;
  inputFingerprint: string;
}> {
  if (
    input.grant.toolKey !== SUPPORT_CREATE_REQUEST_TOOL_KEY
    || input.grant.requesterRefHash !== input.requesterRefHash
  ) {
    throw new HttpError(403, "L’autorisation de création de la demande est invalide.");
  }
  const [skill] = await input.tx
    .select({
      versionId: agentSkillVersions.id,
      institutionId: agentSkillVersions.institutionId,
      versionStatus: agentSkillVersions.status,
      definition: agentSkillVersions.definition,
      enabled: agentSkills.enabled,
      activeVersionId: agentSkills.activeVersionId,
    })
    .from(agentSkillVersions)
    .innerJoin(agentSkills, eq(agentSkillVersions.skillId, agentSkills.id))
    .where(and(
      eq(agentSkillVersions.id, input.grant.skillVersionId),
      eq(agentSkillVersions.institutionId, input.institutionId),
      eq(agentSkills.institutionId, input.institutionId)
    ))
    .limit(1);
  if (!skill || !skill.enabled || skill.activeVersionId !== skill.versionId) {
    throw new HttpError(403, "La compétence autorisant la demande n’est pas active.");
  }

  const rawInput = supportCreateRequestActionInput(input.supportInput);
  const inputFingerprint = fingerprintAgentToolInput(rawInput);
  const decision = authorizeAgentToolInvocation({
    actionId: input.actionId,
    inputFingerprint,
    actor: {
      userId: null,
      institutionId: input.institutionId,
      identityLevel: "I0",
      role: "visitor",
      serviceCodes: [],
      relationshipConfirmed: false,
      authenticatorLevel: "aal1",
    },
    skill: {
      institutionId: skill.institutionId,
      status: skill.versionStatus === "published" ? "published" : "draft",
      allowedTools: allowedTools(skill.definition),
    },
    tool: { ...TOOL_DEFINITION_BASE, institutionId: input.institutionId },
    requestedAuthority: "A2",
    toolInput: rawInput,
    now: input.now.toISOString(),
  });
  if (!decision.ok) {
    throw new HttpError(403, "La compétence ne permet pas de créer cette demande.");
  }
  return {
    skillVersionId: skill.versionId,
    sanitizedInput: decision.sanitizedInput,
    inputFingerprint,
  };
}

function actionSelection() {
  return {
    id: agentActions.id,
    institutionId: agentActions.institutionId,
    supportRequestId: agentActions.supportRequestId,
    skillVersionId: agentActions.skillVersionId,
    toolKey: agentActions.toolKey,
    authorityLevel: agentActions.authorityLevel,
    inputFingerprint: agentActions.inputFingerprint,
    status: agentActions.status,
    requesterRefHash: agentActions.requesterRefHash,
    toolResult: agentActions.toolResult,
    confirmationRef: agentActions.confirmationRef,
    requestedAt: agentActions.requestedAt,
    confirmedAt: agentActions.confirmedAt,
  };
}

export async function startSupportCreateRequestAction(input: {
  tx: DbTransaction;
  institutionId: string;
  grant: SupportAssistantActionGrant;
  supportInput: SupportRequestInput;
  requesterRefHash: string;
  requestIdempotencyHash: string;
}): Promise<SupportCreateRequestActionState> {
  if (!/^[a-f0-9]{64}$/.test(input.requesterRefHash)) {
    throw new HttpError(403, "L’appareil ayant préparé la demande n’est pas reconnu.");
  }
  const actionId = randomUUID();
  const now = new Date();
  const binding = await authorizedActionBinding({ ...input, actionId, now });
  const actionIdempotencyHash = sha256(
    `agent-action\0${SUPPORT_CREATE_REQUEST_TOOL_KEY}\0${input.requestIdempotencyHash}`
  );
  const [created] = await input.tx
    .insert(agentActions)
    .values({
      id: actionId,
      institutionId: input.institutionId,
      skillVersionId: binding.skillVersionId,
      serviceCode: input.supportInput.routing.service,
      toolKey: SUPPORT_CREATE_REQUEST_TOOL_KEY,
      authorityLevel: "A2",
      inputRedacted: binding.sanitizedInput,
      inputFingerprint: binding.inputFingerprint,
      status: "planned",
      idempotencyKeyHash: actionIdempotencyHash,
      requestedByUserId: null,
      requesterRefHash: input.requesterRefHash,
    })
    .onConflictDoNothing({
      target: [agentActions.institutionId, agentActions.idempotencyKeyHash],
    })
    .returning(actionSelection());

  const row = created ?? (await input.tx
    .select(actionSelection())
    .from(agentActions)
    .where(and(
      eq(agentActions.institutionId, input.institutionId),
      eq(agentActions.idempotencyKeyHash, actionIdempotencyHash)
    ))
    .limit(1))[0];
  if (!row) throw new HttpError(409, "L’action de création n’a pas pu être retrouvée.");
  if (
    row.toolKey !== SUPPORT_CREATE_REQUEST_TOOL_KEY
    || row.skillVersionId !== binding.skillVersionId
    || row.authorityLevel !== "A2"
    || row.inputFingerprint !== binding.inputFingerprint
    || row.requesterRefHash !== input.requesterRefHash
  ) {
    throw new HttpError(409, "Cette tentative est déjà liée à une autre action.");
  }
  if (row.status === "succeeded") return { row, needsCompletion: false };
  if (row.status !== "planned") {
    throw new HttpError(409, "Cette action est déjà en cours ou terminée sans succès.");
  }

  const [running] = await input.tx
    .update(agentActions)
    .set({ status: "running", startedAt: sql`transaction_timestamp()` })
    .where(and(eq(agentActions.id, row.id), eq(agentActions.status, "planned")))
    .returning(actionSelection());
  if (!running) throw new HttpError(409, "L’action de création a changé d’état.");
  return { row: running, needsCompletion: true };
}

function confirmedToolResult(value: unknown, publicCode: string): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const result = value as Record<string, unknown>;
  return Object.keys(result).length === 3
    && result.requestPublicCode === publicCode
    && typeof result.requestStatus === "string"
    && result.requestStatus.length >= 1
    && result.requestStatus.length <= 40
    && typeof result.duplicate === "boolean";
}

export async function completeSupportCreateRequestAction(input: {
  tx: DbTransaction;
  action: SupportCreateRequestActionState;
  request: { id: string; publicCode: string; status: string };
  duplicate: boolean;
}): Promise<SupportCreateRequestActionConfirmation> {
  let row = input.action.row;
  if (input.action.needsCompletion) {
    const confirmationRef = `agent-action:${row.id}`;
    const [completed] = await input.tx
      .update(agentActions)
      .set({
        supportRequestId: input.request.id,
        status: "succeeded",
        toolResult: {
          requestPublicCode: input.request.publicCode,
          requestStatus: input.request.status,
          duplicate: input.duplicate,
        },
        confirmationRef,
        confirmedAt: sql`transaction_timestamp()`,
      })
      .where(and(eq(agentActions.id, row.id), eq(agentActions.status, "running")))
      .returning(actionSelection());
    if (!completed) throw new HttpError(409, "La création n’a pas reçu de confirmation atomique.");
    row = completed;
  }
  if (
    row.supportRequestId !== input.request.id
    || !row.confirmedAt
    || !confirmedToolResult(row.toolResult, input.request.publicCode)
  ) {
    throw new HttpError(409, "La confirmation de l’action ne correspond pas au dossier.");
  }
  const confirmation = verifyAgentToolConfirmation({
    expectedActionId: row.id,
    expectedToolKey: SUPPORT_CREATE_REQUEST_TOOL_KEY,
    result: {
      actionId: row.id,
      toolKey: row.toolKey,
      status: row.status === "succeeded" ? "succeeded" : "failed",
      confirmedAt: row.confirmedAt.toISOString(),
      confirmationRef: row.confirmationRef,
    },
    requestedAt: row.requestedAt.toISOString(),
    now: row.confirmedAt.toISOString(),
  });
  if (!confirmation.ok) throw new HttpError(409, "La preuve de l’action est invalide.");
  return {
    actionId: row.id,
    toolKey: SUPPORT_CREATE_REQUEST_TOOL_KEY,
    status: "succeeded",
    requestPublicCode: input.request.publicCode,
    confirmedAt: confirmation.confirmedAt,
    confirmationRef: confirmation.confirmationRef,
  };
}
