import { randomUUID } from "node:crypto";
import { KNOWLEDGE_DOCUMENT_BUCKET } from "../../shared/knowledge-document-admin-payload.js";

export { KNOWLEDGE_DOCUMENT_BUCKET };

export function knowledgeDocumentStoragePath(
  institutionId: string,
  userId: string,
  originalName: string
): string {
  const extension = originalName.includes(".")
    ? originalName.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10)
    : "bin";
  const date = new Date();
  return [
    institutionId,
    userId,
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    `${randomUUID()}.${extension || "bin"}`,
  ].join("/");
}
