import { sql, type SQL } from 'drizzle-orm';
import { parseScheduleAdminPreview, previewDayBounds, type SchedulePreviewRequest } from '../../shared/schedule-admin-preview.js';

export class SchedulePreviewError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}
type PreviewTx = { execute: (query: SQL) => Promise<unknown> };
function rows<T>(result: unknown): T[] { return (Array.isArray(result) ? result : (result as { rows: T[] }).rows) as T[]; }
const iso = (v: unknown) => v instanceof Date ? v.toISOString() : v;

/** Management-only read. Never marks a version active or impersonates a learner. */
export async function readScheduleAdminPreview(tx: PreviewTx, institutionId: string, request: SchedulePreviewRequest) {
  const [source] = rows<{
    label: string; sourceKind: string; sourceStatus: string; updatedAt: Date; freshUntil: Date;
    subjectRef: string; effectiveFrom: string; effectiveUntil: string | null;
  }>(await tx.execute(sql`
    select c.calendar_label as label, s.source_kind as "sourceKind", s.status as "sourceStatus",
      s.updated_at as "updatedAt", s.fresh_until as "freshUntil", c.subject_ref as "subjectRef",
      s.effective_from::text as "effectiveFrom", s.effective_until::text as "effectiveUntil"
    from public.schedule_source_versions s
    join public.schedule_ical_candidates c on c.source_version_id=s.id and c.institution_id=s.institution_id
    join public.schedule_page_indexes p on p.source_version_id=s.id and p.institution_id=s.institution_id
      and p.page_number=c.calendar_number and p.subject_ref=c.subject_ref
      and p.subject_type=case when s.source_kind='classes' then 'class' else 'teacher' end
    where s.institution_id=${institutionId} and s.id=${request.sourceId} and c.id=${request.calendarId}
      and s.source_format='ical_import' and s.status in ('review','approved','active','superseded')
      and s.validation_summary->>'securityScan'='clean'
      and c.status='applied' and c.decision='include' and p.review_status='verified'
    limit 1
  `));
  if (!source) throw new SchedulePreviewError(404, 'Ce calendrier validé n’est pas disponible pour un aperçu.');
  if (request.day < source.effectiveFrom || (source.effectiveUntil && request.day > source.effectiveUntil)) {
    throw new SchedulePreviewError(400, 'Choisissez une date dans la période de validité de cette version.');
  }
  const { dayStart, dayEnd } = previewDayBounds(request.day);
  const courses = rows<Record<string, unknown>>(await tx.execute(sql`
    select subject_label as subject, room_code as room, starts_at as "startsAt", ends_at as "endsAt", (group_ref is not null) as "inGroup"
    from public.schedule_slots
    where institution_id=${institutionId} and source_version_id=${request.sourceId} and review_status='approved'
      and ((${source.sourceKind}='classes' and class_ref=${source.subjectRef})
        or (${source.sourceKind}='teachers' and teacher_ref=${source.subjectRef}))
      and starts_at<=${dayEnd.toISOString()}::timestamptz and ends_at>${dayStart.toISOString()}::timestamptz
    order by starts_at, ends_at, subject_label, id limit 101
  `));
  if (courses.length > 100) throw new SchedulePreviewError(409, 'Cette journée contient trop de créneaux pour l’aperçu. Consultez l’export EDT.');
  const result = parseScheduleAdminPreview({
    ...request, label: source.label, sourceKind: source.sourceKind, sourceStatus: source.sourceStatus,
    updatedAt: iso(source.updatedAt), freshUntil: iso(source.freshUntil),
    courses: courses.map(c => ({ subject: c.subject, room: c.room, startsAt: iso(c.startsAt), endsAt: iso(c.endsAt), inGroup: c.inGroup })),
  }, request);
  if (!result) throw new SchedulePreviewError(409, 'L’aperçu contient des données incohérentes. Vérifiez la source EDT.');
  return result;
}
