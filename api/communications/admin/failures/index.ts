import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "../../../../db/index.js";
import {
  communicationJobs,
  communicationVersions,
} from "../../../../db/schema.js";
import { requireCommunicationManager } from "../../../_shared/communications.js";
import { handleApi, methodNotAllowed } from "../../../_shared/response.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  return handleApi(res, async () => {
    const context = await requireCommunicationManager(req);
    const rows = await db
      .select({
        id: communicationJobs.id,
        jobType: communicationJobs.jobType,
        attemptCount: communicationJobs.attemptCount,
        failureCode: communicationJobs.lastErrorCode,
        failedAt: communicationJobs.updatedAt,
        title: communicationVersions.title,
        version: communicationJobs.version,
      })
      .from(communicationJobs)
      .innerJoin(communicationVersions, and(
        eq(communicationJobs.versionId, communicationVersions.id),
        eq(communicationJobs.institutionId, communicationVersions.institutionId),
        eq(communicationJobs.communicationId, communicationVersions.communicationId),
        eq(communicationJobs.version, communicationVersions.version)
      ))
      .where(and(
        eq(communicationJobs.institutionId, context.institutionId),
        eq(communicationJobs.status, "dead"),
        inArray(communicationJobs.jobType, ["send_delivery", "retry_delivery"])
      ))
      .orderBy(desc(communicationJobs.updatedAt), desc(communicationJobs.id))
      .limit(100);
    return { failures: rows };
  });
}
