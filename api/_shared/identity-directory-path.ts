import { randomUUID } from "node:crypto";

export function identityDirectoryStoragePath(
  institutionId: string,
  userId: string,
  originalName: string
): string {
  const extension = originalName.split(".").pop()?.toLowerCase() === "csv" ? "csv" : "xlsx";
  const date = new Date();
  return [
    institutionId,
    userId,
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    `${randomUUID()}.${extension}`,
  ].join("/");
}
