import { isSchedulePresentation, type SchedulePresentation } from './schedule-presentation.js';
import { validCalendarDay } from './school-calendar.js';
import { isPersonalNewsFeed, type PersonalNewsFeed } from './personal-news.js';

export type PersonalHomeTarget = { key: string; label: string };
export type PersonalHomeRequest = { publicCode: string; subject: string; status: string; hasDocument: boolean };
export type PersonalHome = { status: 'unavailable' } | {
  status: 'verified'; personType: 'student' | 'guardian' | 'staff';
  expiresAt: string; date: string; targets: PersonalHomeTarget[]; selectedTarget: string | null;
  schedule: { status: 'ready'; value: SchedulePresentation; validUntil: string }
    | { status: 'unavailable'; message: string };
  requests: { status: 'available' | 'unavailable'; items: PersonalHomeRequest[]; more: boolean };
  news?: PersonalNewsFeed;
};

export const PERSONAL_HOME_STATUS_LABELS: Record<string, string> = {
  nouveau: 'Demande reçue', a_qualifier: 'Demande reçue', assigne: 'Prise en charge',
  en_cours: 'En cours de traitement', attente_demandeur: 'Votre réponse est attendue',
  attente_interne: 'En cours de traitement', resolu: 'Réponse apportée', clos: 'Demande terminée',
};
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const exact = (v: Record<string, unknown>, keys: string[]) => Object.keys(v).length === keys.length && keys.every(key => key in v);
const text = (v: unknown, max: number): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= max && !/[\u0000-\u001f]/.test(v);
const instant = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v) && Number.isFinite(Date.parse(v));
export function isPersonalHome(value: unknown): value is PersonalHome {
  if (!record(value)) return false;
  if (value.status === 'unavailable') return exact(value, ['status']);
  if ('news' in value && !isPersonalNewsFeed(value.news)) return false;
  if (value.status !== 'verified' || !exact(value, ['status', 'personType', 'expiresAt', 'date', 'targets', 'selectedTarget', 'schedule', 'requests', ...('news' in value ? ['news'] : [])])
    || !['student', 'guardian', 'staff'].includes(String(value.personType)) || !instant(value.expiresAt) || !validCalendarDay(value.date)
    || !Array.isArray(value.targets) || value.targets.length > 20) return false;
  if (!value.targets.every(t => record(t) && exact(t, ['key', 'label']) && typeof t.key === 'string' && /^[a-f0-9]{64}$/.test(t.key) && text(t.label, 120))
    || new Set(value.targets.map(t => t.key)).size !== value.targets.length
    || (value.selectedTarget !== null && !value.targets.some(t => t.key === value.selectedTarget))) return false;
  const schedule = value.schedule, requests = value.requests;
  if (!record(schedule) || !record(requests)) return false;
  if (schedule.status === 'ready') {
    if (!exact(schedule, ['status', 'value', 'validUntil']) || !isSchedulePresentation(schedule.value) || !instant(schedule.validUntil) || value.selectedTarget === null) return false;
  } else if (schedule.status !== 'unavailable' || !exact(schedule, ['status', 'message']) || !text(schedule.message, 400)) return false;
  return exact(requests, ['status', 'items', 'more']) && ['available', 'unavailable'].includes(String(requests.status))
    && typeof requests.more === 'boolean' && Array.isArray(requests.items) && requests.items.length <= 3
    && (requests.status !== 'unavailable' || (requests.items.length === 0 && !requests.more))
    && requests.items.every(r => record(r) && exact(r, ['publicCode', 'subject', 'status', 'hasDocument'])
      && typeof r.publicCode === 'string' && /^BC-\d{4}-\d{6}$/.test(r.publicCode) && text(r.subject, 180)
      && typeof r.status === 'string' && Object.hasOwn(PERSONAL_HOME_STATUS_LABELS, r.status) && typeof r.hasDocument === 'boolean');
}
