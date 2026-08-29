import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../../../../../../../db/index.js";
import {
  scheduleAudit,
  schedulePageIndexes,
  scheduleSourceVersions,
} from "../../../../../../../db/schema.js";
import { HttpError } from "../../../../../../_shared/auth.js";
import { handleApi, methodNotAllowed } from "../../../../../../_shared/response.js";
import { requireScheduleManager } from "../../../../../../_shared/schedule-imports.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function routeUuid(req: VercelRequest, key: "id" | "pageId"): string {
  const value = Array.isArray(req.query[key]) ? req.query[key][0] : req.query[key];
  if (!value || !UUID.test(value)) throw new HttpError(400, "Référence invalide.");
  return value;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  return handleApi(res, async () => {
    const context = await requireScheduleManager(req);
    const id = routeUuid(req, "id");
    const pageId = routeUuid(req, "pageId");

    const mapping = await db.transaction(async (tx) => {
      await tx.execute(sql`
        select pg_advisory_xact_lock(hashtextextended(${id}::text, 61744))
      `);
      const [page] = await tx
        .select({
          id: schedulePageIndexes.id,
          pageNumber: schedulePageIndexes.pageNumber,
          reviewStatus: schedulePageIndexes.reviewStatus,
          sourceStatus: scheduleSourceVersions.status,
        })
        .from(schedulePageIndexes)
        .innerJoin(
          scheduleSourceVersions,
          and(
            eq(scheduleSourceVersions.id, schedulePageIndexes.sourceVersionId),
            eq(scheduleSourceVersions.institutionId, schedulePageIndexes.institutionId)
          )
        )
        .where(
          and(
            eq(schedulePageIndexes.id, pageId),
            eq(schedulePageIndexes.sourceVersionId, id),
            eq(schedulePageIndexes.institutionId, context.institutionId)
          )
        )
        .limit(1);
      if (!page) throw new HttpError(404, "Page indexée introuvable.");
      if (page.sourceStatus !== "review") {
        throw new HttpError(409, "Cette version n'est plus modifiable.");
      }
      if (page.reviewStatus === "verified") {
        const [existing] = await tx
          .select()
          .from(schedulePageIndexes)
          .where(eq(schedulePageIndexes.id, pageId))
          .limit(1);
        return existing;
      }
      const [verified] = await tx
        .update(schedulePageIndexes)
        .set({
          reviewStatus: "verified",
          reviewedBy: context.user.id,
          reviewedAt: new Date(),
        })
        .where(
          and(
            eq(schedulePageIndexes.id, pageId),
            eq(schedulePageIndexes.institutionId, context.institutionId),
            eq(schedulePageIndexes.reviewStatus, "draft")
          )
        )
        .returning();
      if (!verified) throw new HttpError(409, "Cette page ne peut pas être vérifiée.");
      await tx.insert(scheduleAudit).values({
        institutionId: context.institutionId,
        sourceVersionId: id,
        pageIndexId: pageId,
        action: "verify_page",
        actorId: context.user.id,
        summary: { pageNumber: page.pageNumber },
      });
      return verified;
    });
    return { mapping };
  });
}
