import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "../../../../../db/index.js";
import { scheduleAudit, scheduleSourceVersions } from "../../../../../db/schema.js";
import { projectScheduleImportPayload } from "../../../../../shared/schedule-admin-payload.js";
import { parseSchedulePromotionInput } from "../../../../../shared/schedule-promotion-input.js";
import { HttpError } from "../../../../_shared/auth.js";
import { registryInputError } from "../../../../_shared/knowledge-registry.js";
import { handleApi, methodNotAllowed } from "../../../../_shared/response.js";
import { requireScheduleManager } from "../../../../_shared/schedule-imports.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RETIRABLE_STATUSES = ["review", "approved", "superseded", "rejected", "failed"] as const;

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
      input = parseSchedulePromotionInput(req.body, "RETIRER");
    } catch (error) {
      registryInputError(error);
    }

    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`
        select pg_advisory_xact_lock(hashtextextended(${id}::text, 61744))
      `);
      const [candidate] = await tx
        .select()
        .from(scheduleSourceVersions)
        .where(
          and(
            eq(scheduleSourceVersions.id, id),
            eq(scheduleSourceVersions.institutionId, context.institutionId)
          )
        )
        .limit(1);
      if (!candidate) throw new HttpError(404, "Version introuvable.");
      if (candidate.status === "retired") return { source: candidate, duplicate: true };
      if (candidate.status === "active") {
        throw new HttpError(409, "Activez d'abord une version de remplacement.");
      }
      if (!RETIRABLE_STATUSES.includes(candidate.status as typeof RETIRABLE_STATUSES[number])) {
        throw new HttpError(409, "Cette version est encore en cours de traitement.");
      }

      const [retired] = await tx
        .update(scheduleSourceVersions)
        .set({
          status: "retired",
          retiredBy: context.user.id,
          retiredAt: new Date(),
          retirementReason: input.justification,
          retentionPolicyKey: "pending_dpo",
          retentionUntil: null,
          storagePurgeStatus: "blocked",
          purgedAt: null,
        })
        .where(
          and(
            eq(scheduleSourceVersions.id, id),
            eq(scheduleSourceVersions.institutionId, context.institutionId),
            inArray(scheduleSourceVersions.status, [...RETIRABLE_STATUSES])
          )
        )
        .returning();
      if (!retired) throw new HttpError(409, "Cette version a déjà changé.");

      await tx.insert(scheduleAudit).values({
        institutionId: context.institutionId,
        sourceVersionId: id,
        action: "retire",
        actorId: context.user.id,
        summary: {
          justification: input.justification,
          fileAccessRevoked: true,
          physicalPurge: false,
          retentionPolicyKey: "pending_dpo",
          storagePurgeStatus: "blocked",
        },
      });
      return { source: retired, duplicate: false };
    });

    return {
      import: projectScheduleImportPayload(result.source),
      duplicate: result.duplicate,
    };
  });
}

export const config = { api: { bodyParser: { sizeLimit: "4kb" } } };
