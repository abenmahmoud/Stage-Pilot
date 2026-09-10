import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { parseIcalDecisions, parseIcalReview, isIcalDecisionReceipt } from '../shared/schedule-ical-contract.ts';
import { parseScheduleImportInput, scheduleImportFileExtension } from '../shared/schedule-import-input.ts';
import { isSchedulePresentation } from '../shared/schedule-presentation.ts';
import { readAuthorizedCoursesForDay } from '../shared/schedule-policy.ts';
import { scheduleAssistantDayAnswer } from '../shared/schedule-assistant.ts';

test('native iCal metadata is explicit and stays bound to its file extension',()=>{
  const value={sourceFormat:'ical_import',sourceKind:'classes',schoolYear:'2026-2027',title:'iCal fictif',purposeDescription:'Validation des cours fictifs pour la recette',effectiveFrom:'2026-09-01',effectiveUntil:null,freshUntil:'2026-09-15',originalName:'classes.ics',mimeType:'text/calendar',sizeBytes:100};
  assert.equal(parseScheduleImportInput(value).sourceFormat,'ical_import');
  assert.equal(scheduleImportFileExtension('ical_import','text/calendar'),'.ics');
  for(const change of [{mimeType:'application/pdf'},{originalName:'classes.pdf'},{sizeBytes:52428801}]) assert.throws(()=>parseScheduleImportInput({...value,...change}));
});
test('review decisions reject duplicate owners, arbitrary fields, ambiguous receipts and mismatched sources',()=>{
  const sourceId=randomUUID(),id=randomUUID(); const decisions=[{id,decision:'include',subjectRef:'2TEST'}];
  assert.deepEqual(parseIcalDecisions({decisions}),decisions);
  assert.equal(parseIcalDecisions({decisions:[...decisions,{...decisions[0],id:randomUUID()}]}),null);
  assert.equal(parseIcalDecisions({decisions:[{...decisions[0],approvedBy:randomUUID()}]}),null);
  assert.equal(isIcalDecisionReceipt({sourceId,queuedIds:[id]},sourceId,decisions),true);
  assert.equal(isIcalDecisionReceipt({sourceId,queuedIds:[randomUUID()]},sourceId,decisions),false);
  const review={sourceId,sourceKind:'classes',sourceStatus:'review',calendars:[{id,calendarNumber:1,label:'2TEST',suggestedRef:'2TEST',subjectRef:null,matchStatus:'exact',status:'pending',decision:null,courseCount:1200,groupCourses:0,nonCourse:3,withoutRoom:0,firstDate:'2026-09-01',lastDate:'2027-07-03',failureCode:null}]};
  assert.ok(parseIcalReview(review,sourceId)); assert.equal(parseIcalReview(review,randomUUID()),null);
  assert.equal(parseIcalReview({...review,calendars:[{...review.calendars[0],events:[]}]},sourceId),null);
});
test('group membership is required; empty authorized results do not imply a free day',()=>{
  const version={id:randomUUID(),sourceType:'official_export',status:'active',effectiveFrom:'2026-09-01T00:00:00.000Z',effectiveUntil:null,activatedAt:'2026-09-01T00:00:00.000Z',freshUntil:'2026-09-20T00:00:00.000Z'};
  const viewer={identityLevel:'I3',authorizedClassRefs:['2TEST'],authorizedGroupRefs:[],authorizedTeacherRefs:[]};
  const slot={id:randomUUID(),sourceVersionId:version.id,classRef:'2TEST',groupRef:'ICALG:TEST',teacherRef:null,subjectCode:'MATH',subjectLabel:'Mathématiques',roomCode:'B204',startsAt:'2026-09-11T06:00:00.000Z',endsAt:'2026-09-11T07:00:00.000Z',reviewStatus:'approved'};
  const input={viewer,now:'2026-09-10T08:00:00.000Z',dayStart:'2026-09-10T22:00:00.000Z',dayEnd:'2026-09-11T22:00:00.000Z',versions:[version],slots:[slot],changes:[]};
  const result=readAuthorizedCoursesForDay(input);
  assert.equal(result.ok,true);assert.equal(result.courses.length,0);assert.equal(result.incompleteGroups,true);
  assert.doesNotMatch(scheduleAssistantDayAnswer(result,1).reply,/aucun cours prévu/);
  const allowed=readAuthorizedCoursesForDay({...input,viewer:{...viewer,authorizedGroupRefs:['ICALG:TEST']}});
  assert.equal(allowed.courses.length,1);assert.equal(allowed.incompleteGroups,false);
  const presentation={title:'Votre emploi du temps',courses:allowed.courses,updatedAt:version.activatedAt,incompleteGroups:false};
  assert.equal(isSchedulePresentation(presentation),true);
  assert.equal(isSchedulePresentation({...presentation,courses:[{...allowed.courses[0],url:'https://example.test/private'}]}),false);
  assert.equal(isSchedulePresentation({...presentation,courses:[{...allowed.courses[0],endsAt:slot.startsAt}]}),false);
});
