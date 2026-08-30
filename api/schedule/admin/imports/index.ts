import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../../../../db/index.js";
import { scheduleAudit, scheduleSourceVersions } from "../../../../db/schema.js";
import { parseScheduleImportInput } from "../../../../shared/schedule-import-input.js";
import { supabaseAdmin } from "../../../_shared/auth.js";
import { registryInputError } from "../../../_shared/knowledge-registry.js";
import { handleApi, methodNotAllowed } from "../../../_shared/response.js";
import {
  requireScheduleManager,
  SCHEDULE_IMPORT_BUCKET,
  scheduleImportStoragePath,
} from "../../../_shared/schedule-imports.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "GET") {
    return handleApi(res, async () => {
      const context = await requireScheduleManager(req);
      const imports = await db
        .select({
          id: scheduleSourceVersions.id,
          sourceKind: scheduleSourceVersions.sourceKind,
          schoolYear: scheduleSourceVersions.schoolYear,
          version: scheduleSourceVersions.version,
          title: scheduleSourceVersions.title,
          purposeDescription: scheduleSourceVersions.purposeDescription,
          effectiveFrom: scheduleSourceVersions.effectiveFrom,
          effectiveUntil: scheduleSourceVersions.effectiveUntil,
          freshUntil: scheduleSourceVersions.freshUntil,
          originalName: scheduleSourceVersions.originalName,
          sizeBytes: scheduleSourceVersions.sizeBytes,
          pageCount: scheduleSourceVersions.pageCount,
          status: scheduleSourceVersions.status,
          validationSummary: scheduleSourceVersions.validationSummary,
          uploadedAt: scheduleSourceVersions.uploadedAt,
          createdAt: scheduleSourceVersions.createdAt,
        })
        .from(scheduleSourceVersions)
        .where(eq(scheduleSourceVersions.institutionId, context.institutionId))
        .orderBy(desc(scheduleSourceVersions.createdAt))
        .limit(100);
      return { imports };
    });
  }

  if (req.method === "POST") {
    return handleApi(res, async () => {
      const context = await requireScheduleManager(req);
      let input;
      try {
        input = parseScheduleImportInput(req.body);
      } catch (error) {
        registryInputError(error);
      }

      const storagePath = scheduleImportStoragePath(
        context.institutionId,
        context.user.id,
        input.schoolYear,
        input.sourceKind
      );
      const { data: upload, error: uploadError } = await supabaseAdmin.storage
        .from(SCHEDULE_IMPORT_BUCKET)
        .createSignedUploadUrl(storagePath);
      if (uploadError || !upload) {
        throw new Error("Le dépôt privé des emplois du temps est indisponible.");
      }

      const created = await db.transaction(async (tx) => {
        await tx.execute(sql`
          select pg_advisory_xact_lock(
            hashtextextended(
              ${`${context.institutionId}:${input.sourceKind}:${input.schoolYear}`},
              61743
            )
          )
        `);
        const [latest] = await tx
          .select({ version: sql<number>`coalesce(max(${scheduleSourceVersions.version}), 0)` })
          .from(scheduleSourceVersions)
          .where(
            and(
              eq(scheduleSourceVersions.institutionId, context.institutionId),
              eq(scheduleSourceVersions.sourceKind, input.sourceKind),
              eq(scheduleSourceVersions.schoolYear, input.schoolYear)
            )
          );
        const [source] = await tx
          .insert(scheduleSourceVersions)
          .values({
            institutionId: context.institutionId,
            sourceKind: input.sourceKind,
            schoolYear: input.schoolYear,
            version: Number(latest?.version ?? 0) + 1,
            title: input.title,
            purposeDescription: input.purposeDescription,
            effectiveFrom: input.effectiveFrom,
            effectiveUntil: input.effectiveUntil,
            freshUntil: new Date(`${input.freshUntil}T23:59:59.999Z`),
            originalName: input.originalName,
            mimeType: input.mimeType,
            sizeBytes: input.sizeBytes,
            storageBucket: SCHEDULE_IMPORT_BUCKET,
            storagePath,
            status: "reserved",
            uploadedBy: context.user.id,
            validationSummary: {
              securityScan: "pending",
              indexing: "blocked",
              realDataAllowedInModel: false,
            },
          })
          .returning();
        await tx.insert(scheduleAudit).values({
          institutionId: context.institutionId,
          sourceVersionId: source.id,
          action: "reserve_upload",
          actorId: context.user.id,
          summary: {
            sourceKind: input.sourceKind,
            schoolYear: input.schoolYear,
            version: source.version,
            sizeBytes: input.sizeBytes,
          },
        });
        return source;
      });

      return {
        import: created,
        upload: {
          bucket: SCHEDULE_IMPORT_BUCKET,
          path: upload.path,
          token: upload.token,
        },
      };
    });
  }

  return methodNotAllowed(res, ["GET", "POST"]);
}

export const config = { api: { bodyParser: { sizeLimit: "8kb" } } };
