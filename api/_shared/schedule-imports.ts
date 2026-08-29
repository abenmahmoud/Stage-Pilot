import { randomUUID } from "node:crypto";
import type { VercelRequest } from "@vercel/node";
import { requireKnowledgeManager } from "./knowledge-registry.js";

export const SCHEDULE_IMPORT_BUCKET = "schedule-ingest";

export async function requireScheduleManager(req: VercelRequest) {
  return requireKnowledgeManager(req, { publish: true });
}

export function scheduleImportStoragePath(
  institutionId: string,
  actorId: string,
  schoolYear: string,
  sourceKind: string
): string {
  return [
    institutionId,
    schoolYear,
    sourceKind,
    actorId,
    `${randomUUID()}.pdf`,
  ].join("/");
}
