import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, count, eq, sql } from "drizzle-orm";
import { db } from "../../../../../db/index.js";
import {
  scheduleAudit,
  schedulePageIndexes,
  scheduleSourceVersions,
} from "../../../../../db/schema.js";
import { projectScheduleImportPayload } from "../../../../../shared/schedule-admin-payload.js";
import { parseSchedulePromotionInput } from "../../../../../shared/schedule-promotion-input.js";
import { HttpError } from "../../../../_shared/auth.js";
import { registryInputError } from "../../../../_shared/knowledge-registry.js";
import { handleApi, methodNotAllowed } from "../../../../_shared/response.js";
import { requireScheduleManager } from "../../../../_shared/schedule-imports.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function routeId(req: VercelRequest): string {
  const value = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (!value || !UUID.test(value)) throw new HttpError(400, "Version invalide.");
  return value;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  return handleApi(res, async () => {
    const context = await requireScheduleManager(req);
    const id = routeId(req);
    let input;
    try {
      input = parseSchedulePromotionInput(req.body);
    } catch (error) {
      registryInputError(error);
    }

    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`
        select pg_advisory_xact_lock(hashtextextended(${id}::text, 61744))
      `);
      const [source] = await tx
        .select()
        .from(scheduleSourceVersions)
        .where(
          and(
            eq(scheduleSourceVersions.id, id),
            eq(scheduleSourceVersions.institutionId, context.institutionId)
          )
        )
        .limit(1);
      if (!source) throw new HttpError(404, "Version introuvable.");
      if (source.status === "approved") return { source, duplicate: true };
      if (source.status !== "review") {
        throw new HttpError(409, "L'indexation doit être en cours de vérification.");
      }
      const validation = source.validationSummary as Record<string, unknown>;
      if (
        !source.checksum ||
        !source.pageCount ||
        validation.securityScan !== "clean" ||
        validation.pageCountVerified !== true
      ) {
        throw new HttpError(409, "Le contrôle technique du PDF est incomplet.");
      }
      const [pageCounts] = await tx
        .select({
          total: count(),
          verified: sql<number>`count(*) filter (where ${schedulePageIndexes.reviewStatus} = 'verified')`,
        })
        .from(schedulePageIndexes)
        .where(
          and(
            eq(schedulePageIndexes.sourceVersionId, id),
            eq(schedulePageIndexes.institutionId, context.institutionId)
          )
        );
      if (
        Number(pageCounts?.total ?? 0) !== source.pageCount ||
        Number(pageCounts?.verified ?? 0) !== source.pageCount
      ) {
        throw new HttpError(409, "Chaque page doit être associée puis vérifiée.");
      }

      const [approved] = await tx
        .update(scheduleSourceVersions)
        .set({
          status: "approved",
          approvedBy: context.user.id,
          approvedAt: new Date(),
          validationSummary: {
            ...validation,
            humanMapping: "verified",
            activation: "ready",
          },
        })
        .where(
          and(
            eq(scheduleSourceVersions.id, id),
            eq(scheduleSourceVersions.institutionId, context.institutionId),
            eq(scheduleSourceVersions.status, "review")
          )
        )
        .returning();
      if (!approved) throw new HttpError(409, "Cette version a déjà changé.");
      await tx.insert(scheduleAudit).values({
        institutionId: context.institutionId,
        sourceVersionId: id,
        action: "approve",
        actorId: context.user.id,
        summary: { justification: input.justification, pageCount: source.pageCount },
      });
      return { source: approved, duplicate: false };
    });
    return { import: projectScheduleImportPayload(result.source), duplicate: result.duplicate };
  });
}

export const config = { api: { bodyParser: { sizeLimit: "4kb" } } };
