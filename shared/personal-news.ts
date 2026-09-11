import { parseSchoolCalendarDates, type SchoolCalendarDate } from './school-calendar.js';
import { parseSiteContentInput } from './site-content.js';
import { contentMatchesIdentity } from './content-targeting.js';

export type PersonalNewsItem = { id: string; version: number; title: string; summary: string; category: string; publishedAt: string; targeted: boolean; calendarEvents: SchoolCalendarDate[] };
export type PersonalNewsFeed = { status: 'available' | 'unavailable'; items: PersonalNewsItem[]; more: boolean; validUntil: string };
export type PersonalNewsArticle = { item: PersonalNewsItem; bodyMarkdown: string; assets: { id: string; label: string; mimeType: string }[]; validUntil: string };
export type PublishedNewsRow = { item: { id: string; status: string; publishedVersion: number | null; publishedAt: Date | string | null }; snapshot: unknown };
export function authorizedNews(row: PublishedNewsRow, scope: { personType: 'student' | 'guardian' | 'staff'; classRefs: string[] }, now: Date) {
  if (row.item.status === 'archive' || !row.item.publishedVersion || !row.item.publishedAt) return null;
  const published = new Date(row.item.publishedAt);
  if (!Number.isFinite(published.getTime()) || published > now) return null;
  try {
    const content = parseSiteContentInput(row.snapshot);
    if ((content.publishAt && content.publishAt > now) || (content.expiresAt && content.expiresAt <= now) || !contentMatchesIdentity(content, scope)) return null;
    return { content, preview: { id: row.item.id, version: row.item.publishedVersion, title: content.title, summary: content.summary,
      category: content.category, publishedAt: published.toISOString(), targeted: content.audience !== 'tous', calendarEvents: content.calendarEvents ?? [] } satisfies PersonalNewsItem };
  } catch { return null; }
}
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const exact = (r: Record<string, unknown>, keys: string[]) => Object.keys(r).length === keys.length && keys.every(k => k in r);
const str = (v: unknown, max: number): v is string => typeof v === 'string' && v.length <= max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v);
export const isNewsId = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v);
const instant = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v) && Number.isFinite(Date.parse(v));
function isItem(v: unknown): v is PersonalNewsItem {
  if (!record(v) || !exact(v, ['id','version','title','summary','category','publishedAt','targeted','calendarEvents']) || !isNewsId(v.id)
    || !Number.isInteger(v.version) || Number(v.version) < 1 || !str(v.title,180) || !v.title.trim() || !str(v.summary,600) || !str(v.category,100)
    || !instant(v.publishedAt) || typeof v.targeted !== 'boolean' || !Array.isArray(v.calendarEvents)) return false;
  try { parseSchoolCalendarDates(v.calendarEvents); return true; } catch { return false; }
}
export function isPersonalNewsFeed(v: unknown): v is PersonalNewsFeed {
  return record(v) && exact(v,['status','items','more','validUntil']) && ['available','unavailable'].includes(String(v.status))
    && Array.isArray(v.items) && v.items.length <= 8 && v.items.every(isItem) && new Set(v.items.map(i=>i.id)).size === v.items.length
    && typeof v.more === 'boolean' && instant(v.validUntil) && (v.status !== 'unavailable' || (!v.items.length && !v.more));
}
export function isPersonalNewsArticle(v: unknown): v is PersonalNewsArticle {
  return record(v) && exact(v,['item','bodyMarkdown','assets','validUntil']) && isItem(v.item) && str(v.bodyMarkdown,30000) && instant(v.validUntil)
    && Array.isArray(v.assets) && v.assets.length <= 20 && v.assets.every(a=>record(a) && exact(a,['id','label','mimeType']) && isNewsId(a.id) && str(a.label,180) && str(a.mimeType,160));
}
