import { randomUUID } from "node:crypto";

export const COMMUNICATION_DOCUMENT_BUCKET = "communication-ingest";

export function communicationDocumentStoragePath(
  institutionId: string,
  userId: string,
  originalName: string
): string {
  const extension = originalName.split(".").pop()?.toLowerCase() === "docx" ? "docx" : "pdf";
  const date = new Date();
  return [
    institutionId,
    userId,
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    `${randomUUID()}.${extension}`,
  ].join("/");
}
