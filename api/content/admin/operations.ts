import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sql } from "drizzle-orm";
import { db } from "../../../db/index.js";
import { siteContentAssets } from "../../../db/schema.js";
import { projectSiteContentOperationsPayload } from "../../../shared/site-content-operations-payload.js";
import { requireSiteEditor } from "../../_shared/site-content.js";
import { handleApi, methodNotAllowed } from "../../_shared/response.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);

  return handleApi(res, async () => {
    await requireSiteEditor(req);
    const waitingSince = new Date(Date.now() - 15 * 60 * 1000);
    const [stats] = await db
      .select({
        total: sql<number>`count(*)`.mapWith(Number),
        pending: sql<number>`count(*) filter (where ${siteContentAssets.status} = 'pending')`.mapWith(Number),
        quarantine: sql<number>`count(*) filter (where ${siteContentAssets.status} = 'quarantine')`.mapWith(Number),
        quarantineOver15m: sql<number>`count(*) filter (where ${siteContentAssets.status} = 'quarantine' and ${siteContentAssets.updatedAt} < ${waitingSince})`.mapWith(Number),
        ready: sql<number>`count(*) filter (where ${siteContentAssets.status} = 'ready')`.mapWith(Number),
        blocked: sql<number>`count(*) filter (where ${siteContentAssets.status} = 'blocked')`.mapWith(Number),
        scanError: sql<number>`count(*) filter (where ${siteContentAssets.status} = 'scan_error')`.mapWith(Number),
        archived: sql<number>`count(*) filter (where ${siteContentAssets.status} = 'archived')`.mapWith(Number),
        legacyReadyWithoutScan: sql<number>`count(*) filter (
          where ${siteContentAssets.status} = 'ready'
            and ${siteContentAssets.sourceSystem} = 'wordpress'
            and (
              ${siteContentAssets.scanDetail} is distinct from 'clamav_clean'
              or ${siteContentAssets.sha256} is null
              or ${siteContentAssets.scannedAt} is null
            )
        )`.mapWith(Number),
        oldestQuarantineAt: sql<Date | null>`min(${siteContentAssets.updatedAt}) filter (where ${siteContentAssets.status} = 'quarantine')`,
        lastScanAt: sql<Date | null>`max(${siteContentAssets.scannedAt})`,
      })
      .from(siteContentAssets);

    return projectSiteContentOperationsPayload({
      generatedAt: new Date(),
      summary: {
        total: stats?.total ?? 0,
        pending: stats?.pending ?? 0,
        quarantine: stats?.quarantine ?? 0,
        quarantineOver15m: stats?.quarantineOver15m ?? 0,
        ready: stats?.ready ?? 0,
        blocked: stats?.blocked ?? 0,
        scanError: stats?.scanError ?? 0,
        archived: stats?.archived ?? 0,
        legacyReadyWithoutScan: stats?.legacyReadyWithoutScan ?? 0,
        oldestQuarantineAt: stats?.oldestQuarantineAt ?? null,
        lastScanAt: stats?.lastScanAt ?? null,
      },
    });
  });
}
