import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from 'drizzle-orm';
import { db } from '../../../../../db/index.js';
import { requireScheduleManager } from '../../../../_shared/schedule-imports.js';
import { HttpError } from '../../../../_shared/auth.js';
import { handleApi, methodNotAllowed } from '../../../../_shared/response.js';
import { parseIcalDecisions, parseIcalReview } from '../../../../../shared/schedule-ical-contract.js';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function rows<T>(value: unknown): T[] { return (Array.isArray(value)?value:(value as { rows: T[] }).rows) as T[]; }
export default async function handler(req: VercelRequest,res: VercelResponse) {
  if (req.method!=='GET' && req.method!=='POST') return methodNotAllowed(res,['GET','POST']);
  return handleApi(res,async()=>{
    const context=await requireScheduleManager(req);
    const id=req.query.id;
    if(typeof id!=='string' || !UUID.test(id)) throw new HttpError(400,'Version invalide.');
    const decisions=req.method==='POST'?parseIcalDecisions(req.body):null;
    if(req.method==='POST' && !decisions) throw new HttpError(400,'Les correspondances sont invalides.');
    return db.transaction(async tx=>{
      if(decisions) await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${id}::text,61744))`);
      const [source]=rows<{source_kind:string;status:string}>(await tx.execute(sql`select source_kind,status from public.schedule_source_versions
        where id=${id} and institution_id=${context.institutionId} and source_format='ical_import'`));
      if(!source) throw new HttpError(404,'Dépôt iCal introuvable.');
      if(!decisions) {
        const calendars=rows(await tx.execute(sql`select id,calendar_number as "calendarNumber",calendar_label as label,suggested_ref as "suggestedRef",subject_ref as "subjectRef",
          match_status as "matchStatus",status,decision,jsonb_array_length(events)::int as "courseCount",
          coalesce((stats->>'groupCourses')::int,0) as "groupCourses",coalesce((stats->>'nonCourse')::int,0) as "nonCourse",coalesce((stats->>'withoutRoom')::int,0) as "withoutRoom",
          left(events->0->>'startsAt',10) as "firstDate",left(events->-1->>'startsAt',10) as "lastDate",failure_code as "failureCode"
          from public.schedule_ical_candidates where source_version_id=${id} and institution_id=${context.institutionId} order by calendar_number limit 251`));
        const result={sourceId:id,sourceKind:source.source_kind,sourceStatus:source.status,calendars};
        if(!parseIcalReview(result,id)) throw new HttpError(503,'Le bilan iCal reçu est incomplet.');
        return result;
      }
      if(source.status!=='review') throw new HttpError(409,'Cette source ne peut plus être modifiée.');
      for(const decision of decisions) {
        const [candidate]=rows<{status:string;decision:string|null;subject_ref:string|null;course_count:number}>(await tx.execute(sql`select status,decision,subject_ref,jsonb_array_length(events)::int as course_count
          from public.schedule_ical_candidates where id=${decision.id} and source_version_id=${id} and institution_id=${context.institutionId} for update`));
        if(!candidate) throw new HttpError(404,'Calendrier introuvable.');
        if(['queued','applied'].includes(candidate.status)) {
          if(candidate.decision!==decision.decision || candidate.subject_ref!==decision.subjectRef) throw new HttpError(409,'Ce calendrier a déjà été confirmé avec une autre correspondance.');
          continue;
        }
        if(decision.decision==='include') {
          if(!candidate.course_count) throw new HttpError(400,'Ce calendrier ne contient aucun cours à importer.');
          const valid=rows(await tx.execute(sql`select r.id from public.identity_directory_rows r join public.identity_directory_imports i on i.id=r.import_id and i.institution_id=r.institution_id
            where r.institution_id=${context.institutionId} and i.status='active' and r.record_type='person' and r.validation_status in ('valid','warning')
              and (r.valid_from is null or r.valid_from<=current_date) and (r.valid_until is null or r.valid_until>=current_date)
              and ((${source.source_kind}='classes' and upper(r.class_ref)=${decision.subjectRef}) or
                (${source.source_kind}='teachers' and r.person_type='staff' and upper(r.person_ref)=${decision.subjectRef})) limit 1`));
          if(!valid.length) throw new HttpError(400,'Cette référence ne correspond pas à l’annuaire actif.');
        }
        const conflict=decision.decision==='include'?rows(await tx.execute(sql`select id from public.schedule_ical_candidates where source_version_id=${id} and institution_id=${context.institutionId}
          and id<>${decision.id} and decision='include' and subject_ref=${decision.subjectRef} limit 1`)):[];
        if(conflict.length) throw new HttpError(409,'Deux calendriers ne peuvent pas être attribués à la même référence dans ce dépôt.');
        await tx.execute(sql`update public.schedule_ical_candidates set subject_ref=${decision.subjectRef},decision=${decision.decision},status='queued',approved_by=${context.user.id},approved_at=now(),failure_code=null
          where id=${decision.id} and source_version_id=${id} and institution_id=${context.institutionId} and status in ('pending','failed')`);
      }
      await tx.execute(sql`insert into public.schedule_audit(institution_id,source_version_id,action,actor_id,summary)
        values(${context.institutionId},${id},'verify_page',${context.user.id},${JSON.stringify({format:'ical_import',included:decisions.filter(d=>d.decision==='include').length,excluded:decisions.filter(d=>d.decision==='exclude').length})}::jsonb)`);
      return {sourceId:id,queuedIds:decisions.map(d=>d.id)};
    });
  });
}
export const config={api:{bodyParser:{sizeLimit:'64kb'}}};
