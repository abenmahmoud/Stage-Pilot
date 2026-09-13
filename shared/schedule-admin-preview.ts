import { schoolDayBoundsUtc } from './assistant-school-context.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const exact = (v: Record<string, unknown>, keys: string[]) => Object.keys(v).length === keys.length && keys.every(k => k in v);
const text = (v: unknown, max: number): v is string => typeof v === 'string' && !!v.trim() && v.length <= max && !/[\u0000-\u001f]/.test(v);
const instant = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v) && Number.isFinite(Date.parse(v));
export const PREVIEW_STATUSES = ['review', 'approved', 'active', 'superseded'] as const;
export type SchedulePreviewRequest = { sourceId: string; calendarId: string; day: string };
export type SchedulePreviewCourse = { subject: string; room: string | null; startsAt: string; endsAt: string; inGroup: boolean };
export type ScheduleAdminPreview = SchedulePreviewRequest & {
  label: string; sourceKind: 'classes' | 'teachers'; sourceStatus: typeof PREVIEW_STATUSES[number];
  updatedAt: string; freshUntil: string; courses: SchedulePreviewCourse[];
};

export function parseSchedulePreviewRequest(value: unknown): SchedulePreviewRequest | null {
  if (!record(value) || !exact(value, ['sourceId', 'calendarId', 'day'])
    || typeof value.sourceId !== 'string' || !UUID.test(value.sourceId)
    || typeof value.calendarId !== 'string' || !UUID.test(value.calendarId)
    || typeof value.day !== 'string' || !/^20\d{2}-\d{2}-\d{2}$/.test(value.day)) return null;
  const date = new Date(value.day + 'T12:00:00.000Z');
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value.day) return null;
  return { sourceId: value.sourceId, calendarId: value.calendarId, day: value.day };
}

export function previewDayBounds(day: string) {
  return schoolDayBoundsUtc(new Date(day + 'T12:00:00.000Z'));
}

export function parseScheduleAdminPreview(value: unknown, expected: SchedulePreviewRequest): ScheduleAdminPreview | null {
  if (!parseSchedulePreviewRequest(expected) || !record(value)
    || !exact(value, ['sourceId', 'calendarId', 'day', 'label', 'sourceKind', 'sourceStatus', 'updatedAt', 'freshUntil', 'courses'])
    || value.sourceId !== expected.sourceId || value.calendarId !== expected.calendarId || value.day !== expected.day
    || !text(value.label, 180) || !['classes', 'teachers'].includes(String(value.sourceKind))
    || !PREVIEW_STATUSES.includes(value.sourceStatus as typeof PREVIEW_STATUSES[number])
    || !instant(value.updatedAt) || !instant(value.freshUntil) || !Array.isArray(value.courses) || value.courses.length > 100) return null;
  const bounds = previewDayBounds(expected.day);
  let lastStart = '';
  for (const course of value.courses) {
    if (!record(course) || !exact(course, ['subject', 'room', 'startsAt', 'endsAt', 'inGroup'])
      || !text(course.subject, 160) || (course.room !== null && !text(course.room, 80))
      || !instant(course.startsAt) || !instant(course.endsAt) || course.endsAt <= course.startsAt
      || course.startsAt < lastStart || Date.parse(course.startsAt) > bounds.dayEnd.getTime()
      || Date.parse(course.endsAt) <= bounds.dayStart.getTime() || typeof course.inGroup !== 'boolean') return null;
    lastStart = course.startsAt;
  }
  return value as ScheduleAdminPreview;
}
