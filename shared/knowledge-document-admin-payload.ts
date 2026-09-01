import {
  KNOWLEDGE_DOCUMENT_MAX_BYTES,
  KNOWLEDGE_DOCUMENT_MIME_TYPES,
  KNOWLEDGE_DOCUMENT_TYPES,
  type KnowledgeDocumentInput,
} from "./knowledge-document-input.js";
import { SUPPORT_SERVICES, type SupportService } from "./support-agent-access.js";
import type { KnowledgeClassification } from "./skill-registry-policy.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UUID_FRAGMENT = UUID_PATTERN.source.slice(1, -1);
const DATE_PATTERN = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;
const ISO_PATTERN = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$/;
const CONTROL_PATTERN = /[\u0000-\u001f\u007f]/;
const SIGNED_TOKEN_PATTERN = /^[A-Za-z0-9._-]{20,8192}$/;
const CLASSIFICATIONS = ["public", "internal", "personal", "sensitive"] as const;
const PURGE_STATUSES = ["blocked", "scheduled", "processing", "failed", "purged"] as const;

export const KNOWLEDGE_DOCUMENT_BUCKET = "knowledge-ingest";
export const KNOWLEDGE_DOCUMENT_SIGNED_URL_SECONDS = 60;
export const KNOWLEDGE_DOCUMENT_STATUSES = [
  "reserved",
  "uploaded",
  "quarantined",
  "processing",
  "review",
  "ready",
  "rejected",
  "failed",
  "purged",
] as const;

export type KnowledgeDocumentStatus = (typeof KNOWLEDGE_DOCUMENT_STATUSES)[number];
export type KnowledgeDocumentReviewProposal = {
  overview: string;
  keyPoints: string[];
  rules: string[];
  prohibitions: string[];
  datedStatements: string[];
  conflicts: Array<{ first: string; second: string }>;
  questions: string[];
  instructionSignals: string[];
};
export type KnowledgeDocumentPayload = {
  id: string;
  title: string;
  purposeDescription: string;
  sourceType: (typeof KNOWLEDGE_DOCUMENT_TYPES)[number];
  classification: KnowledgeClassification;
  ownerServiceCode: SupportService;
  serviceCodes: SupportService[];
  validFrom: string;
  reviewDueAt: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  status: KnowledgeDocumentStatus;
  retentionPolicyKey: "pending_dpo" | "approved";
  retentionUntil: string | null;
  purgeStatus: (typeof PURGE_STATUSES)[number];
  purgedAt: string | null;
  analysisSummary: string | null;
  analysisError: string | null;
  reviewProposal: KnowledgeDocumentReviewProposal | null;
  sourceId: string | null;
  excerptCount: number;
  createdAt: string;
  uploadedAt: string | null;
};

type ReservationDocument = {
  id: string;
  status: "reserved";
  originalName: string;
  mimeType: string;
  sizeBytes: number;
};

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function exactRecord(value: unknown, keys: readonly string[]): Record<string, unknown> | null {
  const candidate = record(value);
  if (!candidate) return null;
  const actual = Object.keys(candidate).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length
    && actual.every((key, index) => key === expected[index])
    ? candidate
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

function calendarDate(value: unknown): string | null {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
    ? value
    : null;
}

function timestamp(value: unknown): string | null {
  if (typeof value !== "string" || !ISO_PATTERN.test(value)) return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value ? value : null;
}

function nullableTimestamp(value: unknown): string | null | undefined {
  if (value === null) return null;
  return timestamp(value) ?? undefined;
}

function isoValue(value: unknown): unknown {
  return value instanceof Date ? value.toISOString() : value;
}

function parseServiceCodes(value: unknown): SupportService[] | null {
  if (!Array.isArray(value) || value.length > SUPPORT_SERVICES.length) return null;
  const services: SupportService[] = [];
  for (const service of value) {
    if (
      typeof service !== "string"
      || !SUPPORT_SERVICES.includes(service as SupportService)
      || services.includes(service as SupportService)
    ) return null;
    services.push(service as SupportService);
  }
  return services;
}

function parseProposalList(value: unknown, maximum: number): string[] | null {
  if (!Array.isArray(value) || value.length > maximum) return null;
  const result: string[] = [];
  for (const item of value) {
    const text = boundedText(item, 1, 320);
    if (!text || result.includes(text)) return null;
    result.push(text);
  }
  return result;
}

function parseReviewProposal(value: unknown): KnowledgeDocumentReviewProposal | null | undefined {
  if (value === null) return null;
  const row = exactRecord(value, [
    "overview",
    "keyPoints",
    "rules",
    "prohibitions",
    "datedStatements",
    "conflicts",
    "questions",
    "instructionSignals",
  ]);
  const overview = row ? boundedText(row.overview, 0, 640) : null;
  const keyPoints = row ? parseProposalList(row.keyPoints, 6) : null;
  const rules = row ? parseProposalList(row.rules, 6) : null;
  const prohibitions = row ? parseProposalList(row.prohibitions, 6) : null;
  const datedStatements = row ? parseProposalList(row.datedStatements, 6) : null;
  const questions = row ? parseProposalList(row.questions, 6) : null;
  const instructionSignals = row ? parseProposalList(row.instructionSignals, 4) : null;
  if (
    !row
    || overview === null
    || !keyPoints
    || !rules
    || !prohibitions
    || !datedStatements
    || !questions
    || !instructionSignals
    || !Array.isArray(row.conflicts)
    || row.conflicts.length > 4
  ) return undefined;
  const allowedSignals = new Set([
    "reserved_prompt_marker",
    "instruction_override",
    "system_prompt_request",
    "role_impersonation",
  ]);
  if (instructionSignals.some((signal) => !allowedSignals.has(signal))) return undefined;
  const conflicts: Array<{ first: string; second: string }> = [];
  for (const value of row.conflicts) {
    const conflict = exactRecord(value, ["first", "second"]);
    const first = conflict ? boundedText(conflict.first, 1, 320) : null;
    const second = conflict ? boundedText(conflict.second, 1, 320) : null;
    if (!first || !second) return undefined;
    conflicts.push({ first, second });
  }
  if (
    overview.length === 0
    && keyPoints.length === 0
    && rules.length === 0
    && prohibitions.length === 0
    && datedStatements.length === 0
    && conflicts.length === 0
    && questions.length === 0
    && instructionSignals.length === 0
  ) return undefined;
  return {
    overview,
    keyPoints,
    rules,
    prohibitions,
    datedStatements,
    conflicts,
    questions,
    instructionSignals,
  };
}

function parseDocument(value: unknown): KnowledgeDocumentPayload | null {
  const row = exactRecord(value, [
    "id",
    "title",
    "purposeDescription",
    "sourceType",
    "classification",
    "ownerServiceCode",
    "serviceCodes",
    "validFrom",
    "reviewDueAt",
    "originalName",
    "mimeType",
    "sizeBytes",
    "status",
    "retentionPolicyKey",
    "retentionUntil",
    "purgeStatus",
    "purgedAt",
    "analysisSummary",
    "analysisError",
    "reviewProposal",
    "sourceId",
    "excerptCount",
    "createdAt",
    "uploadedAt",
  ]);
  if (!row || typeof row.id !== "string" || !UUID_PATTERN.test(row.id)) return null;
  const title = boundedText(row.title, 2, 180);
  const purposeDescription = boundedText(row.purposeDescription, 20, 4_000);
  const services = parseServiceCodes(row.serviceCodes);
  const validFrom = calendarDate(row.validFrom);
  const reviewDueAt = timestamp(row.reviewDueAt);
  const originalName = boundedText(row.originalName, 1, 255);
  const retentionUntil = nullableTimestamp(row.retentionUntil);
  const purgedAt = nullableTimestamp(row.purgedAt);
  const analysisSummary = row.analysisSummary === null ? null : boundedText(row.analysisSummary, 1, 2_000);
  const analysisError = row.analysisError === null ? null : boundedText(row.analysisError, 1, 1_000);
  const proposal = parseReviewProposal(row.reviewProposal);
  const createdAt = timestamp(row.createdAt);
  const uploadedAt = nullableTimestamp(row.uploadedAt);
  if (
    !title
    || !purposeDescription
    || !KNOWLEDGE_DOCUMENT_TYPES.includes(row.sourceType as (typeof KNOWLEDGE_DOCUMENT_TYPES)[number])
    || !CLASSIFICATIONS.includes(row.classification as KnowledgeClassification)
    || !SUPPORT_SERVICES.includes(row.ownerServiceCode as SupportService)
    || !services
    || !validFrom
    || !reviewDueAt
    || !originalName
    || typeof row.mimeType !== "string"
    || !Number.isSafeInteger(row.sizeBytes)
    || Number(row.sizeBytes) < 1
    || Number(row.sizeBytes) > KNOWLEDGE_DOCUMENT_MAX_BYTES
    || !KNOWLEDGE_DOCUMENT_STATUSES.includes(row.status as KnowledgeDocumentStatus)
    || (row.retentionPolicyKey !== "pending_dpo" && row.retentionPolicyKey !== "approved")
    || !PURGE_STATUSES.includes(row.purgeStatus as (typeof PURGE_STATUSES)[number])
    || retentionUntil === undefined
    || purgedAt === undefined
    || (row.analysisSummary !== null && analysisSummary === null)
    || (row.analysisError !== null && analysisError === null)
    || proposal === undefined
    || !(row.sourceId === null || (typeof row.sourceId === "string" && UUID_PATTERN.test(row.sourceId)))
    || !Number.isSafeInteger(row.excerptCount)
    || Number(row.excerptCount) < 0
    || Number(row.excerptCount) > 10_000
    || !createdAt
    || uploadedAt === undefined
  ) return null;
  const status = row.status as KnowledgeDocumentStatus;
  if (reviewDueAt.slice(0, 10) < validFrom) return null;
  if (row.classification === "public" && services.length > 0) return null;
  if (uploadedAt !== null && Date.parse(uploadedAt) < Date.parse(createdAt)) return null;
  if (status === "reserved" && (uploadedAt !== null || row.sourceId !== null || Number(row.excerptCount) !== 0)) return null;
  if (status === "ready" && row.sourceId === null) return null;
  if (status !== "ready" && row.sourceId !== null) return null;
  if (status !== "review" && proposal !== null) return null;
  if (row.retentionPolicyKey === "pending_dpo" && (retentionUntil !== null || row.purgeStatus !== "blocked")) return null;
  if ((row.purgeStatus === "purged") !== (purgedAt !== null) || (status === "purged") !== (row.purgeStatus === "purged")) return null;
  if (
    status === "purged"
      ? row.mimeType !== "application/octet-stream"
      : !KNOWLEDGE_DOCUMENT_MIME_TYPES.includes(row.mimeType as (typeof KNOWLEDGE_DOCUMENT_MIME_TYPES)[number])
  ) return null;
  return {
    id: row.id,
    title,
    purposeDescription,
    sourceType: row.sourceType as (typeof KNOWLEDGE_DOCUMENT_TYPES)[number],
    classification: row.classification as KnowledgeClassification,
    ownerServiceCode: row.ownerServiceCode as SupportService,
    serviceCodes: services,
    validFrom,
    reviewDueAt,
    originalName,
    mimeType: row.mimeType,
    sizeBytes: Number(row.sizeBytes),
    status,
    retentionPolicyKey: row.retentionPolicyKey,
    retentionUntil,
    purgeStatus: row.purgeStatus as (typeof PURGE_STATUSES)[number],
    purgedAt,
    analysisSummary,
    analysisError,
    reviewProposal: proposal,
    sourceId: row.sourceId as string | null,
    excerptCount: Number(row.excerptCount),
    createdAt,
    uploadedAt,
  };
}

export function projectKnowledgeDocumentPayload(value: unknown): KnowledgeDocumentPayload {
  const row = record(value);
  const projected = row ? parseDocument({
    id: row.id,
    title: row.title,
    purposeDescription: row.purposeDescription,
    sourceType: row.sourceType,
    classification: row.classification,
    ownerServiceCode: row.ownerServiceCode,
    serviceCodes: row.serviceCodes,
    validFrom: row.validFrom,
    reviewDueAt: isoValue(row.reviewDueAt),
    originalName: row.originalName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    status: row.status,
    retentionPolicyKey: row.retentionPolicyKey,
    retentionUntil: isoValue(row.retentionUntil),
    purgeStatus: row.purgeStatus,
    purgedAt: isoValue(row.purgedAt),
    analysisSummary: row.analysisSummary,
    analysisError: row.analysisError,
    reviewProposal: row.reviewProposal,
    sourceId: row.sourceId,
    excerptCount: row.excerptCount,
    createdAt: isoValue(row.createdAt),
    uploadedAt: isoValue(row.uploadedAt),
  }) : null;
  if (!projected) throw new Error("Invalid knowledge document projection");
  return projected;
}

export function parseKnowledgeDocumentListPayload(value: unknown): { documents: KnowledgeDocumentPayload[] } | null {
  const root = exactRecord(value, ["documents"]);
  if (!root || !Array.isArray(root.documents) || root.documents.length > 200) return null;
  const ids = new Set<string>();
  const documents: KnowledgeDocumentPayload[] = [];
  let previousTime = Number.POSITIVE_INFINITY;
  for (const value of root.documents) {
    const document = parseDocument(value);
    const created = document ? Date.parse(document.createdAt) : Number.NaN;
    if (!document || ids.has(document.id) || created > previousTime) return null;
    ids.add(document.id);
    documents.push(document);
    previousTime = created;
  }
  return { documents };
}

function reservationDocument(value: unknown): ReservationDocument | null {
  const row = exactRecord(value, ["id", "status", "originalName", "mimeType", "sizeBytes"]);
  return row
    && typeof row.id === "string"
    && UUID_PATTERN.test(row.id)
    && row.status === "reserved"
    && boundedText(row.originalName, 1, 255)
    && KNOWLEDGE_DOCUMENT_MIME_TYPES.includes(row.mimeType as (typeof KNOWLEDGE_DOCUMENT_MIME_TYPES)[number])
    && Number.isSafeInteger(row.sizeBytes)
    && Number(row.sizeBytes) >= 1
    && Number(row.sizeBytes) <= KNOWLEDGE_DOCUMENT_MAX_BYTES
    ? {
        id: row.id,
        status: "reserved",
        originalName: String(row.originalName),
        mimeType: row.mimeType as string,
        sizeBytes: Number(row.sizeBytes),
      }
    : null;
}

export function projectKnowledgeDocumentReservation(value: unknown): ReservationDocument {
  const row = record(value);
  const projected = row ? reservationDocument({
    id: row.id,
    status: row.status,
    originalName: row.originalName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
  }) : null;
  if (!projected) throw new Error("Invalid knowledge document reservation projection");
  return projected;
}

export function parseKnowledgeDocumentReservationPayload(
  value: unknown,
  expected: KnowledgeDocumentInput
): { document: ReservationDocument; upload: { bucket: string; path: string; token: string } } | null {
  const root = exactRecord(value, ["document", "upload"]);
  const document = root ? reservationDocument(root.document) : null;
  const upload = root ? exactRecord(root.upload, ["bucket", "path", "token"]) : null;
  if (
    !document
    || !upload
    || document.originalName !== expected.originalName
    || document.mimeType !== expected.mimeType
    || document.sizeBytes !== expected.sizeBytes
    || upload.bucket !== KNOWLEDGE_DOCUMENT_BUCKET
    || typeof upload.path !== "string"
    || typeof upload.token !== "string"
    || !SIGNED_TOKEN_PATTERN.test(upload.token)
  ) return null;
  const rawExtension = expected.originalName.includes(".")
    ? expected.originalName.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10)
    : "bin";
  const extension = rawExtension || "bin";
  const pathPattern = new RegExp(
    `^${UUID_FRAGMENT}/${UUID_FRAGMENT}/[0-9]{4}/(?:0[1-9]|1[0-2])/${UUID_FRAGMENT}\\.${extension}$`,
    "i"
  );
  if (!pathPattern.test(upload.path)) return null;
  return {
    document,
    upload: { bucket: KNOWLEDGE_DOCUMENT_BUCKET, path: upload.path, token: upload.token },
  };
}

export function projectKnowledgeDocumentConfirmation(
  value: unknown,
  duplicate: boolean
): { documentId: string; status: KnowledgeDocumentStatus; duplicate: boolean } {
  const row = record(value);
  if (
    !row
    || typeof row.id !== "string"
    || !UUID_PATTERN.test(row.id)
    || typeof row.status !== "string"
    || !KNOWLEDGE_DOCUMENT_STATUSES.includes(row.status as KnowledgeDocumentStatus)
  ) throw new Error("Invalid knowledge document confirmation projection");
  return { documentId: row.id, status: row.status as KnowledgeDocumentStatus, duplicate };
}

export function parseKnowledgeDocumentConfirmationPayload(
  value: unknown,
  expectedId: string
): { documentId: string; status: KnowledgeDocumentStatus; duplicate: boolean } | null {
  const root = exactRecord(value, ["documentId", "status", "duplicate"]);
  if (
    !root
    || root.documentId !== expectedId
    || typeof root.duplicate !== "boolean"
    || typeof root.status !== "string"
    || !KNOWLEDGE_DOCUMENT_STATUSES.includes(root.status as KnowledgeDocumentStatus)
  ) return null;
  const status = root.status as KnowledgeDocumentStatus;
  if (root.duplicate ? !["quarantined", "processing", "review", "ready"].includes(status) : status !== "quarantined") {
    return null;
  }
  return { documentId: expectedId, status, duplicate: root.duplicate };
}

export function projectKnowledgeDocumentReviewReceipt(
  value: unknown,
  action: "approve" | "reject",
  duplicate: boolean
): { documentId: string; action: "approve" | "reject"; status: "ready" | "rejected"; sourceId: string | null; duplicate: boolean } {
  const row = record(value);
  if (!row || typeof row.id !== "string" || !UUID_PATTERN.test(row.id)) {
    throw new Error("Invalid knowledge document review projection");
  }
  const status = action === "approve" ? "ready" : "rejected";
  const sourceId = action === "approve" && typeof row.sourceId === "string" && UUID_PATTERN.test(row.sourceId)
    ? row.sourceId
    : null;
  if (row.status !== status || (action === "approve" && !sourceId) || (action === "reject" && duplicate)) {
    throw new Error("Invalid knowledge document review projection");
  }
  return { documentId: row.id, action, status, sourceId, duplicate };
}

export function parseKnowledgeDocumentReviewPayload(
  value: unknown,
  expectedId: string,
  expectedAction: "approve" | "reject"
): { documentId: string; action: "approve" | "reject"; status: "ready" | "rejected"; sourceId: string | null; duplicate: boolean } | null {
  const root = exactRecord(value, ["documentId", "action", "status", "sourceId", "duplicate"]);
  if (
    !root
    || root.documentId !== expectedId
    || root.action !== expectedAction
    || typeof root.duplicate !== "boolean"
  ) return null;
  if (expectedAction === "reject") {
    return root.status === "rejected" && root.sourceId === null && root.duplicate === false
      ? { documentId: expectedId, action: "reject", status: "rejected", sourceId: null, duplicate: false }
      : null;
  }
  return root.status === "ready"
    && typeof root.sourceId === "string"
    && UUID_PATTERN.test(root.sourceId)
    ? { documentId: expectedId, action: "approve", status: "ready", sourceId: root.sourceId, duplicate: root.duplicate }
    : null;
}

export function parseKnowledgeDocumentDownloadPayload(
  value: unknown,
  expectedOrigin: string
): { url: string; expiresInSeconds: number } | null {
  const root = exactRecord(value, ["url", "expiresInSeconds"]);
  if (
    !root
    || root.expiresInSeconds !== KNOWLEDGE_DOCUMENT_SIGNED_URL_SECONDS
    || typeof root.url !== "string"
    || root.url.length > 8_192
  ) return null;
  let url: URL;
  try {
    url = new URL(root.url);
  } catch {
    return null;
  }
  const entries = [...url.searchParams.entries()];
  const tokens = entries.filter(([key]) => key === "token");
  const downloads = entries.filter(([key]) => key === "download");
  const token = tokens[0]?.[1];
  const download = downloads[0]?.[1];
  const pathPattern = new RegExp(
    `^/storage/v1/object/sign/${KNOWLEDGE_DOCUMENT_BUCKET}/${UUID_FRAGMENT}/${UUID_FRAGMENT}/[0-9]{4}/(?:0[1-9]|1[0-2])/${UUID_FRAGMENT}\\.[a-z0-9]{1,10}$`,
    "i"
  );
  if (
    url.protocol !== "https:"
    || url.origin !== expectedOrigin
    || url.username
    || url.password
    || url.hash
    || !pathPattern.test(url.pathname)
    || tokens.length !== 1
    || !token
    || !SIGNED_TOKEN_PATTERN.test(token)
    || downloads.length > 1
    || entries.length !== 1 + downloads.length
    || (download !== undefined && !boundedText(download, 1, 180))
  ) return null;
  return { url: url.toString(), expiresInSeconds: KNOWLEDGE_DOCUMENT_SIGNED_URL_SECONDS };
}
