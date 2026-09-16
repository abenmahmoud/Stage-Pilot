import { and, eq, gte, inArray, isNull, lte, or } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { identityDirectoryImports, identityDirectoryRows, personAttributeImports, personAttributeRows, codeVaultAssignments, scheduleSourceVersions, schedulePageIndexes, scheduleSlots } from '../../db/schema.js';
import { crossDataTotals, filterCrossPeople, type CrossDataPayload, type CrossDataQuery, type CrossPerson } from '../../shared/admin-cross-data.js';
import { decryptPersonAttributeValue } from '../../shared/person-attribute-crypto.js';
import { HttpError } from './auth.js';

const ATTRIBUTE_LABELS: Record<string,string> = {ent_identifier:'Identifiant ENT',ent_activation_state:'État du compte ENT',discipline:'Discipline déclarée',teaching_subject:'Discipline déclarée'};
// Same canonical form as schedule-reader.boundedRefs and the approved import.
// Case is normalized; punctuation and numeric suffixes are preserved exactly.
const scheduleRef=(ref:string)=>ref.normalize('NFKC').trim().toUpperCase();
export async function readAdminCrossData(institutionId: string, query: CrossDataQuery, now=new Date()): Promise<CrossDataPayload> {
  const today=now.toISOString().slice(0,10);
  const year=now.getUTCMonth()>=8?now.getUTCFullYear():now.getUTCFullYear()-1;
  // One coherent snapshot: an activation during a consultation cannot mix two versions.
  return db.transaction(async tx => {
    const directories=await tx.select().from(identityDirectoryImports).where(and(eq(identityDirectoryImports.institutionId,institutionId),eq(identityDirectoryImports.status,'active'))).limit(2);
    if (directories.length>1) throw new HttpError(409,'Plusieurs annuaires sont actifs. Faites contrôler les versions.');
    const directory=directories[0];
    const sources: CrossDataPayload['sources']=[];
    if (!directory) return {schema:1,refreshedAt:now.toISOString(),revision:null,sources,totals:crossDataTotals([]),people:[],total:0,page:0,pageSize:25,detail:null};
    sources.push({kind:'Annuaire',name:directory.originalName,date:directory.activatedAt?.toISOString()??null,status:'active',count:directory.validRowCount??0});
    const rows=await tx.select({personRef:identityDirectoryRows.personRef,personType:identityDirectoryRows.personType,classRef:identityDirectoryRows.classRef,serviceCode:identityDirectoryRows.serviceCode,
      recordType:identityDirectoryRows.recordType,subject:identityDirectoryRows.subjectPersonRef,object:identityDirectoryRows.objectRef,relation:identityDirectoryRows.relationshipType,
      phone:identityDirectoryRows.phoneHash,email:identityDirectoryRows.academicEmailHash,personalEmail:identityDirectoryRows.personalEmailHash})
      .from(identityDirectoryRows).where(and(eq(identityDirectoryRows.institutionId,institutionId),eq(identityDirectoryRows.importId,directory.id),inArray(identityDirectoryRows.validationStatus,['valid','warning']),
        or(isNull(identityDirectoryRows.validFrom),lte(identityDirectoryRows.validFrom,today)),or(isNull(identityDirectoryRows.validUntil),gte(identityDirectoryRows.validUntil,today))));
    const attrs=await tx.select({id:personAttributeImports.id,name:personAttributeImports.originalName,date:personAttributeImports.approvedAt,count:personAttributeImports.rowCount}).from(personAttributeImports)
      .where(and(eq(personAttributeImports.institutionId,institutionId),eq(personAttributeImports.directoryImportId,directory.id),eq(personAttributeImports.status,'active')));
    for (const a of attrs) sources.push({kind:'Attributs ENT',name:a.name,date:a.date?.toISOString()??null,count:a.count,status:'active'});
    const attrKeys=attrs.length ? await tx.select({personRef:personAttributeRows.personRef,key:personAttributeRows.attributeKey}).from(personAttributeRows)
      .where(and(eq(personAttributeRows.institutionId,institutionId),inArray(personAttributeRows.importId,attrs.map(a=>a.id)),lte(personAttributeRows.validFrom,today),or(isNull(personAttributeRows.validUntil),gte(personAttributeRows.validUntil,today)))):[];
    const vault=await tx.select({personRef:codeVaultAssignments.personRef,service:codeVaultAssignments.service,defective:codeVaultAssignments.defectiveFlaggedAt,date:codeVaultAssignments.createdAt})
      .from(codeVaultAssignments).where(and(eq(codeVaultAssignments.institutionId,institutionId),eq(codeVaultAssignments.schoolYear,`${year}-${year+1}`),isNull(codeVaultAssignments.replacedByAssignmentId)));
    sources.push({kind:'Coffre',name:'Disponibilité des accès ENT et PC',date:vault.length?new Date(Math.max(...vault.map(v=>v.date.getTime()))).toISOString():null,count:vault.length,status:'metadata_only'});
    const schedules=await tx.select({id:scheduleSourceVersions.id,kind:scheduleSourceVersions.sourceKind,name:scheduleSourceVersions.originalName,date:scheduleSourceVersions.activatedAt,fresh:scheduleSourceVersions.freshUntil,from:scheduleSourceVersions.effectiveFrom,until:scheduleSourceVersions.effectiveUntil})
      .from(scheduleSourceVersions).where(and(eq(scheduleSourceVersions.institutionId,institutionId),eq(scheduleSourceVersions.status,'active'),eq(scheduleSourceVersions.schoolYear,`${year}-${year+1}`)));
    const indexes=schedules.length?await tx.select({version:schedulePageIndexes.sourceVersionId,type:schedulePageIndexes.subjectType,ref:schedulePageIndexes.subjectRef}).from(schedulePageIndexes)
      .where(and(eq(schedulePageIndexes.institutionId,institutionId),inArray(schedulePageIndexes.sourceVersionId,schedules.map(s=>s.id)),eq(schedulePageIndexes.reviewStatus,'verified'))):[];
    for(const s of schedules) sources.push({kind:s.kind==='teachers'?'EDT professeurs':'EDT classes',name:s.name,date:s.date?.toISOString()??null,status:s.fresh&&s.fresh>now&&s.from<=today&&(!s.until||s.until>=today)?'active':'stale',count:indexes.filter(i=>i.version===s.id).length});
    const persons=new Map<string, typeof rows>();
    for(const row of rows) if(row.recordType==='person'&&row.personRef) persons.set(row.personRef,[...(persons.get(row.personRef)??[]),row]);
    const relationships=rows.filter(r=>r.recordType==='relationship');
    const staffRefCounts=new Map<string,number>();
    for(const [ref,records] of persons) if(records.some(p=>p.personType==='staff')) {const key=scheduleRef(ref);staffRefCounts.set(key,(staffRefCounts.get(key)??0)+records.length);}
    const keyCounts=new Map<string,number>(); for(const a of attrKeys) {const key=`${a.personRef}|${a.key}`;keyCounts.set(key,(keyCounts.get(key)??0)+1);}
    const people: CrossPerson[]=Array.from(persons,([ref,candidates]): CrossPerson=>{
      const p=candidates[0]; const duplicates=candidates.length!==1;
      const koxo=vault.filter(v=>v.personRef===ref&&v.service==='koxo');
      const scheduleConflict=p.personType==='staff'&&staffRefCounts.get(scheduleRef(ref))!==1;
      const available=indexes.filter(i=>(p.personType==='staff'&&!scheduleConflict&&i.type==='teacher'&&i.ref===scheduleRef(ref))||(p.personType==='student'&&i.type==='class'&&p.classRef&&i.ref===scheduleRef(p.classRef)));
      const fresh=available.filter(i=>{const s=schedules.find(s=>s.id===i.version)!;return s.fresh&&s.fresh>now&&s.from<=today&&(!s.until||s.until>=today);});
      const attrsConflict=Object.keys(ATTRIBUTE_LABELS).some(k=>(keyCounts.get(`${ref}|${k}`)??0)>1);
      return {personRef:ref,personType:p.personType??'unknown',classRef:duplicates?null:p.classRef,serviceCode:duplicates?null:p.serviceCode,
        phone:!duplicates&&!!p.phone,email:!duplicates&&!!(p.email||p.personalEmail),ent:!duplicates&&keyCounts.get(`${ref}|ent_identifier`)===1&&keyCounts.get(`${ref}|ent_activation_state`)===1,
        koxo:duplicates||koxo.length>1||koxo.some(k=>k.defective)?'review':koxo.length?'linked':'missing',
        schedule:p.personType==='guardian'?'not_applicable':duplicates?'missing':fresh.length===1?'linked':available.length?'stale':'missing',
        relations:relationships.filter(r=>r.subject===ref||r.object===ref).length,conflict:duplicates||scheduleConflict||attrsConflict||koxo.length>1||available.length>1};
    }).sort((a,b)=>a.personRef.localeCompare(b.personRef,'fr'));
    const filtered=filterCrossPeople(people,query); const page=Math.min(query.page,Math.max(0,Math.ceil(filtered.length/25)-1));
    let detail:CrossDataPayload['detail']=null;
    if(query.personRef){
      const person=people.find(p=>p.personRef===query.personRef); if(!person) throw new HttpError(404,'Cette personne ne figure pas dans l’annuaire actif.');
      if((persons.get(person.personRef)?.length??0)!==1) throw new HttpError(409,'Correspondance ambiguë : faites contrôler l’annuaire.');
      const attributeRows=attrs.length?await tx.select().from(personAttributeRows).where(and(eq(personAttributeRows.institutionId,institutionId),inArray(personAttributeRows.importId,attrs.map(a=>a.id)),eq(personAttributeRows.personRef,person.personRef),inArray(personAttributeRows.attributeKey,Object.keys(ATTRIBUTE_LABELS)),lte(personAttributeRows.validFrom,today),or(isNull(personAttributeRows.validUntil),gte(personAttributeRows.validUntil,today)))):[];
      const attributes=Object.entries(ATTRIBUTE_LABELS).flatMap(([key,label])=>{
        const matches=attributeRows.filter(a=>a.attributeKey===key); if(!matches.length) return [];
        const conflict=matches.length!==1; const a=matches[0];
        const value=conflict?null:decryptPersonAttributeValue({envelope:a,institutionId,importId:a.importId,rowId:a.id,personRef:person.personRef,attributeKey:key});
        return [{key,label,value,source:conflict?'Plusieurs valeurs valides':a.source,conflict}];
      });
      const related=relationships.filter(r=>r.subject===person.personRef||r.object===person.personRef).map(r=>({type:r.relation??'',reference:(r.subject===person.personRef?r.object:r.subject)??'',direction:r.subject===person.personRef?'out' as const:'in' as const,linked:persons.has((r.subject===person.personRef?r.object:r.subject)??'')}));
      const matching=indexes.filter(i=>person.personType==='staff'?staffRefCounts.get(scheduleRef(person.personRef))===1&&i.type==='teacher'&&i.ref===scheduleRef(person.personRef):person.personType==='student'&&i.type==='class'&&person.classRef&&i.ref===scheduleRef(person.classRef));
      const subjects=matching.length===1?await tx.selectDistinct({label:scheduleSlots.subjectLabel}).from(scheduleSlots).where(and(eq(scheduleSlots.institutionId,institutionId),eq(scheduleSlots.sourceVersionId,matching[0].version),eq(scheduleSlots.reviewStatus,'approved'),person.personType==='staff'?eq(scheduleSlots.teacherRef,matching[0].ref):eq(scheduleSlots.classRef,matching[0].ref))).limit(40):[];
      detail={person,attributes,relations:related,subjects:subjects.map(s=>s.label)};
    }
    return {schema:1,refreshedAt:now.toISOString(),revision:directory.id,sources,totals:crossDataTotals(people),people:filtered.slice(page*25,page*25+25),total:filtered.length,page,pageSize:25,detail};
  },{isolationLevel:'repeatable read',accessMode:'read only'});
}
