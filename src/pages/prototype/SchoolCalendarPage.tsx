import { useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, CalendarDays, CalendarPlus, ChevronLeft, ChevronRight, Clock3, Download, List, LoaderCircle, MapPin } from "lucide-react";
import { NewsPhoto } from "../../components/NewsPhoto";
import { useSchoolCalendar } from "../../lib/school-calendar-client";
import { calendarArticleHref, calendarDateLabel, calendarMonthBounds, calendarMonthDays, parisToday, shiftCalendarDay, shiftCalendarMonth, validCalendarDay, type SchoolCalendarEvent } from "../../../shared/school-calendar";
import "../../styles/school-calendar.css";

const dayLabel = (day: string) => new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`));
export function CalendarEventPhoto({ event }: { event: SchoolCalendarEvent }) {
  return <NewsPhoto compact content={{ title: event.articleTitle, category: event.category, slug: event.articleSlug, assets: event.image ? [{ assetKind: "image", role: "couverture", ...event.image }] : [] }} />;
}
function CalendarEventCard({ event, month, today }: { event: SchoolCalendarEvent; month: string; today: string }) {
  const past = event.endDate < today;
  return <article className={`school-calendar-event ${past ? "is-past" : ""}`}>
    <div className="school-calendar-date"><strong>{Number(event.startDate.slice(-2))}{event.endDate !== event.startDate && event.startDate.slice(0,7) === event.endDate.slice(0,7) ? `–${Number(event.endDate.slice(-2))}` : ""}</strong><span>{new Intl.DateTimeFormat("fr-FR", { month: "short", timeZone: "UTC" }).format(new Date(`${event.startDate}T12:00:00Z`))}</span></div>
    <CalendarEventPhoto event={event} />
    <div className="school-calendar-event-copy"><h3>{event.title}</h3><p className="school-calendar-event-meta"><Clock3 aria-hidden="true" />{calendarDateLabel(event)}{past ? " · Passé" : ""}</p>
      {!event.startTime ? <p className="school-calendar-time-note">Horaire non communiqué</p> : null}
      {event.location ? <p className="school-calendar-event-meta"><MapPin aria-hidden="true" />{event.location}</p> : null}
      <div className="school-calendar-event-actions"><Link to={calendarArticleHref(event)}>Lire l’actualité <ArrowRight aria-hidden="true" /></Link><a href={`/api/content/calendar?month=${month}&event=${encodeURIComponent(event.id)}&format=ics`} download><CalendarPlus aria-hidden="true" /> Ajouter à mon agenda</a></div>
    </div>
  </article>;
}

export default function SchoolCalendarPage() {
  const [params, setParams] = useSearchParams();
  const today = parisToday();
  const requestedDay = params.get("date");
  let month = params.get("month") ?? (validCalendarDay(requestedDay) ? requestedDay.slice(0, 7) : today.slice(0, 7));
  try { calendarMonthBounds(month); } catch { month = today.slice(0, 7); }
  const selected = validCalendarDay(requestedDay) && requestedDay.startsWith(month) ? requestedDay : null;
  const [mobileMode, setMobileMode] = useState<"list" | "month">("list");
  const { events, loading, error, retry } = useSchoolCalendar(month);
  const grid = useRef<HTMLDivElement>(null);
  const days = calendarMonthDays(month);
  const chosen = selected ? events.filter(event => event.startDate <= selected && event.endDate >= selected) : events;
  const monthLabel = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T12:00:00Z`));
  function goMonth(next: string) { setParams({ view: "calendar", month: next }); }
  function choose(day: string) { setParams({ view: "calendar", month: day.slice(0, 7), date: day }); }
  function moveDay(event: React.KeyboardEvent<HTMLButtonElement>, day: string) {
    const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[event.key];
    if (delta === undefined) return;
    event.preventDefault();
    const target = shiftCalendarDay(day, delta);
    const button = grid.current?.querySelector<HTMLButtonElement>(`[data-day="${target}"]`);
    if (button) button.focus();
  }
  return <div className="lycee-page school-calendar-page">
    <header className="lycee-page-intro"><Link className="school-calendar-back" to="/" aria-label="Retour à l’accueil"><ArrowLeft /></Link><div><h1>Le calendrier du lycée</h1><p>Les dates à retenir, au même endroit.</p></div><Link className="school-calendar-news-link" to="/?view=news">À la une <ArrowRight /></Link></header>
    <div className="school-calendar-mobile-mode" role="group" aria-label="Affichage du calendrier"><button type="button" aria-pressed={mobileMode === "list"} onClick={() => setMobileMode("list")}><List /> Liste</button><button type="button" aria-pressed={mobileMode === "month"} onClick={() => setMobileMode("month")}><CalendarDays /> Mois</button></div>
    <div className={`school-calendar-layout mode-${mobileMode}`}>
      <section className="school-calendar-month" aria-label="Choisir une date">
        <div className="school-calendar-month-heading"><h2>{monthLabel}</h2><div><button type="button" disabled={month === "2000-01"} onClick={() => goMonth(shiftCalendarMonth(month,-1))} aria-label="Mois précédent"><ChevronLeft /></button><button type="button" onClick={() => goMonth(parisToday().slice(0,7))}>Aujourd’hui</button><button type="button" disabled={month === "2100-12"} onClick={() => goMonth(shiftCalendarMonth(month,1))} aria-label="Mois suivant"><ChevronRight /></button></div></div>
        <div className="school-calendar-weekdays" aria-hidden="true">{["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map(day => <span key={day}>{day}</span>)}</div>
        <div className="school-calendar-grid" ref={grid}>{days.map(day => {
          const count = events.filter(event => event.startDate <= day && event.endDate >= day).length;
          return <button key={day} type="button" data-day={day} disabled={!day.startsWith(month)} className={`${!day.startsWith(month) ? "is-outside" : ""} ${day === today ? "is-today" : ""} ${day === selected ? "is-selected" : ""}`} aria-pressed={day === selected} aria-label={`${dayLabel(day)}${day === today ? ", aujourd’hui" : ""}, ${count} rendez-vous`} onClick={() => choose(day)} onKeyDown={event => moveDay(event, day)}><span>{Number(day.slice(-2))}</span>{count ? <i aria-hidden="true" /> : null}</button>;
        })}</div>
        <p className="school-calendar-legend"><i /> Dates publiées par le lycée</p>
      </section>
      <section className="school-calendar-agenda" aria-labelledby="school-calendar-list-title" aria-busy={loading}>
        <div className="school-calendar-agenda-heading"><h2 id="school-calendar-list-title">{selected ? dayLabel(selected) : "Les rendez-vous du mois"}</h2>{selected ? <button type="button" onClick={() => goMonth(month)}>Tout le mois</button> : null}</div>
        <div className="school-calendar-mobile-month"><button type="button" aria-label="Mois précédent" disabled={month === "2000-01"} onClick={() => goMonth(shiftCalendarMonth(month,-1))}><ChevronLeft /></button><strong>{monthLabel}</strong><button type="button" aria-label="Mois suivant" disabled={month === "2100-12"} onClick={() => goMonth(shiftCalendarMonth(month,1))}><ChevronRight /></button></div>
        {loading ? <p className="school-calendar-state" role="status"><LoaderCircle className="is-spinning" /> Chargement des rendez-vous…</p> : error ? <div className="school-calendar-state" role="alert"><p>{error}</p><button type="button" onClick={retry}>Réessayer</button></div> : chosen.length ? <div>{chosen.map(event => <CalendarEventCard key={event.id} event={event} month={month} today={today} />)}</div> : <div className="school-calendar-state"><CalendarDays /><h3>{selected ? "Aucun rendez-vous publié pour cette date" : "Aucun rendez-vous publié pour ce mois"}</h3><p>Les prochaines dates apparaîtront ici après publication par le lycée.</p>{selected ? <button type="button" onClick={() => goMonth(month)}>Voir tout le mois</button> : null}</div>}
        {!loading && !error && events.length ? <div className="school-calendar-export"><a href={`/api/content/calendar?month=${month}&format=ics`} download><Download /> Ajouter ce mois à mon agenda</a><p>Le fichier calendrier s’importe dans votre agenda. Il conserve les dates connues ; consultez le site pour les mises à jour.</p></div> : null}
      </section>
    </div>
  </div>;
}

export function HomeCalendarPreview() {
  const today = parisToday(), month = today.slice(0,7);
  const current = useSchoolCalendar(month), next = useSchoolCalendar(shiftCalendarMonth(month,1));
  const upcoming = [...new Map([...current.events, ...next.events].filter(event => event.endDate >= today).map(event => [event.id, event])).values()].sort((a,b) => a.startDate.localeCompare(b.startDate)).slice(0,2);
  return <section className="school-calendar-preview" aria-labelledby="calendar-preview-title">
    <div className="school-calendar-preview-heading"><div><CalendarDays /><h2 id="calendar-preview-title">Les prochains rendez-vous</h2></div><Link to="/?view=calendar">Le calendrier <ArrowRight /></Link></div>
    {upcoming.length ? <div className="school-calendar-preview-list">{upcoming.map(event => <Link key={event.id} to={`/?view=calendar&date=${event.startDate < today ? today : event.startDate}`}><CalendarEventPhoto event={event} /><span><small>{calendarDateLabel(event)}</small><strong>{event.title}</strong></span><ChevronRight /></Link>)}</div> : <p>{current.loading || next.loading ? "Chargement des dates…" : current.error || next.error ? "Les dates ne sont pas disponibles pour le moment." : "Les prochaines dates seront annoncées ici."}</p>}
  </section>;
}
