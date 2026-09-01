import { randomUUID } from "node:crypto";
import type { VercelRequest } from "@vercel/node";
import { SCHEDULE_IMPORT_BUCKET } from "../../shared/schedule-admin-payload.js";
import { requireKnowledgeManager } from "./knowledge-registry.js";

export { SCHEDULE_IMPORT_BUCKET };

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
