import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../../../../../../../db/index.js";
import {
  scheduleAudit,
  schedulePageAssets,
  schedulePageIndexes,
  scheduleSourceVersions,
} from "../../../../../../../db/schema.js";
import { SCHEDULE_SIGNED_URL_SECONDS } from "../../../../../../../shared/schedule-admin-payload.js";
import { isExpectedSchedulePageAssetPath } from "../../../../../../../shared/schedule-page-asset.mjs";
import { HttpError, supabaseAdmin } from "../../../../../../_shared/auth.js";
import { handleApi, methodNotAllowed } from "../../../../../../_shared/response.js";
import { requireScheduleManager } from "../../../../../../_shared/schedule-imports.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function routeUuid(req: VercelRequest, key: "id" | "pageId"): string {
  const value = Array.isArray(req.query[key]) ? req.query[key][0] : req.query[key];
  if (!value || !UUID.test(value)) throw new HttpError(400, "Référence invalide.");
  return value;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  return handleApi(res, async () => {
    const context = await requireScheduleManager(req);
    const id = routeUuid(req, "id");
    const pageId = routeUuid(req, "pageId");
    const [page] = await db
      .select({
        pageIndexId: schedulePageIndexes.id,
        pageNumber: schedulePageIndexes.pageNumber,
        storageBucket: schedulePageAssets.storageBucket,
        storagePath: schedulePageAssets.storagePath,
      })
      .from(schedulePageIndexes)
      .innerJoin(
        scheduleSourceVersions,
        and(
          eq(scheduleSourceVersions.id, schedulePageIndexes.sourceVersionId),
          eq(scheduleSourceVersions.institutionId, schedulePageIndexes.institutionId)
        )
      )
      .innerJoin(
        schedulePageAssets,
        and(
          eq(schedulePageAssets.sourceVersionId, schedulePageIndexes.sourceVersionId),
          eq(schedulePageAssets.institutionId, schedulePageIndexes.institutionId),
          eq(schedulePageAssets.pageNumber, schedulePageIndexes.pageNumber)
        )
      )
      .where(
        and(
          eq(schedulePageIndexes.id, pageId),
          eq(schedulePageIndexes.sourceVersionId, id),
          eq(schedulePageIndexes.institutionId, context.institutionId),
          eq(schedulePageIndexes.reviewStatus, "verified"),
          inArray(scheduleSourceVersions.status, ["review", "approved", "active", "superseded"])
        )
      )
      .limit(1);
    if (!page) throw new HttpError(404, "Page privée vérifiée introuvable.");
    if (
      !isExpectedSchedulePageAssetPath(
        page.storagePath,
        context.institutionId,
        id,
        page.pageNumber
      )
    ) {
      throw new Error("Le chemin de la page privée est invalide.");
    }
    const { data, error } = await supabaseAdmin.storage
      .from(page.storageBucket)
      .createSignedUrl(page.storagePath, SCHEDULE_SIGNED_URL_SECONDS);
    if (error || !data?.signedUrl) {
      throw new Error("La page privée est temporairement indisponible.");
    }
    await db.insert(scheduleAudit).values({
      institutionId: context.institutionId,
      sourceVersionId: id,
      pageIndexId: page.pageIndexId,
      action: "open_page",
      actorId: context.user.id,
      summary: { scope: "single_page", expiresInSeconds: SCHEDULE_SIGNED_URL_SECONDS },
    });
    res.setHeader("Cache-Control", "no-store");
    return { url: data.signedUrl, expiresInSeconds: SCHEDULE_SIGNED_URL_SECONDS };
  });
}

export const config = { api: { bodyParser: false } };
