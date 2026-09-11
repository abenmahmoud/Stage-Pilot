import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq, inArray, isNotNull, ne, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { siteContentItems, siteContentVersions, siteContentAssets } from "../../db/schema.js";
import { calendarMonthBounds, parisToday } from "../../shared/school-calendar.js";
import { publicCalendarEvents } from "../../shared/school-calendar-public.js";
import { schoolCalendarIcal } from "../../shared/school-calendar-ical.js";
import { parseSiteContentInput } from "../../shared/site-content.js";
import { signedAssetUrl } from "../_shared/site-content.js";
import { HttpError } from "../_shared/auth.js";
import { handleApi, methodNotAllowed } from "../_shared/response.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  return handleApi(res, async () => {
    const query = new URL(req.url ?? "", "https://lycee-blaise-cendrars-sevran.fr").searchParams;
    const month = query.get("month") ?? parisToday().slice(0, 7);
    let bounds;
    try { bounds = calendarMonthBounds(month); } catch { throw new HttpError(400, "Le mois du calendrier est invalide."); }
    const format = query.get("format");
    if (format && format !== "ics") throw new HttpError(400, "Format de calendrier invalide.");
    const rows = await db.select({ item: siteContentItems, snapshot: siteContentVersions.snapshot })
      .from(siteContentItems).innerJoin(siteContentVersions, and(
        eq(siteContentVersions.contentId, siteContentItems.id),
        eq(siteContentVersions.version, siteContentItems.publishedVersion),
      )).where(and(
        isNotNull(siteContentItems.publishedVersion), isNotNull(siteContentItems.publishedAt),
        eq(siteContentItems.audience, "tous"), ne(siteContentItems.status, "archive"),
        sql`EXISTS (SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(${siteContentVersions.snapshot}->'calendarEvents') = 'array' THEN ${siteContentVersions.snapshot}->'calendarEvents' ELSE '[]'::jsonb END) AS event WHERE event->>'startDate' <= ${bounds.end} AND event->>'endDate' >= ${bounds.start})`,
      )).limit(101);
    if (rows.length > 100) throw new HttpError(503, "Le calendrier est trop volumineux pour être affiché intégralement. Contactez le lycée.");
    const now = new Date();
    // The join above deliberately uses publishedVersion, never the latest draft.
    const entries = rows.flatMap(row => {
      try { return [{ ...row, content: parseSiteContentInput(row.snapshot), events: publicCalendarEvents(row.item, row.snapshot, month, now) }]; }
      catch { return []; }
    });
    let events = entries.flatMap(entry => entry.events).sort((a, b) => a.startDate.localeCompare(b.startDate) || (a.startTime ?? "").localeCompare(b.startTime ?? "") || a.title.localeCompare(b.title, "fr"));
    const eventId = query.get("event");
    if (eventId) {
      if (eventId.length > 120) throw new HttpError(400, "Rendez-vous invalide.");
      events = events.filter(event => event.id === eventId);
      if (!events.length) throw new HttpError(404, "Ce rendez-vous n’est plus publié.");
    }
    if (format === "ics") {
      res.setHeader("Content-Type", "text/calendar; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="calendrier-blaise-cendrars-${month}.ics"`);
      res.status(200).send(schoolCalendarIcal(events));
      return;
    }
    const assetIds = [...new Set(entries.flatMap(entry => entry.events.length ? entry.content.assets.map(link => link.assetId) : []))];
    const assets = assetIds.length ? await db.select().from(siteContentAssets).where(and(inArray(siteContentAssets.id, assetIds), eq(siteContentAssets.status, "ready"), eq(siteContentAssets.assetKind, "image"))) : [];
    const photos = new Map(await Promise.all(entries.map(async entry => {
      const links = [...entry.content.assets].sort((a, b) => Number(b.assetRole === "couverture") - Number(a.assetRole === "couverture"));
      const asset = links.map(link => assets.find(candidate => candidate.id === link.assetId)).find(Boolean);
      const url = asset ? await signedAssetUrl(asset.storagePath) : null;
      return [entry.item.id, url && asset ? { signedUrl: url, altText: asset.altText ?? "" } : null] as const;
    })));
    return { month, events: events.map(event => ({ ...event, image: photos.get(event.articleId) ?? null })) };
  });
}
