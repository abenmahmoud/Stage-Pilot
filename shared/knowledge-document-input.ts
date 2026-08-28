import { SUPPORT_SERVICES, type SupportService } from "./support-agent-access.js";
import type { KnowledgeClassification } from "./skill-registry-policy.js";

export const KNOWLEDGE_DOCUMENT_MAX_BYTES = 50 * 1024 * 1024;
export const KNOWLEDGE_DOCUMENT_TYPES = [
  "internal_document",
  "procedure",
  "directory",
  "calendar",
] as const;

export const KNOWLEDGE_DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  "image/jpeg",
  "image/png",
] as const;

export type KnowledgeDocumentInput = {
  title: string;
  purposeDescription: string;
  sourceType: (typeof KNOWLEDGE_DOCUMENT_TYPES)[number];
  classification: KnowledgeClassification;
  serviceCodes: SupportService[];
  originalName: string;
  mimeType: (typeof KNOWLEDGE_DOCUMENT_MIME_TYPES)[number];
  sizeBytes: number;
};

const CLASSIFICATIONS: KnowledgeClassification[] = [
  "public",
  "internal",
  "personal",
  "sensitive",
];

const MIME_BY_EXTENSION: Record<string, KnowledgeDocumentInput["mimeType"]> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain",
  csv: "text/csv",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
};

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Les données sont invalides");
  }
  return value as Record<string, unknown>;
}

function cleanText(value: unknown, label: string, min: number, max: number): string {
  if (typeof value !== "string") throw new Error(`${label} est obligatoire`);
  const clean = value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .trim();
  if (clean.length < min || clean.length > max) {
    throw new Error(`${label} doit contenir entre ${min} et ${max} caractères`);
  }
  return clean;
}

function enumValue<T extends string>(value: unknown, values: readonly T[], label: string): T {
  if (typeof value !== "string" || !values.includes(value as T)) {
    throw new Error(`${label} est invalide`);
  }
  return value as T;
}

export function knowledgeDocumentMime(fileName: string, suppliedMime = ""): string {
  const normalized = suppliedMime.toLowerCase().trim();
  if ((KNOWLEDGE_DOCUMENT_MIME_TYPES as readonly string[]).includes(normalized)) {
    return normalized;
  }
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXTENSION[extension] ?? normalized;
}

export function parseKnowledgeDocumentInput(value: unknown): KnowledgeDocumentInput {
  const input = record(value);
  const classification = enumValue(input.classification, CLASSIFICATIONS, "Confidentialité");
  const suppliedServices = Array.isArray(input.serviceCodes)
    ? [...new Set(input.serviceCodes.map(String).map((item) => item.trim()).filter(Boolean))]
    : [];
  if (suppliedServices.length > SUPPORT_SERVICES.length) {
    throw new Error("La liste des services est invalide");
  }
  const serviceCodes = suppliedServices.map((service) =>
    enumValue(service, SUPPORT_SERVICES, "Service")
  );
  if (classification === "public" && serviceCodes.length > 0) {
    throw new Error("Un document public ne doit pas être limité à un service");
  }

  const originalName = cleanText(input.originalName, "Nom du fichier", 1, 255);
  const mimeType = enumValue(
    knowledgeDocumentMime(originalName, String(input.mimeType ?? "")),
    KNOWLEDGE_DOCUMENT_MIME_TYPES,
    "Format du fichier"
  );
  const sizeBytes = Number(input.sizeBytes);
  if (!Number.isInteger(sizeBytes) || sizeBytes <= 0 || sizeBytes > KNOWLEDGE_DOCUMENT_MAX_BYTES) {
    throw new Error("Le document doit faire 50 Mo maximum pour ce pilote");
  }

  return {
    title: cleanText(input.title, "Titre", 2, 180),
    purposeDescription: cleanText(input.purposeDescription, "Explication", 20, 4000),
    sourceType: enumValue(input.sourceType, KNOWLEDGE_DOCUMENT_TYPES, "Type de document"),
    classification,
    serviceCodes,
    originalName,
    mimeType,
    sizeBytes,
  };
}
