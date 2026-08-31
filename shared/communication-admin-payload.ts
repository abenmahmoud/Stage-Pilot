import {
  COMMUNICATION_TEMPLATE_CATALOG,
  COMMUNICATION_TEMPLATE_KEYS,
  type CommunicationTemplateKey,
} from "./communication-templates.js";
import { detectForbiddenSupportSecret } from "./support-secret-policy.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_PATTERN = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]{1,3})?Z$/;
const CATEGORY_PATTERN = /^[a-z][a-z0-9_-]{1,39}$/;
const PUBLIC_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{2,119}$/;
const ERROR_CODE_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9:_-]{1,79}$/;
const CONTROL_PATTERN = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

export const COMMUNICATION_STATUSES = [
  "draft",
  "review",
  "approved",
  "published",
  "archived",
  "cancelled",
] as const;

export const COMMUNICATION_VISIBILITIES = ["public", "internal", "targeted"] as const;
export const COMMUNICATION_INBOUND_STATUSES = ["received", "review", "error"] as const;
export const COMMUNICATION_INBOUND_CLASSIFICATIONS = [
  "withdrawal",
  "contact_correction",
  "question",
  "free_reply",
  "forwarded_source",
] as const;

type CommunicationStatus = (typeof COMMUNICATION_STATUSES)[number];
type CommunicationVisibility = (typeof COMMUNICATION_VISIBILITIES)[number];
type CommunicationInboundStatus = (typeof COMMUNICATION_INBOUND_STATUSES)[number];
type CommunicationInboundClassification = (typeof COMMUNICATION_INBOUND_CLASSIFICATIONS)[number];

export type StructuredFacts = {
  dates: string[];
  times: string[];
  places: string[];
  documents: string[];
  actions: string[];
};

export type CommunicationRow = {
  id: string;
  status: CommunicationStatus;
  visibility: CommunicationVisibility;
  category: string;
  templateKey: CommunicationTemplateKey | null;
  publicSlug: string | null;
  currentVersion: number;
  publishedAt: string | null;
  updatedAt: string;
  title: string;
  summary: string;
  structuredFacts: StructuredFacts;
  openQuestions: string[];
};

export type CommunicationsPayload = { communications: CommunicationRow[] };

export type CommunicationTemplate = {
  id: string | null;
  templateKey: CommunicationTemplateKey;
  label: string;
  defaultCategory: string;
  titleHint: string;
  summaryHint: string;
  bodyMarkdown: string;
  active: boolean;
  version: number;
  updatedAt: string | null;
  customized: boolean;
};

export type CommunicationTemplatesPayload = { templates: CommunicationTemplate[] };

export type CommunicationFailure = {
  id: string;
  jobType: "send_delivery" | "retry_delivery";
  attemptCount: number;
  failureCode: string | null;
  failedAt: string;
  title: string;
  version: number | null;
};

export type CommunicationFailuresPayload = { failures: CommunicationFailure[] };

export type CommunicationInbound = {
  id: string;
  communicationId: string | null;
  status: CommunicationInboundStatus;
  classification: CommunicationInboundClassification | null;
  receivedAt: string;
  title: string | null;
};

export type CommunicationInboundPayload = { inbound: CommunicationInbound[] };

function exactRecord(value: unknown, keys: readonly string[]): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    return null;
  }
  return value as Record<string, unknown>;
}

function boundedText(value: unknown, minimum: number, maximum: number): string | undefined {
  if (
    typeof value !== "string" ||
    value.length < minimum ||
    value.length > maximum ||
    CONTROL_PATTERN.test(value)
  ) return undefined;
  return value;
}

function timestamp(value: unknown): string | null {
  if (typeof value !== "string" || !ISO_PATTERN.test(value) || !Number.isFinite(Date.parse(value))) {
    return null;
  }
  return value;
}

function nullableTimestamp(value: unknown): string | null | undefined {
  if (value === null) return null;
  return timestamp(value) ?? undefined;
}

function integer(value: unknown, minimum: number, maximum: number): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= minimum && value <= maximum
    ? value
    : null;
}

function parseTextList(value: unknown, maximumItems: number, maximumLength: number): string[] | null {
  if (!Array.isArray(value) || value.length > maximumItems) return null;
  const values: string[] = [];
  for (const item of value) {
    const parsed = boundedText(item, 1, maximumLength);
    if (parsed === undefined) return null;
    values.push(parsed);
  }
  return values;
}

function parseStructuredFacts(value: unknown): StructuredFacts | null {
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

function containsSecret(values: readonly (string | null)[]): boolean {
  return Boolean(detectForbiddenSupportSecret(values.filter((value): value is string => value !== null).join("\n")));
}

export function parseCommunicationsPayload(value: unknown): CommunicationsPayload | null {
  const root = exactRecord(value, ["communications"]);
  if (!root || !Array.isArray(root.communications) || root.communications.length > 100) return null;

  const ids = new Set<string>();
  const communications: CommunicationRow[] = [];
  let previousUpdatedAt = Number.POSITIVE_INFINITY;
  for (const input of root.communications) {
    const row = exactRecord(input, [
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
      "structuredFacts",
      "openQuestions",
    ]);
    const currentVersion = row ? integer(row.currentVersion, 1, 10_000) : null;
    const publishedAt = row ? nullableTimestamp(row.publishedAt) : undefined;
    const updatedAt = row ? timestamp(row.updatedAt) : null;
    const title = row ? boundedText(row.title, 2, 180) : undefined;
    const summary = row ? boundedText(row.summary, 0, 1_000) : undefined;
    const structuredFacts = row ? parseStructuredFacts(row.structuredFacts) : null;
    const openQuestions = row ? parseTextList(row.openQuestions, 12, 300) : null;
    if (
      !row ||
      typeof row.id !== "string" ||
      !UUID_PATTERN.test(row.id) ||
      ids.has(row.id) ||
      typeof row.status !== "string" ||
      !COMMUNICATION_STATUSES.includes(row.status as CommunicationStatus) ||
      typeof row.visibility !== "string" ||
      !COMMUNICATION_VISIBILITIES.includes(row.visibility as CommunicationVisibility) ||
      typeof row.category !== "string" ||
      !CATEGORY_PATTERN.test(row.category) ||
      !(row.templateKey === null || (
        typeof row.templateKey === "string" &&
        COMMUNICATION_TEMPLATE_KEYS.includes(row.templateKey as CommunicationTemplateKey)
      )) ||
      !(row.publicSlug === null || (typeof row.publicSlug === "string" && PUBLIC_SLUG_PATTERN.test(row.publicSlug))) ||
      currentVersion === null ||
      publishedAt === undefined ||
      !updatedAt ||
      title === undefined ||
      summary === undefined ||
      !structuredFacts ||
      !openQuestions
    ) return null;

    const status = row.status as CommunicationStatus;
    const visibility = row.visibility as CommunicationVisibility;
    if (
      (status === "published" && (visibility !== "public" || publishedAt === null || row.publicSlug === null)) ||
      (publishedAt !== null && (visibility !== "public" || row.publicSlug === null)) ||
      (visibility !== "public" && (publishedAt !== null || row.publicSlug !== null)) ||
      Date.parse(updatedAt) > previousUpdatedAt ||
      containsSecret([
        title,
        summary,
        ...structuredFacts.dates,
        ...structuredFacts.times,
        ...structuredFacts.places,
        ...structuredFacts.documents,
        ...structuredFacts.actions,
        ...openQuestions,
      ])
    ) return null;

    ids.add(row.id);
    previousUpdatedAt = Date.parse(updatedAt);
    communications.push({
      id: row.id,
      status,
      visibility,
      category: row.category,
      templateKey: row.templateKey as CommunicationTemplateKey | null,
      publicSlug: row.publicSlug,
      currentVersion,
      publishedAt,
      updatedAt,
      title,
      summary,
      structuredFacts,
      openQuestions,
    });
  }
  return { communications };
}

export function parseCommunicationTemplatesPayload(value: unknown): CommunicationTemplatesPayload | null {
  const root = exactRecord(value, ["templates"]);
  if (!root || !Array.isArray(root.templates) || root.templates.length !== COMMUNICATION_TEMPLATE_KEYS.length) {
    return null;
  }

  const keys = new Set<string>();
  const templates: CommunicationTemplate[] = [];
  for (const input of root.templates) {
    const row = exactRecord(input, [
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
      !row ||
      typeof row.templateKey !== "string" ||
      !COMMUNICATION_TEMPLATE_KEYS.includes(row.templateKey as CommunicationTemplateKey) ||
      keys.has(row.templateKey) ||
      typeof row.active !== "boolean" ||
      typeof row.customized !== "boolean"
    ) return null;
    const templateKey = row.templateKey as CommunicationTemplateKey;
    const label = boundedText(row.label, 2, 80);
    const titleHint = boundedText(row.titleHint, 0, 180);
    const summaryHint = boundedText(row.summaryHint, 0, 1_000);
    const bodyMarkdown = boundedText(row.bodyMarkdown, 1, 20_000);
    const updatedAt = nullableTimestamp(row.updatedAt);
    const version = integer(row.version, 0, 10_000);
    if (
      label === undefined ||
      typeof row.defaultCategory !== "string" ||
      !CATEGORY_PATTERN.test(row.defaultCategory) ||
      titleHint === undefined ||
      summaryHint === undefined ||
      bodyMarkdown === undefined ||
      updatedAt === undefined ||
      version === null ||
      containsSecret([label, titleHint, summaryHint, bodyMarkdown])
    ) return null;

    if (row.customized) {
      if (typeof row.id !== "string" || !UUID_PATTERN.test(row.id) || version < 1 || updatedAt === null) return null;
    } else {
      const fallback = COMMUNICATION_TEMPLATE_CATALOG.find((item) => item.templateKey === templateKey);
      if (
        row.id !== null ||
        version !== 0 ||
        updatedAt !== null ||
        !fallback ||
        label !== fallback.label ||
        row.defaultCategory !== fallback.defaultCategory ||
        titleHint !== fallback.titleHint ||
        summaryHint !== fallback.summaryHint ||
        bodyMarkdown !== fallback.bodyMarkdown ||
        row.active !== fallback.active
      ) return null;
    }

    keys.add(templateKey);
    templates.push({
      id: row.id as string | null,
      templateKey,
      label,
      defaultCategory: row.defaultCategory,
      titleHint,
      summaryHint,
      bodyMarkdown,
      active: row.active,
      version,
      updatedAt,
      customized: row.customized,
    });
  }
  if (COMMUNICATION_TEMPLATE_KEYS.some((key) => !keys.has(key))) return null;
  return { templates };
}

export function parseCommunicationFailuresPayload(value: unknown): CommunicationFailuresPayload | null {
  const root = exactRecord(value, ["failures"]);
  if (!root || !Array.isArray(root.failures) || root.failures.length > 100) return null;
  const ids = new Set<string>();
  const failures: CommunicationFailure[] = [];
  let previousFailedAt = Number.POSITIVE_INFINITY;
  for (const input of root.failures) {
    const row = exactRecord(input, [
      "id", "jobType", "attemptCount", "failureCode", "failedAt", "title", "version",
    ]);
    const attemptCount = row ? integer(row.attemptCount, 0, 20) : null;
    const failedAt = row ? timestamp(row.failedAt) : null;
    const title = row ? boundedText(row.title, 2, 180) : undefined;
    const version = row?.version === null ? null : row ? integer(row.version, 1, 10_000) : null;
    if (
      !row ||
      typeof row.id !== "string" ||
      !UUID_PATTERN.test(row.id) ||
      ids.has(row.id) ||
      (row.jobType !== "send_delivery" && row.jobType !== "retry_delivery") ||
      attemptCount === null ||
      !(row.failureCode === null || (typeof row.failureCode === "string" && ERROR_CODE_PATTERN.test(row.failureCode))) ||
      !failedAt ||
      title === undefined ||
      !(row.version === null || version !== null) ||
      Date.parse(failedAt) > previousFailedAt ||
      containsSecret([title])
    ) return null;
    ids.add(row.id);
    previousFailedAt = Date.parse(failedAt);
    failures.push({
      id: row.id,
      jobType: row.jobType,
      attemptCount,
      failureCode: row.failureCode,
      failedAt,
      title,
      version,
    });
  }
  return { failures };
}

export function parseCommunicationInboundPayload(value: unknown): CommunicationInboundPayload | null {
  const root = exactRecord(value, ["inbound"]);
  if (!root || !Array.isArray(root.inbound) || root.inbound.length > 100) return null;
  const ids = new Set<string>();
  const inbound: CommunicationInbound[] = [];
  let previousReceivedAt = Number.POSITIVE_INFINITY;
  for (const input of root.inbound) {
    const row = exactRecord(input, [
      "id", "communicationId", "status", "classification", "receivedAt", "title",
    ]);
    const receivedAt = row ? timestamp(row.receivedAt) : null;
    const title = row?.title === null ? null : row ? boundedText(row.title, 2, 180) : undefined;
    if (
      !row ||
      typeof row.id !== "string" ||
      !UUID_PATTERN.test(row.id) ||
      ids.has(row.id) ||
      !(row.communicationId === null || (typeof row.communicationId === "string" && UUID_PATTERN.test(row.communicationId))) ||
      typeof row.status !== "string" ||
      !COMMUNICATION_INBOUND_STATUSES.includes(row.status as CommunicationInboundStatus) ||
      !(row.classification === null || (
        typeof row.classification === "string" &&
        COMMUNICATION_INBOUND_CLASSIFICATIONS.includes(row.classification as CommunicationInboundClassification)
      )) ||
      !receivedAt ||
      title === undefined ||
      (row.communicationId === null) !== (title === null) ||
      Date.parse(receivedAt) > previousReceivedAt ||
      containsSecret([title])
    ) return null;
    ids.add(row.id);
    previousReceivedAt = Date.parse(receivedAt);
    inbound.push({
      id: row.id,
      communicationId: row.communicationId,
      status: row.status as CommunicationInboundStatus,
      classification: row.classification as CommunicationInboundClassification | null,
      receivedAt,
      title,
    });
  }
  return { inbound };
}
