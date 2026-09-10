import { comparableIdentityName } from '../shared/identity-contact-choices.mjs';
import { decryptIdentityVaultPayload, identityVaultKeyForVersion } from './identity-directory-vault.mjs';

const REF = /^[A-Z0-9][A-Z0-9._:-]{1,79}$/;
const normalizeRef = value => String(value).normalize('NFKC').trim().toUpperCase();
const calendarKey = (value, kind) => kind === 'classes'
  ? normalizeRef(value).normalize('NFD').replace(/\p{M}/gu, '').replace(/[^A-Z0-9]/g, '')
  : comparableIdentityName(String(value).replace(/^(?:M\.|Mme\.?|Mlle\.?|Monsieur|Madame)\s+/i, ''));

export async function suggestIcalSubjects(sql, source, calendars) {
  const [directory] = await sql`select id from public.identity_directory_imports where institution_id=${source.institution_id} and status='active' limit 1`;
  const names = new Map();
  const add = (name, ref) => {
    const key = calendarKey(name, source.source_kind);
    const refs = names.get(key) ?? new Set();
    refs.add(normalizeRef(ref));
    names.set(key, refs);
  };
  if (directory && source.source_kind === 'classes') {
    const refs = await sql`select distinct class_ref from public.identity_directory_rows where institution_id=${source.institution_id}
      and import_id=${directory.id} and record_type='person' and validation_status in ('valid','warning') and class_ref is not null
      and (valid_from is null or valid_from <= current_date) and (valid_until is null or valid_until >= current_date)`;
    for (const row of refs) add(row.class_ref, row.class_ref);
  } else if (directory && source.source_kind === 'teachers') {
    const people = await sql`select r.person_ref, p.key_version,p.payload_schema,p.iv,p.auth_tag,p.ciphertext
      from public.identity_directory_rows r join public.identity_directory_private_rows p
        on p.import_id=r.import_id and p.institution_id=r.institution_id and p.person_ref=r.person_ref
      where r.institution_id=${source.institution_id} and r.import_id=${directory.id} and r.record_type='person'
        and r.person_type='staff' and r.validation_status in ('valid','warning')
        and (r.valid_from is null or r.valid_from <= current_date) and (r.valid_until is null or r.valid_until >= current_date) limit 2001`;
    if (people.length > 2000) throw new Error('ical_staff_directory_limit');
    for (const row of people) {
      const person = decryptIdentityVaultPayload({ institutionId:source.institution_id, importId:directory.id,personRef:row.person_ref,
        envelope:{keyVersion:row.key_version,payloadSchema:row.payload_schema,iv:row.iv,authTag:row.auth_tag,ciphertext:row.ciphertext},key:identityVaultKeyForVersion(row.key_version)});
      add(`${person.lastName} ${person.firstName}`, row.person_ref);
      add(`${person.firstName} ${person.lastName}`, row.person_ref);
    }
  }
  return calendars.map(calendar => {
    const matches = [...(names.get(calendarKey(calendar.label, source.source_kind)) ?? [])].filter(ref => REF.test(ref));
    return { ...calendar, directoryImportId:directory?.id ?? null, suggestedRef:matches.length===1?matches[0]:null,
      matchStatus:calendar.events.length===0?'empty':matches.length===1?'exact':matches.length>1?'ambiguous':'not_found' };
  });
}

export async function persistIcalReview(sql, source, result, msgId) {
  const calendars = await suggestIcalSubjects(sql, source, result.calendars);
  await sql.begin(async tx => {
    await tx`select pg_advisory_xact_lock(hashtextextended(${source.id}::text,61744))`;
    const [current] = await tx`select status from public.schedule_source_versions where id=${source.id} and institution_id=${source.institution_id} for update`;
    if (current?.status !== 'processing') throw new Error('schedule_source_state_changed');
    await tx`delete from public.schedule_ical_candidates where source_version_id=${source.id} and institution_id=${source.institution_id}`;
    for (const c of calendars) {
      await tx`insert into public.schedule_ical_candidates
        (institution_id,source_version_id,calendar_number,calendar_label,suggested_ref,directory_import_id,match_status,events,stats)
        values (${source.institution_id},${source.id},${c.calendarNumber},${c.label},${c.suggestedRef},${c.directoryImportId},${c.matchStatus},${tx.json(c.events)},${tx.json(c.stats)})`;
    }
    await tx`update public.schedule_source_versions set status='review',checksum=${result.checksum},page_count=${calendars.length},
      validation_summary=${tx.json({securityScan:'clean',pageCountVerified:true,format:'ical_import',eventCount:result.eventCount,courseCount:result.courseCount,
        exactMatches:calendars.filter(c=>c.matchStatus==='exact').length,humanMapping:'pending',activation:'blocked',realDataAllowedInModel:false})}
      where id=${source.id} and institution_id=${source.institution_id} and status='processing'`;
    await tx`insert into public.schedule_audit(institution_id,source_version_id,action,actor_id,summary)
      values(${source.institution_id},${source.id},'complete_scan',${source.uploaded_by},${tx.json({format:'ical_import',calendars:calendars.length,courses:result.courseCount,result:'clean'})})`;
    await tx`select pgmq.delete('schedule_document_scan',${msgId}::bigint)`;
  });
}

export async function applyQueuedIcalCalendar(sql, id) {
  return sql.begin(async tx => {
    const [job] = await tx`select c.*,s.source_kind,s.status as source_status,s.effective_from::text,s.effective_until::text
      from public.schedule_ical_candidates c join public.schedule_source_versions s on s.id=c.source_version_id and s.institution_id=c.institution_id
      where c.id=${id} and c.status='queued'`;
    if (!job) return 'already_applied';
    await tx`select pg_advisory_xact_lock(hashtextextended(${job.source_version_id}::text,61744))`;
    const [locked] = await tx`select c.status,s.status as source_status from public.schedule_ical_candidates c
      join public.schedule_source_versions s on s.id=c.source_version_id and s.institution_id=c.institution_id
      where c.id=${id} for update of c,s`;
    if (locked?.status!=='queued') return 'already_applied';
    if (locked.source_status!=='review') throw new Error('ical_source_no_longer_reviewable');
    const include = job.decision==='include';
    const subjectRef = include ? job.subject_ref : `EXCLUDED:${job.id.toUpperCase()}`;
    if (!REF.test(subjectRef) || !job.approved_by) throw new Error('ical_approval_invalid');
    if (include) {
      const found = await tx`select r.id from public.identity_directory_rows r join public.identity_directory_imports i
        on i.id=r.import_id and i.institution_id=r.institution_id
        where r.institution_id=${job.institution_id} and i.status='active' and r.record_type='person' and r.validation_status in ('valid','warning')
          and (r.valid_from is null or r.valid_from<=current_date) and (r.valid_until is null or r.valid_until>=current_date)
          and ((${job.source_kind}='classes' and upper(r.class_ref)=${subjectRef}) or
            (${job.source_kind}='teachers' and r.person_type='staff' and upper(r.person_ref)=${subjectRef})) limit 1`;
      if (!found.length) throw new Error('ical_subject_not_in_active_directory');
    }
    const [page] = await tx`insert into public.schedule_page_indexes(institution_id,source_version_id,page_number,subject_type,subject_ref,review_status,reviewed_by,reviewed_at)
      values(${job.institution_id},${job.source_version_id},${job.calendar_number},${job.source_kind==='classes'?'class':'teacher'},${subjectRef},'verified',${job.approved_by},${job.approved_at})
      on conflict(source_version_id,page_number) do update set subject_ref=excluded.subject_ref,review_status='verified',reviewed_by=excluded.reviewed_by,reviewed_at=excluded.reviewed_at returning id`;
    const events = typeof job.events==='string'?JSON.parse(job.events):job.events;
    if (!Array.isArray(events) || events.length>5000 || (include && events.length===0)) throw new Error('ical_events_invalid');
    let writtenCount = 0;
    if (include) {
      const rows = events.filter(e=>e.startsAt.slice(0,10)>=String(job.effective_from).slice(0,10)
        && (!job.effective_until || e.startsAt.slice(0,10)<=String(job.effective_until).slice(0,10))).map(e=>({
        institution_id:job.institution_id,source_version_id:job.source_version_id,class_ref:job.source_kind==='classes'?subjectRef:null,
        teacher_ref:job.source_kind==='teachers'?subjectRef:null,group_ref:job.source_kind==='classes'?e.groupRef:null,
        subject_code:e.subjectCode,subject_label:e.subjectLabel,room_code:e.roomCode,starts_at:e.startsAt,ends_at:e.endsAt,
        week_pattern:null,parse_confidence:1,review_status:'approved',reviewed_by:job.approved_by,reviewed_at:job.approved_at,
      }));
      if (!rows.length) throw new Error('ical_no_courses_in_period');
      writtenCount = rows.length;
      // One transaction per calendar: a retry never duplicates or partially publishes its courses.
      await tx`delete from public.schedule_slots where institution_id=${job.institution_id} and source_version_id=${job.source_version_id}
        and ((${job.source_kind}='classes' and class_ref=${subjectRef}) or (${job.source_kind}='teachers' and teacher_ref=${subjectRef}))`;
      for (let start=0;start<rows.length;start+=200) await tx`insert into public.schedule_slots ${tx(rows.slice(start,start+200))}`;
    }
    await tx`update public.schedule_ical_candidates set status='applied',applied_at=now(),failure_code=null where id=${id} and status='queued'`;
    await tx`insert into public.schedule_audit(institution_id,source_version_id,page_index_id,action,actor_id,summary)
      values(${job.institution_id},${job.source_version_id},${page.id},'write_slots',${job.approved_by},${tx.json({format:'ical_import',calendarNumber:job.calendar_number,decision:job.decision,rowCount:writtenCount})})`;
    return include?'ical_calendar_applied':'ical_calendar_excluded';
  });
}
