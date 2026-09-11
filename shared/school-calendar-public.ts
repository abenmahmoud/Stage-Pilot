import { parseSiteContentInput } from "./site-content.js";
import { calendarMonthBounds, type SchoolCalendarEvent } from "./school-calendar.js";

type Publication = {
  id: string; status: string; audience: string; publishedVersion: number | null;
  publishedAt: Date | string | null;
};
export function publicCalendarEvents(item: Publication, snapshot: unknown, month: string, now = new Date()): SchoolCalendarEvent[] {
  const bounds = calendarMonthBounds(month);
  if (item.status === "archive" || item.audience !== "tous" || !item.publishedVersion || !item.publishedAt) return [];
  const publishedAt = new Date(item.publishedAt);
  if (!Number.isFinite(publishedAt.getTime()) || publishedAt > now) return [];
  const content = parseSiteContentInput(snapshot);
  if (content.audience !== "tous" || (content.publishAt && content.publishAt > now)) return [];
  return (content.calendarEvents ?? [])
    .filter(event => event.startDate <= bounds.end && event.endDate >= bounds.start)
    .map(event => ({ ...event, id: `${item.id}:${event.key}`, articleId: item.id,
      articleSlug: content.slug, articleTitle: content.title, category: content.category,
      summary: content.summary, version: item.publishedVersion!, updatedAt: publishedAt.toISOString(),
      articleExpired: Boolean(content.expiresAt && content.expiresAt <= now), image: null,
    }));
}
