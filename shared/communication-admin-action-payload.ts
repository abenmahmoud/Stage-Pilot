import {
  COMMUNICATION_STATUSES,
  COMMUNICATION_VISIBILITIES,
  parseCommunicationsPayload,
  type CommunicationRow,
  type CommunicationTemplate,
} from "./communication-admin-payload.js";
import {
  COMMUNICATION_TEMPLATE_KEYS,
  parseCommunicationTemplateInput,
  type CommunicationTemplateInput,
} from "./communication-templates.js";
import { detectForbiddenSupportSecret } from "./support-secret-policy.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_PATTERN = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]{1,3})?Z$/;
const PUBLIC_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{2,119}$/;
const CONTROL_PATTERN = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
const VERSION_STATUSES = ["draft", "review", "approved", "published", "superseded"] as const;

type CommunicationStatus = (typeof COMMUNICATION_STATUSES)[number];
type CommunicationVisibility = (typeof COMMUNICATION_VISIBILITIES)[number];
type CommunicationVersionStatus = (typeof VERSION_STATUSES)[number];

export type CommunicationDetail = CommunicationRow & {
  bodyMarkdown: string;
};

export type CommunicationAssistSuggestion = Pick<
  CommunicationDetail,
  "title" | "summary" | "bodyMarkdown" | "structuredFacts" | "openQuestions"
> & { reviewNotes: string[] };

export type CommunicationVersion = {
  id: string;
  version: number;
  status: CommunicationVersionStatus;
  createdAt: string;
  updatedAt: string;
};

export type CommunicationDetailPayload = {
  communication: CommunicationDetail;
  versions: CommunicationVersion[];
};

export type CommunicationMutationSummary = {
  id: string;
  status: CommunicationStatus;
  visibility: CommunicationVisibility;
  currentVersion: number;
  updatedAt: string;
};

export type CommunicationDraftMutationPayload = {
  communication: CommunicationMutationSummary;
  duplicate: boolean;
  version?: {
    id: string;
    version: number;
    status?: CommunicationVersionStatus;
    createdAt?: string;
    updatedAt?: string;
  };
};

export type CommunicationReviewPayload = {
  communication: CommunicationMutationSummary;
  duplicate: boolean;
  version?: CommunicationVersion;
};

export type CommunicationApprovalPayload = {
  communication: CommunicationMutationSummary & { approvedAt: string };
  duplicate: boolean;
  version?: {
    id: string;
    version: number;
    status: "approved";
    approvedAt: string;
  };
};

export type CommunicationPublicationPayload = {
  communication: {
    id: string;
    status: "published";
    visibility: "public";
    publicSlug: string;
    publishedAt: string;
  };
  duplicate: boolean;
};

export type CommunicationTemplateMutationPayload = {
  template: CommunicationTemplate;
};

export type CommunicationAssistPayload = {
  suggestion: CommunicationAssistSuggestion;
};

export type CommunicationRetryPayload = {
  allowed: true;
  reason: "manual_retry_allowed";
  created: boolean;
  duplicate: boolean;
};

function exactRecord(value: unknown, keys: readonly string[]): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index])
    ? value as Record<string, unknown>
    : null;
}

function boundedText(value: unknown, minimum: number, maximum: number): string | null {
  return typeof value === "string"
    && value.length >= minimum
    && value.length <= maximum
    && !CONTROL_PATTERN.test(value)
    ? value
    : null;
}

function timestamp(value: unknown): string | null {
  return typeof value === "string" && ISO_PATTERN.test(value) && Number.isFinite(Date.parse(value))
    ? value
    : null;
}

function integer(value: unknown, minimum = 1, maximum = 10_000): number | null {
  return typeof value === "number"
    && Number.isSafeInteger(value)
    && value >= minimum
    && value <= maximum
    ? value
    : null;
}

function normalizedText(value: unknown, minimum: number, maximum: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\r\n?/g, "\n");
  return normalized.length >= minimum
    && normalized.length <= maximum
    && !CONTROL_PATTERN.test(normalized)
    ? normalized
    : null;
}

function parseTextList(value: unknown, maximumItems: number, maximumLength: number): string[] | null {
  if (!Array.isArray(value) || value.length > maximumItems) return null;
  const parsed: string[] = [];
  for (const item of value) {
    const text = normalizedText(item, 1, maximumLength);
    if (text === null) return null;
    parsed.push(text);
  }
  return parsed;
}

function parseAssistFacts(value: unknown): CommunicationRow["structuredFacts"] | null {
  const facts = exactRecord(value, ["dates", "times", "places", "documents", "actions"]);
  if (!facts) return null;
  const dates = parseTextList(facts.dates, 12, 160);
  const times = parseTextList(facts.times, 12, 120);
  const places = parseTextList(facts.places, 12, 180);
  const documents = parseTextList(facts.documents, 12, 180);
  const actions = parseTextList(facts.actions, 12, 240);
  return dates && times && places && documents && actions
    ? { dates, times, places, documents, actions }
    : null;
}

function parseMutationSummary(
  value: unknown,
  expectedId: string | null,
  statuses: readonly CommunicationStatus[]
): CommunicationMutationSummary | null {
  const row = exactRecord(value, ["id", "status", "visibility", "currentVersion", "updatedAt"]);
  if (!row || typeof row.id !== "string" || !UUID_PATTERN.test(row.id)) return null;
  if (expectedId !== null && row.id !== expectedId) return null;
  if (typeof row.status !== "string" || !statuses.includes(row.status as CommunicationStatus)) return null;
  if (
    typeof row.visibility !== "string"
    || !COMMUNICATION_VISIBILITIES.includes(row.visibility as CommunicationVisibility)
  ) return null;
  const currentVersion = integer(row.currentVersion);
  const updatedAt = timestamp(row.updatedAt);
  if (currentVersion === null || !updatedAt) return null;
  return {
    id: row.id,
    status: row.status as CommunicationStatus,
    visibility: row.visibility as CommunicationVisibility,
    currentVersion,
    updatedAt,
  };
}

function parseFullVersion(value: unknown): CommunicationVersion | null {
  const row = exactRecord(value, ["id", "version", "status", "createdAt", "updatedAt"]);
  if (!row || typeof row.id !== "string" || !UUID_PATTERN.test(row.id)) return null;
  const version = integer(row.version);
  const createdAt = timestamp(row.createdAt);
  const updatedAt = timestamp(row.updatedAt);
  if (
    version === null
    || typeof row.status !== "string"
    || !VERSION_STATUSES.includes(row.status as CommunicationVersionStatus)
    || !createdAt
    || !updatedAt
    || Date.parse(updatedAt) < Date.parse(createdAt)
  ) return null;
  return {
    id: row.id,
    version,
    status: row.status as CommunicationVersionStatus,
    createdAt,
    updatedAt,
  };
}

export function parseCommunicationDetailPayload(
  value: unknown,
  expectedId: string
): CommunicationDetailPayload | null {
  if (!UUID_PATTERN.test(expectedId)) return null;
  const root = exactRecord(value, ["communication", "versions"]);
  const communicationInput = root && exactRecord(root.communication, [
    "id",
    "status",
    "visibility",
    "category",
    "templateKey",
    "publicSlug",
    "currentVersion",
    "publishedAt",
    "updatedAt",
    "title",
    "summary",
    "bodyMarkdown",
    "structuredFacts",
    "openQuestions",
  ]);
  if (!root || !communicationInput || !Array.isArray(root.versions)) return null;
  const bodyMarkdown = boundedText(communicationInput.bodyMarkdown, 1, 100_000);
  if (!bodyMarkdown || detectForbiddenSupportSecret(bodyMarkdown)) return null;
  const base = { ...communicationInput };
  delete base.bodyMarkdown;
  const parsedBase = parseCommunicationsPayload({ communications: [base] })?.communications[0] ?? null;
  if (!parsedBase || parsedBase.id !== expectedId) return null;
  if (
    root.versions.length < 1
    || root.versions.length !== Math.min(parsedBase.currentVersion, 100)
  ) return null;

  const ids = new Set<string>();
  const versions: CommunicationVersion[] = [];
  for (let index = 0; index < root.versions.length; index += 1) {
    const version = parseFullVersion(root.versions[index]);
    if (
      !version
      || ids.has(version.id)
      || version.version !== parsedBase.currentVersion - index
    ) return null;
    ids.add(version.id);
    versions.push(version);
  }
  const currentStatus = versions[0]?.status;
  if (
    ((parsedBase.status === "draft" || parsedBase.status === "review" || parsedBase.status === "approved")
      && currentStatus !== parsedBase.status)
    || (parsedBase.status === "published" && currentStatus !== "approved" && currentStatus !== "published")
  ) return null;
  return { communication: { ...parsedBase, bodyMarkdown }, versions };
}

function parseDraftVersion(
  value: unknown,
  variant: "create" | "update_duplicate" | "update_created",
  currentVersion: number
): CommunicationDraftMutationPayload["version"] | null {
  const keys = variant === "create"
    ? ["id", "version"]
    : variant === "update_duplicate"
      ? ["id", "version", "status"]
      : ["id", "version", "status", "createdAt", "updatedAt"];
  const row = exactRecord(value, keys);
  if (!row || typeof row.id !== "string" || !UUID_PATTERN.test(row.id)) return null;
  const version = integer(row.version);
  if (version !== currentVersion) return null;
  if (variant === "create") return { id: row.id, version };
  if (row.status !== "draft") return null;
  if (variant === "update_duplicate") return { id: row.id, version, status: "draft" };
  const createdAt = timestamp(row.createdAt);
  const updatedAt = timestamp(row.updatedAt);
  if (!createdAt || !updatedAt || Date.parse(updatedAt) < Date.parse(createdAt)) return null;
  return { id: row.id, version, status: "draft", createdAt, updatedAt };
}

export function parseCommunicationDraftMutationPayload(
  value: unknown,
  expectedId: string | null
): CommunicationDraftMutationPayload | null {
  if (expectedId !== null && !UUID_PATTERN.test(expectedId)) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const loose = value as Record<string, unknown>;
  if (typeof loose.duplicate !== "boolean") return null;
  const requiresVersion = expectedId !== null || loose.duplicate === false;
  const root = exactRecord(value, requiresVersion
    ? ["communication", "version", "duplicate"]
    : ["communication", "duplicate"]);
  if (!root) return null;
  const communication = parseMutationSummary(
    root.communication,
    expectedId,
    expectedId === null && loose.duplicate
      ? COMMUNICATION_STATUSES
      : ["draft"]
  );
  if (!communication) return null;
  if (!loose.duplicate && expectedId === null
    && (communication.visibility !== "internal" || communication.currentVersion !== 1)) return null;
  if (expectedId !== null && communication.visibility !== "internal") return null;
  if (!requiresVersion) return { communication, duplicate: true };
  const variant = expectedId === null
    ? "create"
    : loose.duplicate
      ? "update_duplicate"
      : "update_created";
  const version = parseDraftVersion(root.version, variant, communication.currentVersion);
  return version ? { communication, version, duplicate: loose.duplicate } : null;
}

export function parseCommunicationReviewPayload(
  value: unknown,
  expectedId: string,
  expectedVisibility: "internal" | "public"
): CommunicationReviewPayload | null {
  if (!UUID_PATTERN.test(expectedId)) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const loose = value as Record<string, unknown>;
  if (typeof loose.duplicate !== "boolean") return null;
  const root = exactRecord(value, loose.duplicate
    ? ["communication", "duplicate"]
    : ["communication", "version", "duplicate"]);
  if (!root) return null;
  const communication = parseMutationSummary(root.communication, expectedId, ["review"]);
  if (!communication || communication.visibility !== expectedVisibility) return null;
  if (loose.duplicate) return { communication, duplicate: true };
  const version = parseFullVersion(root.version);
  return version && version.version === communication.currentVersion && version.status === "review"
    ? { communication, version, duplicate: false }
    : null;
}

export function parseCommunicationApprovalPayload(
  value: unknown,
  expectedId: string
): CommunicationApprovalPayload | null {
  if (!UUID_PATTERN.test(expectedId) || !value || typeof value !== "object" || Array.isArray(value)) return null;
  const loose = value as Record<string, unknown>;
  if (typeof loose.duplicate !== "boolean") return null;
  const root = exactRecord(value, loose.duplicate
    ? ["communication", "duplicate"]
    : ["communication", "version", "duplicate"]);
  const communicationInput = root && exactRecord(root.communication, [
    "id", "status", "visibility", "currentVersion", "approvedAt", "updatedAt",
  ]);
  if (!root || !communicationInput) return null;
  const summaryInput = { ...communicationInput };
  delete summaryInput.approvedAt;
  const communication = parseMutationSummary(
    summaryInput,
    expectedId,
    loose.duplicate ? ["approved", "published"] : ["approved"]
  );
  const approvedAt = timestamp(communicationInput.approvedAt);
  if (!communication || !approvedAt) return null;
  if (communication.status === "published" && communication.visibility !== "public") return null;
  const approvedCommunication = { ...communication, approvedAt };
  if (loose.duplicate) return { communication: approvedCommunication, duplicate: true };
  const versionInput = exactRecord(root.version, ["id", "version", "status", "approvedAt"]);
  if (!versionInput || typeof versionInput.id !== "string" || !UUID_PATTERN.test(versionInput.id)) return null;
  const version = integer(versionInput.version);
  const versionApprovedAt = timestamp(versionInput.approvedAt);
  if (
    version !== communication.currentVersion
    || versionInput.status !== "approved"
    || !versionApprovedAt
    || versionApprovedAt !== approvedAt
  ) return null;
  return {
    communication: approvedCommunication,
    version: { id: versionInput.id, version, status: "approved", approvedAt: versionApprovedAt },
    duplicate: false,
  };
}

export function parseCommunicationPublicationPayload(
  value: unknown,
  expectedId: string
): CommunicationPublicationPayload | null {
  if (!UUID_PATTERN.test(expectedId)) return null;
  const root = exactRecord(value, ["communication", "duplicate"]);
  const communication = root && exactRecord(root.communication, [
    "id", "status", "visibility", "publicSlug", "publishedAt",
  ]);
  if (
    !root
    || !communication
    || typeof root.duplicate !== "boolean"
    || communication.id !== expectedId
    || communication.status !== "published"
    || communication.visibility !== "public"
    || typeof communication.publicSlug !== "string"
    || !PUBLIC_SLUG_PATTERN.test(communication.publicSlug)
  ) return null;
  const publishedAt = timestamp(communication.publishedAt);
  return publishedAt
    ? {
      communication: {
        id: expectedId,
        status: "published",
        visibility: "public",
        publicSlug: communication.publicSlug,
        publishedAt,
      },
      duplicate: root.duplicate,
    }
    : null;
}

export function parseCommunicationTemplateMutationPayload(
  value: unknown,
  expectedInput: unknown
): CommunicationTemplateMutationPayload | null {
  let expected: CommunicationTemplateInput;
  try {
    expected = parseCommunicationTemplateInput(expectedInput);
  } catch {
    return null;
  }
  const root = exactRecord(value, ["template"]);
  const template = root && exactRecord(root.template, [
    "id",
    "templateKey",
    "label",
    "defaultCategory",
    "titleHint",
    "summaryHint",
    "bodyMarkdown",
    "active",
    "version",
    "updatedAt",
    "customized",
  ]);
  if (
    !root
    || !template
    || typeof template.id !== "string"
    || !UUID_PATTERN.test(template.id)
    || template.customized !== true
  ) return null;
  let actual: CommunicationTemplateInput;
  try {
    actual = parseCommunicationTemplateInput({
      templateKey: template.templateKey,
      label: template.label,
      defaultCategory: template.defaultCategory,
      titleHint: template.titleHint,
      summaryHint: template.summaryHint,
      bodyMarkdown: template.bodyMarkdown,
      active: template.active,
    });
  } catch {
    return null;
  }
  if (JSON.stringify(actual) !== JSON.stringify(expected)) return null;
  const version = integer(template.version);
  const updatedAt = timestamp(template.updatedAt);
  if (version === null || !updatedAt) return null;
  return {
    template: {
      id: template.id,
      ...actual,
      version,
      updatedAt,
      customized: true,
    },
  };
}

export function parseCommunicationAssistPayload(
  value: unknown,
  requestInput: unknown
): CommunicationAssistPayload | null {
  const request = exactRecord(requestInput, [
    "action", "title", "summary", "bodyMarkdown", "category", "templateKey",
  ]);
  if (
    !request
    || (request.action !== "structure" && request.action !== "correct" && request.action !== "simplify")
    || normalizedText(request.title, 2, 180) === null
    || normalizedText(request.summary, 0, 1_000) === null
    || normalizedText(request.bodyMarkdown, 1, 100_000) === null
    || typeof request.category !== "string"
    || !/^[a-z][a-z0-9_-]{1,39}$/.test(request.category)
    || !(request.templateKey === null || (
      typeof request.templateKey === "string"
      && COMMUNICATION_TEMPLATE_KEYS.includes(request.templateKey as (typeof COMMUNICATION_TEMPLATE_KEYS)[number])
    ))
    || detectForbiddenSupportSecret([
      request.title,
      request.summary,
      request.bodyMarkdown,
    ].join("\n"))
  ) return null;
  const root = exactRecord(value, ["suggestion"]);
  const suggestion = root && exactRecord(root.suggestion, [
    "title", "summary", "bodyMarkdown", "structuredFacts", "openQuestions", "reviewNotes",
  ]);
  if (!root || !suggestion) return null;
  const title = normalizedText(suggestion.title, 2, 180);
  const summary = normalizedText(suggestion.summary, 0, 1_000);
  const bodyMarkdown = normalizedText(suggestion.bodyMarkdown, 1, 100_000);
  const structuredFacts = parseAssistFacts(suggestion.structuredFacts);
  const openQuestions = parseTextList(suggestion.openQuestions, 12, 300);
  const reviewNotes = parseTextList(suggestion.reviewNotes, 8, 300);
  if (
    title === null
    || summary === null
    || bodyMarkdown === null
    || !structuredFacts
    || !openQuestions
    || !reviewNotes
    || detectForbiddenSupportSecret([
      title,
      summary,
      bodyMarkdown,
      ...structuredFacts.dates,
      ...structuredFacts.times,
      ...structuredFacts.places,
      ...structuredFacts.documents,
      ...structuredFacts.actions,
      ...openQuestions,
      ...reviewNotes,
    ].join("\n"))
  ) return null;
  return {
    suggestion: { title, summary, bodyMarkdown, structuredFacts, openQuestions, reviewNotes },
  };
}

export function parseCommunicationRetryPayload(value: unknown): CommunicationRetryPayload | null {
  const root = exactRecord(value, ["allowed", "reason", "created", "duplicate"]);
  if (
    !root
    || root.allowed !== true
    || root.reason !== "manual_retry_allowed"
    || typeof root.created !== "boolean"
    || typeof root.duplicate !== "boolean"
    || root.created === root.duplicate
  ) return null;
  return {
    allowed: true,
    reason: "manual_retry_allowed",
    created: root.created,
    duplicate: root.duplicate,
  };
}
