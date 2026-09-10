import type { ScheduleDayCourse } from './schedule-policy.js';

export type SchedulePresentation = {
  title: string;
  courses: ScheduleDayCourse[];
  updatedAt: string;
  incompleteGroups: boolean;
};
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const exact = (v: Record<string, unknown>, keys: string[]) => Object.keys(v).length === keys.length && keys.every(k => k in v);
const text = (v: unknown, n: number) => typeof v === 'string' && v.trim().length > 0 && v.length <= n && !/[\u0000-\u001f]/.test(v);
const instant = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v) && Number.isFinite(Date.parse(v));

/** Only the private schedule reader supplies this data; the language model cannot add it. */
export function isSchedulePresentation(value: unknown): value is SchedulePresentation {
  if (!record(value) || !exact(value, ['title', 'courses', 'updatedAt', 'incompleteGroups'])
    || !text(value.title, 120) || !instant(value.updatedAt) || typeof value.incompleteGroups !== 'boolean'
    || !Array.isArray(value.courses) || value.courses.length > 100) return false;
  return value.courses.every(c => record(c) && exact(c, ['subjectCode', 'subjectLabel', 'roomCode', 'startsAt', 'endsAt', 'state'])
    && text(c.subjectCode, 80) && text(c.subjectLabel, 160) && (c.roomCode === null || text(c.roomCode, 80))
    && instant(c.startsAt) && instant(c.endsAt) && Date.parse(c.endsAt) > Date.parse(c.startsAt)
    && ['scheduled', 'maintained', 'moved', 'cancelled'].includes(String(c.state)));
}
