import { randomUUID } from "node:crypto";

export const COMMUNICATION_DOCUMENT_BUCKET = "communication-ingest";

export function communicationDocumentUploadEnabled(
  env: Partial<Record<"COMMUNICATION_DOCUMENT_UPLOAD_ENABLED", string>> = process.env
): boolean {
  return env.COMMUNICATION_DOCUMENT_UPLOAD_ENABLED === "true";
}

export function communicationDocumentStoragePath(
  originalName: string
): string {
  const extension = originalName.split(".").pop()?.toLowerCase() === "docx" ? "docx" : "pdf";
  const date = new Date();
  return [
    "private",
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    `${randomUUID()}.${extension}`,
  ].join("/");
}
