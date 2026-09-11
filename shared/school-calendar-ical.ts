import { calendarArticleHref, shiftCalendarDay, type SchoolCalendarEvent } from "./school-calendar.js";
const ORIGIN = "https://lycee-blaise-cendrars-sevran.fr";
const escapeText = (value: string) => value.replace(/\\/g, "\\\\").replace(/\r\n|\r|\n/g, "\\n").replace(/;/g, "\\;").replace(/,/g, "\\,");
const day = (value: string) => value.replace(/-/g, "");
const stamp = (value: string) => new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
// RFC 5545: fold at 75 UTF-8 octets, preserving whole Unicode characters.
function foldLine(line: string) {
  const encoder = new TextEncoder(), lines: string[] = [];
  let current = "", bytes = 0;
  for (const character of line) {
    const size = encoder.encode(character).length;
    if (bytes + size > 75) { lines.push(current); current = " "; bytes = 1; }
    current += character; bytes += size;
  }
  return [...lines, current].join("\r\n");
}
export function schoolCalendarIcal(events: SchoolCalendarEvent[]) {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Lycee Blaise Cendrars//Calendrier public//FR", "CALSCALE:GREGORIAN", "X-WR-CALNAME:Calendrier du lycée Blaise Cendrars"];
  if (events.some(event => event.startTime)) lines.push(
    "BEGIN:VTIMEZONE", "TZID:Europe/Paris", "BEGIN:DAYLIGHT", "DTSTART:19960331T020000",
    "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU", "TZOFFSETFROM:+0100", "TZOFFSETTO:+0200", "TZNAME:CEST", "END:DAYLIGHT",
    "BEGIN:STANDARD", "DTSTART:19961027T030000", "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
    "TZOFFSETFROM:+0200", "TZOFFSETTO:+0100", "TZNAME:CET", "END:STANDARD", "END:VTIMEZONE",
  );
  for (const event of events) {
    lines.push("BEGIN:VEVENT", `UID:${event.articleId}-${event.key}@lycee-blaise-cendrars-sevran.fr`, `DTSTAMP:${stamp(event.updatedAt)}`, `SEQUENCE:${event.version}`, `SUMMARY:${escapeText(event.title)}`);
    if (event.startTime) {
      lines.push(`DTSTART;TZID=Europe/Paris:${day(event.startDate)}T${event.startTime.replace(":", "")}00`);
      if (event.endTime) lines.push(`DTEND;TZID=Europe/Paris:${day(event.endDate)}T${event.endTime.replace(":", "")}00`);
    } else lines.push(`DTSTART;VALUE=DATE:${day(event.startDate)}`, `DTEND;VALUE=DATE:${day(shiftCalendarDay(event.endDate, 1))}`);
    const url = `${ORIGIN}${calendarArticleHref(event)}`;
    lines.push(`DESCRIPTION:${escapeText(`${event.summary}${event.startTime ? "" : "\nHoraire non communiqué : consultez les précisions du lycée."}\n${url}`)}`, `URL:${url}`, "TRANSP:TRANSPARENT");
    if (event.location) lines.push(`LOCATION:${escapeText(event.location)}`);
    lines.push("END:VEVENT");
  }
  return [...lines, "END:VCALENDAR"].map(foldLine).join("\r\n") + "\r\n";
}
