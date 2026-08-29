import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, asc, eq, ne, sql } from "drizzle-orm";
import { db } from "../../../../../../db/index.js";
import {
  scheduleAudit,
  schedulePageIndexes,
  scheduleSourceVersions,
} from "../../../../../../db/schema.js";
import { parseSchedulePageMappingInput } from "../../../../../../shared/schedule-page-input.js";
import { HttpError } from "../../../../../_shared/auth.js";
import { registryInputError } from "../../../../../_shared/knowledge-registry.js";
import { handleApi, methodNotAllowed } from "../../../../../_shared/response.js";
import { requireScheduleManager } from "../../../../../_shared/schedule-imports.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function sourceId(req: VercelRequest): string {
  const value = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (!value || !UUID.test(value)) throw new HttpError(400, "Version invalide.");
  return value;
}

async function loadSource(id: string, institutionId: string) {
  const [source] = await db
    .select({
      id: scheduleSourceVersions.id,
      sourceKind: scheduleSourceVersions.sourceKind,
      title: scheduleSourceVersions.title,
      pageCount: scheduleSourceVersions.pageCount,
      status: scheduleSourceVersions.status,
    })
    .from(scheduleSourceVersions)
    .where(
      and(
        eq(scheduleSourceVersions.id, id),
        eq(scheduleSourceVersions.institutionId, institutionId)
      )
    )
    .limit(1);
  if (!source) throw new HttpError(404, "Version introuvable.");
  return source;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "GET") {
    return handleApi(res, async () => {
      const context = await requireScheduleManager(req);
      const id = sourceId(req);
      const source = await loadSource(id, context.institutionId);
      const pages = await db
        .select({
          id: schedulePageIndexes.id,
          pageNumber: schedulePageIndexes.pageNumber,
          subjectType: schedulePageIndexes.subjectType,
          subjectRef: schedulePageIndexes.subjectRef,
          reviewStatus: schedulePageIndexes.reviewStatus,
          reviewedAt: schedulePageIndexes.reviewedAt,
        })
        .from(schedulePageIndexes)
        .where(
          and(
            eq(schedulePageIndexes.sourceVersionId, id),
            eq(schedulePageIndexes.institutionId, context.institutionId)
          )
        )
        .orderBy(asc(schedulePageIndexes.pageNumber));
      return { source, pages };
    });
  }

  if (req.method === "POST") {
    return handleApi(res, async () => {
      const context = await requireScheduleManager(req);
      const id = sourceId(req);
      let input;
      try {
        input = parseSchedulePageMappingInput(req.body);
      } catch (error) {
        registryInputError(error);
      }

      const mapping = await db.transaction(async (tx) => {
        await tx.execute(sql`
          select pg_advisory_xact_lock(hashtextextended(${id}::text, 61744))
        `);
        const [source] = await tx
          .select({
            sourceKind: scheduleSourceVersions.sourceKind,
            pageCount: scheduleSourceVersions.pageCount,
            status: scheduleSourceVersions.status,
          })
          .from(scheduleSourceVersions)
          .where(
            and(
              eq(scheduleSourceVersions.id, id),
              eq(scheduleSourceVersions.institutionId, context.institutionId)
            )
          )
          .limit(1);
        if (!source) throw new HttpError(404, "Version introuvable.");
        if (source.status !== "review" || !source.pageCount) {
          throw new HttpError(409, "Le PDF doit être contrôlé avant l'indexation.");
        }
        if (input.pageNumber > source.pageCount) {
          throw new HttpError(400, `Ce PDF contient ${source.pageCount} pages.`);
        }
        const subjectType = source.sourceKind === "classes" ? "class" : "teacher";
        const [conflict] = await tx
          .select({ id: schedulePageIndexes.id })
          .from(schedulePageIndexes)
          .where(
            and(
              eq(schedulePageIndexes.sourceVersionId, id),
              eq(schedulePageIndexes.subjectType, subjectType),
              eq(schedulePageIndexes.subjectRef, input.subjectRef),
              ne(schedulePageIndexes.pageNumber, input.pageNumber)
            )
          )
          .limit(1);
        if (conflict) {
          throw new HttpError(409, "Cette référence est déjà associée à une autre page.");
        }

        const [saved] = await tx
          .insert(schedulePageIndexes)
          .values({
            institutionId: context.institutionId,
            sourceVersionId: id,
            pageNumber: input.pageNumber,
            subjectType,
            subjectRef: input.subjectRef,
            reviewStatus: "draft",
          })
          .onConflictDoUpdate({
            target: [schedulePageIndexes.sourceVersionId, schedulePageIndexes.pageNumber],
            set: {
              subjectType,
              subjectRef: input.subjectRef,
              reviewStatus: "draft",
              reviewedBy: null,
              reviewedAt: null,
            },
          })
          .returning();
        await tx.insert(scheduleAudit).values({
          institutionId: context.institutionId,
          sourceVersionId: id,
          pageIndexId: saved.id,
          action: "index_page",
          actorId: context.user.id,
          summary: { pageNumber: input.pageNumber, subjectType },
        });
        return saved;
      });
      return { mapping };
    });
  }

  return methodNotAllowed(res, ["GET", "POST"]);
}
