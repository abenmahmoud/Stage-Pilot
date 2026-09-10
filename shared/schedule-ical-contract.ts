const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REF = /^[A-Z0-9][A-Z0-9._:-]{1,79}$/;
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const exact = (v: Record<string, unknown>, keys: string[]) => Object.keys(v).length === keys.length && keys.every(k => k in v);
export type IcalDecision = { id: string; decision: 'include' | 'exclude'; subjectRef: string | null };
export type IcalCalendarSummary = {
  id: string; calendarNumber: number; label: string; suggestedRef: string | null; subjectRef: string | null;
  matchStatus: 'exact' | 'not_found' | 'ambiguous' | 'empty'; status: 'pending' | 'queued' | 'applied' | 'failed';
  decision: 'include' | 'exclude' | null; courseCount: number; groupCourses: number; nonCourse: number; withoutRoom: number;
  firstDate: string | null; lastDate: string | null; failureCode: string | null;
};
export type IcalReview = { sourceId: string; sourceKind: 'classes' | 'teachers'; sourceStatus: string; calendars: IcalCalendarSummary[] };
export function parseIcalDecisions(value: unknown): IcalDecision[] | null {
  if (!record(value) || !exact(value, ['decisions']) || !Array.isArray(value.decisions) || !value.decisions.length || value.decisions.length > 250) return null;
  const result: IcalDecision[] = [];
  for (const item of value.decisions) {
    if (!record(item) || !exact(item, ['id', 'decision', 'subjectRef']) || typeof item.id !== 'string' || !UUID.test(item.id)
      || (item.decision !== 'include' && item.decision !== 'exclude')
      || (item.decision === 'include' ? typeof item.subjectRef !== 'string' || !REF.test(item.subjectRef) : item.subjectRef !== null)) return null;
    result.push(item as IcalDecision);
  }
  if (new Set(result.map(d => d.id)).size !== result.length) return null;
  const included = result.filter(d => d.decision === 'include').map(d => d.subjectRef);
  return new Set(included).size === included.length ? result : null;
}
const day = (value: unknown) => value === null || (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)));
export function parseIcalReview(value: unknown, sourceId: string): IcalReview | null {
  if (!record(value) || !exact(value,['sourceId','sourceKind','sourceStatus','calendars']) || value.sourceId!==sourceId || !UUID.test(sourceId)
    || !['classes','teachers'].includes(String(value.sourceKind)) || !['review','approved','active','superseded','retired','processing','quarantined','failed','rejected'].includes(String(value.sourceStatus))
    || !Array.isArray(value.calendars) || value.calendars.length>250) return null;
  for (const c of value.calendars) {
    if (!record(c) || !exact(c,['id','calendarNumber','label','suggestedRef','subjectRef','matchStatus','status','decision','courseCount','groupCourses','nonCourse','withoutRoom','firstDate','lastDate','failureCode'])
      || typeof c.id!=='string' || !UUID.test(c.id) || !Number.isInteger(c.calendarNumber) || Number(c.calendarNumber)<1 || Number(c.calendarNumber)>250
      || typeof c.label!=='string' || !c.label.trim() || c.label.length>180 || /[\u0000-\u001f]/.test(c.label)
      || ![c.suggestedRef,c.subjectRef].every(v=>v===null || typeof v==='string' && REF.test(v))
      || !['exact','not_found','ambiguous','empty'].includes(String(c.matchStatus)) || !['pending','queued','applied','failed'].includes(String(c.status))
      || ![null,'include','exclude'].includes(c.decision as null | string) || !['courseCount','groupCourses','nonCourse','withoutRoom'].every(k=>Number.isInteger(c[k]) && Number(c[k])>=0 && Number(c[k])<=150_000)
      || !day(c.firstDate) || !day(c.lastDate) || !(c.failureCode===null || typeof c.failureCode==='string' && /^ical_[a-z_]{1,100}$/.test(c.failureCode))) return null;
  }
  if (new Set(value.calendars.map(c=>c.id)).size!==value.calendars.length || new Set(value.calendars.map(c=>c.calendarNumber)).size!==value.calendars.length) return null;
  return value as unknown as IcalReview;
}
export function isIcalDecisionReceipt(value: unknown, sourceId: string, decisions: IcalDecision[]): boolean {
  if (!record(value) || !exact(value,['sourceId','queuedIds']) || value.sourceId!==sourceId || !Array.isArray(value.queuedIds)) return false;
  return value.queuedIds.length===decisions.length && new Set(value.queuedIds).size===decisions.length && value.queuedIds.every(id=>decisions.some(d=>d.id===id));
}
