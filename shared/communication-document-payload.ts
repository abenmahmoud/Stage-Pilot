import {
  parseCommunicationDocumentInput,
  type CommunicationDocumentInput,
} from "./communication-document-input.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_PATTERN = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]{1,3})?Z$/;
const PRIVATE_PATH_PATTERN = /^private\/(?:20|21)[0-9]{2}\/(?:0[1-9]|1[0-2])\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(pdf|docx)$/i;
const SIGNED_TOKEN_PATTERN = /^[A-Za-z0-9._-]{20,8192}$/;
const CONTROL_PATTERN = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

export const COMMUNICATION_DOCUMENT_BUCKET = "communication-ingest";

export const COMMUNICATION_DOCUMENT_STATUSES = [
  "reserved",
  "uploaded",
  "quarantined",
  "processing",
  "review",
  "used",
  "rejected",
  "failed",
] as const;

export type CommunicationDocumentStatus = (typeof COMMUNICATION_DOCUMENT_STATUSES)[number];

export type CommunicationDocumentPayload = {
  id: string;
  communicationId: string | null;
  originalName: string;
  mimeType: CommunicationDocumentInput["mimeType"];
  sizeBytes: number;
  status: CommunicationDocumentStatus;
  analysisError: string | null;
  uploadedAt: string | null;
  analyzedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CommunicationDocumentListPayload = {
  documents: CommunicationDocumentPayload[];
};

export type CommunicationDocumentReservationPayload = {
  document: {
    id: string;
    originalName: string;
    mimeType: CommunicationDocumentInput["mimeType"];
    sizeBytes: number;
    status: "reserved";
    createdAt: string;
  };
  upload: {
    bucket: typeof COMMUNICATION_DOCUMENT_BUCKET;
    path: string;
    token: string;
  };
};

export type CommunicationDocumentConfirmationPayload = {
  document: CommunicationDocumentPayload;
  duplicate: boolean;
};

function exactRecord(value: unknown, keys: readonly string[]): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    return null;
  }
  return value as Record<string, unknown>;
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

function nullableText(value: unknown, maximum: number): string | null | undefined {
  if (value === null) return null;
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > maximum ||
    CONTROL_PATTERN.test(value)
  ) {
    return undefined;
  }
  return value;
}

function parseDocumentRecord(value: unknown): CommunicationDocumentPayload | null {
  const row = exactRecord(value, [
    "id",
    "communicationId",
    "originalName",
    "mimeType",
    "sizeBytes",
    "status",
    "analysisError",
    "uploadedAt",
    "analyzedAt",
    "createdAt",
    "updatedAt",
  ]);
  if (
    !row ||
    typeof row.id !== "string" ||
    !UUID_PATTERN.test(row.id) ||
    !(row.communicationId === null || (typeof row.communicationId === "string" && UUID_PATTERN.test(row.communicationId))) ||
    typeof row.status !== "string" ||
    !COMMUNICATION_DOCUMENT_STATUSES.includes(row.status as CommunicationDocumentStatus)
  ) return null;

  let metadata: CommunicationDocumentInput;
  try {
    metadata = parseCommunicationDocumentInput({
      originalName: row.originalName,
      mimeType: row.mimeType,
      sizeBytes: row.sizeBytes,
    });
  } catch {
    return null;
  }
  if (metadata.originalName !== row.originalName) return null;

  const analysisError = nullableText(row.analysisError, 1_000);
  const uploadedAt = nullableTimestamp(row.uploadedAt);
  const analyzedAt = nullableTimestamp(row.analyzedAt);
  const createdAt = timestamp(row.createdAt);
  const updatedAt = timestamp(row.updatedAt);
  if (
    analysisError === undefined ||
    uploadedAt === undefined ||
    analyzedAt === undefined ||
    !createdAt ||
    !updatedAt ||
    Date.parse(updatedAt) < Date.parse(createdAt) ||
    (uploadedAt !== null && Date.parse(uploadedAt) < Date.parse(createdAt)) ||
    (analyzedAt !== null && Date.parse(analyzedAt) < Date.parse(createdAt))
  ) return null;

  const status = row.status as CommunicationDocumentStatus;
  if ((status === "used") !== (row.communicationId !== null)) return null;
  if (status === "reserved" && (uploadedAt !== null || analyzedAt !== null || analysisError !== null)) {
    return null;
  }

  return {
    id: row.id,
    communicationId: row.communicationId,
    originalName: metadata.originalName,
    mimeType: metadata.mimeType,
    sizeBytes: metadata.sizeBytes,
    status,
    analysisError,
    uploadedAt,
    analyzedAt,
    createdAt,
    updatedAt,
  };
}

export function parseCommunicationDocumentListPayload(value: unknown): CommunicationDocumentListPayload | null {
  const root = exactRecord(value, ["documents"]);
  if (!root || !Array.isArray(root.documents) || root.documents.length > 100) return null;

  const ids = new Set<string>();
  const documents: CommunicationDocumentPayload[] = [];
  for (const value of root.documents) {
    const document = parseDocumentRecord(value);
    if (!document || ids.has(document.id)) return null;
    ids.add(document.id);
    documents.push(document);
  }
  return { documents };
}

export function parseCommunicationDocumentReservationPayload(
  value: unknown,
  expected: CommunicationDocumentInput
): CommunicationDocumentReservationPayload | null {
  let expectedMetadata: CommunicationDocumentInput;
  try {
    expectedMetadata = parseCommunicationDocumentInput(expected);
  } catch {
    return null;
  }
  const root = exactRecord(value, ["document", "upload"]);
  const document = root ? exactRecord(root.document, [
    "id",
    "originalName",
    "mimeType",
    "sizeBytes",
    "status",
    "createdAt",
  ]) : null;
  const upload = root ? exactRecord(root.upload, ["bucket", "path", "token"]) : null;
  const createdAt = document ? timestamp(document.createdAt) : null;
  if (
    !document ||
    !upload ||
    typeof document.id !== "string" ||
    !UUID_PATTERN.test(document.id) ||
    document.originalName !== expectedMetadata.originalName ||
    document.mimeType !== expectedMetadata.mimeType ||
    document.sizeBytes !== expectedMetadata.sizeBytes ||
    document.status !== "reserved" ||
    !createdAt ||
    upload.bucket !== COMMUNICATION_DOCUMENT_BUCKET ||
    typeof upload.path !== "string" ||
    !PRIVATE_PATH_PATTERN.test(upload.path) ||
    typeof upload.token !== "string" ||
    !SIGNED_TOKEN_PATTERN.test(upload.token)
  ) return null;

  const expectedExtension = expectedMetadata.mimeType === "application/pdf" ? "pdf" : "docx";
  if (!upload.path.toLowerCase().endsWith(`.${expectedExtension}`)) return null;

  return {
    document: {
      id: document.id,
      originalName: expectedMetadata.originalName,
      mimeType: expectedMetadata.mimeType,
      sizeBytes: expectedMetadata.sizeBytes,
      status: "reserved",
      createdAt,
    },
    upload: {
      bucket: COMMUNICATION_DOCUMENT_BUCKET,
      path: upload.path,
      token: upload.token,
    },
  };
}

export function parseCommunicationDocumentConfirmationPayload(
  value: unknown,
  expected: Pick<CommunicationDocumentInput, "originalName" | "mimeType" | "sizeBytes"> & { id: string }
): CommunicationDocumentConfirmationPayload | null {
  const root = exactRecord(value, ["document", "duplicate"]);
  const document = root ? parseDocumentRecord(root.document) : null;
  if (
    !root ||
    !document ||
    typeof root.duplicate !== "boolean" ||
    document.id !== expected.id ||
    document.originalName !== expected.originalName ||
    document.mimeType !== expected.mimeType ||
    document.sizeBytes !== expected.sizeBytes ||
    !["quarantined", "processing", "review", "used"].includes(document.status) ||
    document.uploadedAt === null ||
    (!root.duplicate && document.status !== "quarantined")
  ) return null;
  return { document, duplicate: root.duplicate };
}
