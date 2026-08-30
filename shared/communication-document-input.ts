export const COMMUNICATION_DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;
export const COMMUNICATION_DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

export type CommunicationDocumentInput = {
  originalName: string;
  mimeType: (typeof COMMUNICATION_DOCUMENT_MIME_TYPES)[number];
  sizeBytes: number;
};

const FIELDS = new Set(["originalName", "mimeType", "sizeBytes"]);
const MIME_BY_EXTENSION: Record<string, CommunicationDocumentInput["mimeType"]> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export function parseCommunicationDocumentInput(value: unknown): CommunicationDocumentInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("input_invalid");
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some((key) => !FIELDS.has(key))) throw new Error("unknown_field");
  if (typeof input.originalName !== "string") throw new Error("original_name_invalid");
  const originalName = input.originalName
    .normalize("NFKC")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim();
  if (
    originalName.length < 1
    || originalName.length > 180
    || originalName.includes("/")
    || originalName.includes("\\")
  ) throw new Error("original_name_invalid");
  const extension = originalName.split(".").pop()?.toLowerCase() ?? "";
  const expectedMime = MIME_BY_EXTENSION[extension];
  if (!expectedMime || input.mimeType !== expectedMime) throw new Error("mime_type_invalid");
  const sizeBytes = Number(input.sizeBytes);
  if (!Number.isInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > COMMUNICATION_DOCUMENT_MAX_BYTES) {
    throw new Error("size_invalid");
  }
  return { originalName, mimeType: expectedMime, sizeBytes };
}
