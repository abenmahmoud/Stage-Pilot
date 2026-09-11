export type SchoolCalendarDate = {
  key: string; title: string; startDate: string; endDate: string;
  startTime: string | null; endTime: string | null; location: string;
};
export type SchoolCalendarEvent = SchoolCalendarDate & {
  id: string; articleId: string; articleSlug: string; articleTitle: string;
  category: string; summary: string; version: number; updatedAt: string;
  articleExpired: boolean; image: { signedUrl: string; altText: string } | null;
};
export function validCalendarDay(value: unknown): value is string {
  if (typeof value !== "string" || !/^(20\d{2}|2100)-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function shiftCalendarDay(value: string, days: number) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
export function parisToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  return ["year", "month", "day"].map(type => parts.find(part => part.type === type)?.value).join("-");
}
export function calendarMonthBounds(month: string) {
  if (!/^(20\d{2}|2100)-(0[1-9]|1[0-2])$/.test(month)) throw new Error("Le mois du calendrier est invalide.");
  const start = `${month}-01`;
  const date = new Date(`${start}T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + 1);
  return { start, end: shiftCalendarDay(date.toISOString().slice(0, 10), -1) };
}
export function shiftCalendarMonth(month: string, delta: number) {
  const date = new Date(`${calendarMonthBounds(month).start}T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + delta);
  return date.toISOString().slice(0, 7);
}
export function calendarMonthDays(month: string) {
  const { start, end } = calendarMonthBounds(month);
  const firstWeekday = (new Date(`${start}T12:00:00Z`).getUTCDay() + 6) % 7;
  return Array.from({ length: Math.ceil((firstWeekday + Number(end.slice(-2))) / 7) * 7 }, (_, index) => shiftCalendarDay(start, index - firstWeekday));
}
export function parseSchoolCalendarDates(value: unknown): SchoolCalendarDate[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > 12) throw new Error("Ajoutez au maximum douze rendez-vous par article.");
  const seen = new Set<string>();
  return value.map(entry => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new Error("Un rendez-vous est invalide.");
    const row = entry as Record<string, unknown>;
    const allowed = ["key", "title", "startDate", "endDate", "startTime", "endTime", "location"];
    if (Object.keys(row).some(key => !allowed.includes(key))) throw new Error("Un champ de rendez-vous est invalide.");
    if (typeof row.key !== "string" || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(row.key) || seen.has(row.key)) throw new Error("Un rendez-vous est dupliqué ou invalide.");
    seen.add(row.key);
    const text = (value: unknown, max: number, required = false) => {
      if (typeof value !== "string" || value.length > max || /[\u0000-\u001f\u007f]/.test(value) || (required && !value.trim())) throw new Error("Vérifiez le titre et le lieu du rendez-vous.");
      return value.trim();
    };
    const title = text(row.title, 180, true), location = text(row.location ?? "", 180);
    if (!validCalendarDay(row.startDate)) throw new Error("Renseignez une date de début valide.");
    const endDate = row.endDate || row.startDate;
    if (!validCalendarDay(endDate) || endDate < row.startDate || (Date.parse(endDate) - Date.parse(row.startDate)) > 366 * 86400000) throw new Error("Vérifiez la date de fin du rendez-vous.");
    const time = (value: unknown) => {
      if (value === undefined || value === null || value === "") return null;
      if (typeof value !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) throw new Error("Renseignez une heure valide.");
      return value;
    };
    const startTime = time(row.startTime), endTime = time(row.endTime);
    if ((!startTime && endTime) || (startTime && endTime && endDate === row.startDate && endTime <= startTime)) throw new Error("L’heure de fin doit suivre l’heure de début.");
    return { key: row.key, title, startDate: row.startDate, endDate, startTime, endTime, location };
  });
}
export function calendarDateLabel(event: SchoolCalendarDate) {
  const label = (value: string) => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));
  const date = event.startDate === event.endDate ? label(event.startDate) : `${label(event.startDate)} – ${label(event.endDate)}`;
  return `${date}${event.startTime ? ` · ${event.startTime.replace(":", " h ")}${event.endTime ? `–${event.endTime.replace(":", " h ")}` : ""}` : ""}`;
}
export function calendarArticleHref(event: SchoolCalendarEvent) {
  return `/site/${encodeURIComponent(event.articleSlug)}${event.articleExpired ? "?archive=expired" : ""}`;
}
