import { randomUUID } from "node:crypto";
import { COMMUNICATION_DOCUMENT_BUCKET } from "../../shared/communication-document-payload.js";

export { COMMUNICATION_DOCUMENT_BUCKET };

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
