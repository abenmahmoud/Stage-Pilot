import { useEffect, useState } from "react";
import { readJsonApiResponse } from "../../shared/json-api-response";
import { parseSchoolCalendarDates, type SchoolCalendarEvent } from "../../shared/school-calendar";
import { isAllowedPublicContentSignedUrlForOrigin } from "../../shared/public-content-signed-url";

export async function readSchoolCalendar(response: Response, expectedMonth: string): Promise<SchoolCalendarEvent[]> {
  const data = await readJsonApiResponse<unknown>(response, { maxBytes: 2 * 1024 * 1024 });
  if (!data || typeof data !== "object") throw new Error("Réponse de calendrier invalide.");
  const payload = data as Record<string, unknown>;
  if (payload.month !== expectedMonth || !Array.isArray(payload.events) || payload.events.length > 1200) throw new Error("Réponse de calendrier invalide.");
  const events = payload.events.map(value => {
    if (!value || typeof value !== "object") throw new Error("Rendez-vous invalide.");
    const row = value as Record<string, unknown>;
    const [date] = parseSchoolCalendarDates([{ key: row.key, title: row.title, startDate: row.startDate, endDate: row.endDate, startTime: row.startTime, endTime: row.endTime, location: row.location }]);
    const text = (key: string, max: number) => {
      const value = row[key];
      if (typeof value !== "string" || value.length > max) throw new Error("Rendez-vous invalide.");
      return value;
    };
    const articleId = text("articleId", 36), articleSlug = text("articleSlug", 140), id = text("id", 120);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(articleId) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(articleSlug) || id !== `${articleId}:${date.key}`) throw new Error("Rendez-vous invalide.");
    const updatedAt = text("updatedAt", 40);
    if (!Number.isFinite(Date.parse(updatedAt)) || !Number.isInteger(row.version) || Number(row.version) < 1 || typeof row.articleExpired !== "boolean") throw new Error("Rendez-vous invalide.");
    let image: SchoolCalendarEvent["image"] = null;
    if (row.image !== null && row.image !== undefined) {
      const candidate = row.image as Record<string, unknown>;
      const env = import.meta.env;
      if (typeof candidate.signedUrl !== "string" || !isAllowedPublicContentSignedUrlForOrigin(candidate.signedUrl, env.VITE_SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL) || typeof candidate.altText !== "string" || candidate.altText.length > 300) throw new Error("Image de calendrier invalide.");
      image = { signedUrl: candidate.signedUrl, altText: candidate.altText };
    }
    return { ...date, id, articleId, articleSlug, articleTitle: text("articleTitle", 180), category: text("category", 100), summary: text("summary", 600), version: Number(row.version), updatedAt, articleExpired: row.articleExpired, image };
  });
  if (new Set(events.map(event => event.id)).size !== events.length) throw new Error("Le calendrier contient un doublon.");
  return events;
}

export function useSchoolCalendar(month: string) {
  const [events, setEvents] = useState<SchoolCalendarEvent[]>([]);
  const [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setEvents([]); setError(""); setLoading(true);
    fetch(`/api/content/calendar?month=${encodeURIComponent(month)}`, { signal: controller.signal })
      .then(response => readSchoolCalendar(response, month))
      .then(value => { if (!controller.signal.aborted) setEvents(value); })
      .catch(() => { if (!controller.signal.aborted) setError("Le calendrier ne peut pas être chargé pour le moment."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [month, attempt]);
  return { events, loading, error, retry: () => setAttempt(value => value + 1) };
}
