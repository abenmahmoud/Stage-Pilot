import { createHash, randomUUID } from 'node:crypto';
import { sql, type SQL } from 'drizzle-orm';
import type { SchedulePublicationPlan } from '../../shared/schedule-publication.js';

type Tx = { execute: (query: SQL) => Promise<unknown> };
export class SchedulePublicationError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}
const rows = <T>(r: unknown) => (Array.isArray(r) ? r : (r as { rows: T[] }).rows) as T[];
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
type Source = { id: string; source_kind: string; school_year: string; status: string; checksum: string; page_count: number; storage_path: string;
  effective_from: string; effective_until: string | null; fresh_until: Date; validation_summary: Record<string, unknown> };
type Calendar = { id: string; calendar_number: number; subject_ref: string | null; status: string; decision: string | null;
  valid_page: boolean; known_subject: boolean; slot_count: number; slot_hash: string | null };
type Active = { id: string; validation_summary: Record<string, unknown> };

/** The original import stays in review. Only an immutable, fully checked snapshot is published. */
export async function readSchedulePublication(tx: Tx, institutionId: string, sourceId: string) {
  const [source] = rows<Source>(await tx.execute(sql`select id,source_kind,school_year,status,checksum,page_count,storage_path,
    effective_from::text,effective_until::text,fresh_until,validation_summary
    from public.schedule_source_versions where id=${sourceId} and institution_id=${institutionId} and source_format='ical_import'`));
  if (!source) throw new SchedulePublicationError(404, 'Import iCal introuvable.');
  if (source.status !== 'review' || source.validation_summary.publicationOriginId) throw new SchedulePublicationError(409, 'Choisissez l’import d’origine encore à vérifier.');
  if (!source.checksum || !source.page_count || source.validation_summary.securityScan !== 'clean' || source.validation_summary.pageCountVerified !== true) throw new SchedulePublicationError(409, 'Le contrôle technique de cet import doit être terminé.');
  if (!source.fresh_until || new Date(source.fresh_until).getTime() <= Date.now()) throw new SchedulePublicationError(409, 'Cet export doit être actualisé avant sa mise en service.');
  const calendars = rows<Calendar>(await tx.execute(sql`
    select c.id,c.calendar_number,c.subject_ref,c.status,c.decision,
      coalesce(p.review_status='verified' and p.subject_ref=c.subject_ref
        and p.subject_type=case when ${source.source_kind}='classes' then 'class' else 'teacher' end,false) as valid_page,
      exists(select 1 from public.identity_directory_rows r join public.identity_directory_imports i on i.id=r.import_id and i.institution_id=r.institution_id
        where r.institution_id=${institutionId} and i.status='active' and r.record_type='person' and r.validation_status in ('valid','warning')
          and (r.valid_from is null or r.valid_from<=current_date) and (r.valid_until is null or r.valid_until>=current_date)
          and ((${source.source_kind}='classes' and upper(r.class_ref)=c.subject_ref)
            or (${source.source_kind}='teachers' and r.person_type='staff' and upper(r.person_ref)=c.subject_ref))) as known_subject,
      coalesce(t.n,0)::int as slot_count,t.fingerprint as slot_hash
    from public.schedule_ical_candidates c
    left join public.schedule_page_indexes p on p.institution_id=c.institution_id and p.source_version_id=c.source_version_id and p.page_number=c.calendar_number
    left join lateral(select count(*)::int as n,md5(string_agg(md5(row_to_json(s)::text),'' order by s.id)) as fingerprint
      from public.schedule_slots s where s.institution_id=c.institution_id and s.source_version_id=c.source_version_id and s.review_status='approved'
        and ((${source.source_kind}='classes' and s.class_ref=c.subject_ref) or (${source.source_kind}='teachers' and s.teacher_ref=c.subject_ref))) t on c.status='applied' and c.decision='include'
    where c.institution_id=${institutionId} and c.source_version_id=${sourceId} order by c.calendar_number limit 251`));
  if (calendars.length !== source.page_count || calendars.length > 250) throw new SchedulePublicationError(409, 'Le bilan des calendriers est incomplet.');
  if (calendars.some(c => c.status === 'queued')) throw new SchedulePublicationError(409, 'Des calendriers sont encore en cours d’enregistrement. Actualisez dans quelques instants.');
  const ready = calendars.filter(c => c.status === 'applied' && c.decision === 'include');
  if (ready.some(c => !c.valid_page || !c.known_subject || !c.slot_count)) throw new SchedulePublicationError(409, 'Un calendrier rattaché doit être revérifié : annuaire, correspondance ou cours incomplets.');
  const [active] = rows<Active>(await tx.execute(sql`select id,validation_summary from public.schedule_source_versions
    where institution_id=${institutionId} and source_kind=${source.source_kind} and school_year=${source.school_year} and status='active' limit 1`));
  // A partial replacement must never silently withdraw previously available calendars.
  if (active) {
    const previous = rows<{ subject_ref: string }>(await tx.execute(sql`select subject_ref from public.schedule_page_indexes
      where institution_id=${institutionId} and source_version_id=${active.id} and review_status='verified' and subject_ref not like 'EXCLUDED:%'`));
    if (previous.some(p => !ready.some(c => c.subject_ref === p.subject_ref))) throw new SchedulePublicationError(409, 'Cette publication retirerait des calendriers déjà en service. Complétez les correspondances avant de remplacer la version active.');
  }
  const snapshotHash = digest([source.checksum, source.effective_from, source.effective_until, source.fresh_until, ready]);
  const excludedCount = calendars.filter(c => c.status === 'applied' && c.decision === 'exclude').length;
  const waitingCount = calendars.length - ready.length - excludedCount;
  const plan: SchedulePublicationPlan = { sourceId, token: digest([snapshotHash, calendars, active?.id ?? null]), readyCount: ready.length,
    waitingCount, excludedCount, activeSourceId: active?.id ?? null,
    alreadyPublished: active?.validation_summary.publicationOriginId === sourceId && active.validation_summary.publicationHash === snapshotHash };
  return { plan, source, ready, active, snapshotHash };
}

export async function publishScheduleCalendars(tx: Tx, params: { institutionId: string; sourceId: string; actorId: string; token: string; justification: string },
  copy: (from: string, to: string) => Promise<void>) {
  const { institutionId, sourceId, actorId } = params;
  const [scope] = rows<{ source_kind: string; school_year: string }>(await tx.execute(sql`select source_kind,school_year from public.schedule_source_versions where id=${sourceId} and institution_id=${institutionId}`));
  if (!scope) throw new SchedulePublicationError(404, 'Import introuvable.');
  await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`${institutionId}:${scope.source_kind}:${scope.school_year}`},61743))`);
  await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${sourceId}::text,61744))`);
  await tx.execute(sql`select id from public.schedule_source_versions where id=${sourceId} and institution_id=${institutionId} for update`);
  const current = await readSchedulePublication(tx, institutionId, sourceId);
  const { plan, source, ready, active, snapshotHash } = current;
  const receipt = (activeSourceId: string, duplicate: boolean) => ({ sourceId, token: params.token, activeSourceId, readyCount: plan.readyCount, waitingCount: plan.waitingCount, duplicate });
  if (active?.validation_summary.publicationRequestToken === params.token && plan.alreadyPublished) return receipt(active.id, true);
  if (params.token !== plan.token) throw new SchedulePublicationError(409, 'Les calendriers ont changé. Actualisez le bilan avant d’activer.');
  if (plan.alreadyPublished && active) return receipt(active.id, true);
  if (!ready.length) throw new SchedulePublicationError(409, 'Validez au moins un calendrier contenant des cours.');
  const snapshotId = randomUUID();
  const path = `${institutionId}/${source.school_year}/${source.source_kind}/${actorId}/${snapshotId}.ics`;
  // Private storage copy: preserve the original evidence and its checksum, never extend freshness.
  await copy(source.storage_path, path);
  const metadata = { ...source.validation_summary, pageCountVerified: true, humanMapping: 'verified', activation: 'ready',
    publicationOriginId: sourceId, publicationHash: snapshotHash, publicationRequestToken: params.token,
    originalCalendarCount: source.page_count, publishedCalendarCount: ready.length, waitingCalendarCount: plan.waitingCount };
  await tx.execute(sql`insert into public.schedule_source_versions(id,institution_id,source_kind,source_format,origin_source_id,school_year,version,title,purpose_description,
    effective_from,effective_until,fresh_until,original_name,mime_type,size_bytes,storage_bucket,storage_path,checksum,page_count,status,validation_summary,uploaded_by,uploaded_at)
    select ${snapshotId},institution_id,source_kind,source_format,${sourceId},school_year,
      (select coalesce(max(v.version),0)+1 from public.schedule_source_versions v where v.institution_id=${institutionId} and v.source_kind=${source.source_kind} and v.school_year=${source.school_year}),
      left(title,135)||' · Calendriers validés',purpose_description,effective_from,effective_until,fresh_until,original_name,mime_type,size_bytes,storage_bucket,${path},checksum,${ready.length},'review',${JSON.stringify(metadata)}::jsonb,${actorId},now()
    from public.schedule_source_versions where id=${sourceId} and institution_id=${institutionId}`);
  const ids = sql.join(ready.map(c => sql`${c.id}::uuid`), sql`, `);
  await tx.execute(sql`insert into public.schedule_page_indexes(institution_id,source_version_id,page_number,subject_type,subject_ref,review_status,reviewed_by,reviewed_at)
    select ${institutionId},${snapshotId},row_number() over(order by c.calendar_number),p.subject_type,p.subject_ref,'verified',p.reviewed_by,p.reviewed_at
    from public.schedule_ical_candidates c join public.schedule_page_indexes p on p.institution_id=c.institution_id and p.source_version_id=c.source_version_id and p.page_number=c.calendar_number and p.subject_ref=c.subject_ref
    where c.institution_id=${institutionId} and c.source_version_id=${sourceId} and c.id in (${ids}) and c.status='applied' and c.decision='include' and p.review_status='verified'`);
  await tx.execute(sql`insert into public.schedule_slots(institution_id,source_version_id,class_ref,group_ref,teacher_ref,subject_code,subject_label,room_code,starts_at,ends_at,week_pattern,parse_confidence,review_status,reviewed_by,reviewed_at)
    select s.institution_id,${snapshotId},s.class_ref,s.group_ref,s.teacher_ref,s.subject_code,s.subject_label,s.room_code,s.starts_at,s.ends_at,s.week_pattern,s.parse_confidence,s.review_status,s.reviewed_by,s.reviewed_at
    from public.schedule_slots s where s.institution_id=${institutionId} and s.source_version_id=${sourceId} and s.review_status='approved'
      and exists(select 1 from public.schedule_ical_candidates c where c.institution_id=s.institution_id and c.source_version_id=s.source_version_id and c.id in (${ids})
        and ((${source.source_kind}='classes' and c.subject_ref=s.class_ref) or (${source.source_kind}='teachers' and c.subject_ref=s.teacher_ref)))`);
  // Existing database approval and immutability triggers remain in force.
  await tx.execute(sql`update public.schedule_source_versions set status='approved',approved_by=${actorId},approved_at=now() where id=${snapshotId} and institution_id=${institutionId}`);
  if (active) await tx.execute(sql`update public.schedule_source_versions set status='superseded' where id=${active.id} and institution_id=${institutionId} and status='active'`);
  await tx.execute(sql`update public.schedule_source_versions set status='active',activated_by=${actorId},activated_at=now() where id=${snapshotId} and institution_id=${institutionId} and status='approved'`);
  for (const action of ['approve','activate']) await tx.execute(sql`insert into public.schedule_audit(institution_id,source_version_id,action,actor_id,summary)
    values(${institutionId},${snapshotId},${action},${actorId},${JSON.stringify({ justification: params.justification, originSourceId: sourceId, publishedCount: ready.length, waitingCount: plan.waitingCount, replacedSourceId: active?.id ?? null })}::jsonb)`);
  if (active) await tx.execute(sql`insert into public.schedule_audit(institution_id,source_version_id,action,actor_id,summary)
    values(${institutionId},${active.id},'supersede',${actorId},${JSON.stringify({ replacementSourceVersionId: snapshotId })}::jsonb)`);
  return receipt(snapshotId, false);
}
