import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../../../../../db/index.js";
import { scheduleAudit, scheduleSourceVersions } from "../../../../../db/schema.js";
import { HttpError, supabaseAdmin } from "../../../../_shared/auth.js";
import { handleApi, methodNotAllowed } from "../../../../_shared/response.js";
import { requireScheduleManager } from "../../../../_shared/schedule-imports.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SIGNED_URL_SECONDS = 60;

function sourceId(req: VercelRequest): string {
  const value = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (!value || !UUID.test(value)) throw new HttpError(400, "Version invalide.");
  return value;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  return handleApi(res, async () => {
    const context = await requireScheduleManager(req);
    const id = sourceId(req);
    const [source] = await db
      .select({
        id: scheduleSourceVersions.id,
        storageBucket: scheduleSourceVersions.storageBucket,
        storagePath: scheduleSourceVersions.storagePath,
      })
      .from(scheduleSourceVersions)
      .where(
        and(
          eq(scheduleSourceVersions.id, id),
          eq(scheduleSourceVersions.institutionId, context.institutionId),
          inArray(scheduleSourceVersions.status, ["review", "approved", "active", "superseded"])
        )
      )
      .limit(1);
    if (!source) throw new HttpError(404, "PDF validé introuvable.");
    const { data, error } = await supabaseAdmin.storage
      .from(source.storageBucket)
      .createSignedUrl(source.storagePath, SIGNED_URL_SECONDS);
    if (error || !data?.signedUrl) throw new Error("Le PDF privé est temporairement indisponible.");
    await db.insert(scheduleAudit).values({
      institutionId: context.institutionId,
      sourceVersionId: id,
      action: "open_page",
      actorId: context.user.id,
      summary: { scope: "source_pdf", expiresInSeconds: SIGNED_URL_SECONDS },
    });
    res.setHeader("Cache-Control", "no-store");
    return { url: data.signedUrl, expiresInSeconds: SIGNED_URL_SECONDS };
  });
}
