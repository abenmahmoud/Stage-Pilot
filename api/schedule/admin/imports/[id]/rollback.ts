import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "../../../../../db/index.js";
import { scheduleAudit, scheduleSourceVersions } from "../../../../../db/schema.js";
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
      input = parseSchedulePromotionInput(req.body, "RESTAURER");
    } catch (error) {
      registryInputError(error);
    }

    const result = await db.transaction(async (tx) => {
      const [scope] = await tx
        .select({
          sourceKind: scheduleSourceVersions.sourceKind,
          schoolYear: scheduleSourceVersions.schoolYear,
        })
        .from(scheduleSourceVersions)
        .where(
          and(
            eq(scheduleSourceVersions.id, id),
            eq(scheduleSourceVersions.institutionId, context.institutionId)
          )
        )
        .limit(1);
      if (!scope) throw new HttpError(404, "Version introuvable.");
      await tx.execute(sql`
        select pg_advisory_xact_lock(
          hashtextextended(
            ${`${context.institutionId}:${scope.sourceKind}:${scope.schoolYear}`},
            61743
          )
        )
      `);
      await tx.execute(sql`
        select pg_advisory_xact_lock(hashtextextended(${id}::text, 61744))
      `);
      const [candidate] = await tx
        .select()
        .from(scheduleSourceVersions)
        .where(
          and(
            eq(scheduleSourceVersions.id, id),
            eq(scheduleSourceVersions.institutionId, context.institutionId),
            eq(scheduleSourceVersions.sourceKind, scope.sourceKind),
            eq(scheduleSourceVersions.schoolYear, scope.schoolYear)
          )
        )
        .limit(1);
      if (!candidate) throw new HttpError(409, "Le périmètre de cette version a changé.");
      if (candidate.status === "active") return { source: candidate, duplicate: true };
      if (candidate.status !== "superseded") {
        throw new HttpError(409, "Seule une version remplacée peut être restaurée.");
      }
      const current = await tx
        .select({ id: scheduleSourceVersions.id })
        .from(scheduleSourceVersions)
        .where(
          and(
            eq(scheduleSourceVersions.institutionId, context.institutionId),
            eq(scheduleSourceVersions.sourceKind, candidate.sourceKind),
            eq(scheduleSourceVersions.schoolYear, candidate.schoolYear),
            eq(scheduleSourceVersions.status, "active"),
            ne(scheduleSourceVersions.id, id)
          )
        );
      if (current.length === 0) {
        throw new HttpError(409, "Aucune version active à remplacer ; utilisez l'activation normale.");
      }
      await tx
        .update(scheduleSourceVersions)
        .set({ status: "superseded" })
        .where(
          and(
            eq(scheduleSourceVersions.institutionId, context.institutionId),
            eq(scheduleSourceVersions.sourceKind, candidate.sourceKind),
            eq(scheduleSourceVersions.schoolYear, candidate.schoolYear),
            eq(scheduleSourceVersions.status, "active"),
            ne(scheduleSourceVersions.id, id)
          )
        );
      await tx.insert(scheduleAudit).values(current.map((entry) => ({
        institutionId: context.institutionId,
        sourceVersionId: entry.id,
        action: "supersede" as const,
        actorId: context.user.id,
        summary: { replacementSourceVersionId: id, reason: "rollback" },
      })));
      const [restored] = await tx
        .update(scheduleSourceVersions)
        .set({ status: "active", activatedBy: context.user.id, activatedAt: new Date() })
        .where(
          and(
            eq(scheduleSourceVersions.id, id),
            eq(scheduleSourceVersions.institutionId, context.institutionId),
            eq(scheduleSourceVersions.status, "superseded")
          )
        )
        .returning();
      if (!restored) throw new HttpError(409, "Cette version a déjà changé.");
      await tx.insert(scheduleAudit).values({
        institutionId: context.institutionId,
        sourceVersionId: id,
        action: "rollback",
        actorId: context.user.id,
        summary: { justification: input.justification, replacedSourceVersionId: current[0].id },
      });
      return { source: restored, duplicate: false };
    });
    return { import: result.source, duplicate: result.duplicate };
  });
}
