import { and, asc, eq, gt, gte, inArray, isNull, lt, lte, or } from "drizzle-orm";
import { db } from "../../db/index.js";
import { scheduleSlots, scheduleSourceVersions, schedulePageIndexes } from "../../db/schema.js";
import { schoolDayBoundsUtc } from '../../shared/assistant-school-context.js';
import {
  readAuthorizedCoursesForDay,
  readNextAuthorizedCourse,
  scheduleSourceUnavailableReason,
  type ScheduleDayReadResult,
  type ScheduleReadResult,
  type ScheduleSourceType,
  type ScheduleViewer,
} from "../../shared/schedule-policy.js";

const MAX_SCOPE_REFS = 40;
const SCOPE_REF = /^[A-Z0-9][A-Z0-9._:-]{1,79}$/;

export type TrustedScheduleScope = ScheduleViewer & {
  institutionId: string;
};

function boundedRefs(values: string[]): string[] {
  const refs = [
    ...new Set(
      values
        .map((value) => value.normalize("NFKC").trim().toUpperCase())
        .filter(Boolean)
    ),
  ];
  if (refs.length > MAX_SCOPE_REFS || refs.some((value) => !SCOPE_REF.test(value))) {
    throw new Error("Invalid trusted schedule scope");
  }
  return refs;
}

async function hasMappedSubjects(institutionId: string, versions: { id: string }[], refs: string[]): Promise<boolean> {
  if (!refs.length) return true;
  const mapped = await db.select({ ref: schedulePageIndexes.subjectRef }).from(schedulePageIndexes).where(and(
    eq(schedulePageIndexes.institutionId, institutionId),
    inArray(schedulePageIndexes.sourceVersionId, versions.map(version => version.id)),
    eq(schedulePageIndexes.reviewStatus, 'verified'), inArray(schedulePageIndexes.subjectRef, refs),
  ));
  return refs.every(ref => mapped.some(page => page.ref === ref));
}

function failurePriority(result: ScheduleReadResult | ScheduleDayReadResult): number {
  if (result.ok) return 0;
  return {
    conflicting_changes: 4,
    source_stale: 3,
    no_authorized_course: 2,
    source_unavailable: 1,
    teacher_schedule_unavailable: 1,
    identity_i3_required: 0,
  }[result.reason];
}

function boundedViewer(scope: TrustedScheduleScope): {
  classRefs: string[];
  groupRefs: string[];
  teacherRefs: string[];
  viewer: ScheduleViewer;
  sourceKinds: string[];
} {
  const classRefs = boundedRefs(scope.authorizedClassRefs);
  const groupRefs = boundedRefs(scope.authorizedGroupRefs);
  const teacherRefs = boundedRefs(scope.authorizedTeacherRefs);
  const viewer: ScheduleViewer = {
    identityLevel: scope.identityLevel,
    authorizedClassRefs: classRefs,
    authorizedGroupRefs: groupRefs,
    authorizedTeacherRefs: teacherRefs,
  };
  const sourceKinds = [
    ...(classRefs.length > 0 || groupRefs.length > 0 ? ["classes"] : []),
    ...(teacherRefs.length > 0 ? ["teachers"] : []),
  ];
  return { classRefs, groupRefs, teacherRefs, viewer, sourceKinds };
}

export async function readNextCourseFromPrivateSchedule(input: {
  scope: TrustedScheduleScope;
  now: Date;
  requestedAt: Date;
}): Promise<ScheduleReadResult> {
  const { classRefs, groupRefs, teacherRefs, viewer, sourceKinds } = boundedViewer(input.scope);

  if (!["I3", "I4"].includes(viewer.identityLevel)) {
    return { ok: false, reason: "identity_i3_required" };
  }

  if (sourceKinds.length === 0) return { ok: false, reason: "no_authorized_course" };

  const requestedDate = input.requestedAt.toISOString().slice(0, 10);
  const versions = await db
    .select({
      id: scheduleSourceVersions.id,
      sourceKind: scheduleSourceVersions.sourceKind,
      sourceFormat: scheduleSourceVersions.sourceFormat,
      effectiveFrom: scheduleSourceVersions.effectiveFrom,
      effectiveUntil: scheduleSourceVersions.effectiveUntil,
      activatedAt: scheduleSourceVersions.activatedAt,
      freshUntil: scheduleSourceVersions.freshUntil,
      status: scheduleSourceVersions.status,
    })
    .from(scheduleSourceVersions)
    .where(and(
      eq(scheduleSourceVersions.institutionId, input.scope.institutionId),
      eq(scheduleSourceVersions.status, "active"),
      inArray(scheduleSourceVersions.sourceKind, sourceKinds),
      lte(scheduleSourceVersions.effectiveFrom, requestedDate),
      or(
        isNull(scheduleSourceVersions.effectiveUntil),
        gte(scheduleSourceVersions.effectiveUntil, requestedDate)
      )
    ));

  if (versions.length === 0) return { ok: false, reason: scheduleSourceUnavailableReason(viewer) };

  if (!await hasMappedSubjects(input.scope.institutionId, versions, [...classRefs, ...teacherRefs])) return { ok: false, reason: 'no_authorized_course' };

  const scopePredicates = [
    ...(classRefs.length > 0 ? [inArray(scheduleSlots.classRef, classRefs)] : []),
    ...(groupRefs.length > 0 ? [inArray(scheduleSlots.groupRef, groupRefs)] : []),
    ...(teacherRefs.length > 0 ? [inArray(scheduleSlots.teacherRef, teacherRefs)] : []),
  ];
  const slots = await db
    .select({
      id: scheduleSlots.id,
      sourceVersionId: scheduleSlots.sourceVersionId,
      classRef: scheduleSlots.classRef,
      groupRef: scheduleSlots.groupRef,
      teacherRef: scheduleSlots.teacherRef,
      subjectCode: scheduleSlots.subjectCode,
      subjectLabel: scheduleSlots.subjectLabel,
      roomCode: scheduleSlots.roomCode,
      startsAt: scheduleSlots.startsAt,
      endsAt: scheduleSlots.endsAt,
      reviewStatus: scheduleSlots.reviewStatus,
    })
    .from(scheduleSlots)
    .where(and(
      eq(scheduleSlots.institutionId, input.scope.institutionId),
      inArray(scheduleSlots.sourceVersionId, versions.map((version) => version.id)),
      eq(scheduleSlots.reviewStatus, "approved"),
      gte(scheduleSlots.endsAt, input.requestedAt),
      or(...scopePredicates)
    ))
    .orderBy(asc(scheduleSlots.startsAt))
    .limit(100);

  const results = sourceKinds.map((sourceKind) => {
    const sourceVersions = versions.filter((version) => version.sourceKind === sourceKind);
    const sourceIds = new Set(sourceVersions.map((version) => version.id));
    return readNextAuthorizedCourse({
      viewer,
      now: input.now.toISOString(),
      requestedAt: input.requestedAt.toISOString(),
      versions: sourceVersions.map((version) => ({
        id: version.id,
        sourceType: (version.sourceFormat === 'pdf_import' ? 'pdf_import' : 'official_export') as ScheduleSourceType,
        status: version.status as "active",
        effectiveFrom: schoolDayBoundsUtc(new Date(`${version.effectiveFrom}T12:00:00.000Z`)).dayStart.toISOString(),
        effectiveUntil: version.effectiveUntil
          ? new Date(schoolDayBoundsUtc(new Date(`${version.effectiveUntil}T12:00:00.000Z`)).dayEnd.getTime() - 1).toISOString()
          : null,
        activatedAt: version.activatedAt?.toISOString() ?? null,
        freshUntil: version.freshUntil?.toISOString() ?? "1970-01-01T00:00:00.000Z",
      })),
      slots: slots
        .filter((slot) => sourceIds.has(slot.sourceVersionId))
        .map((slot) => ({
          ...slot,
          startsAt: slot.startsAt.toISOString(),
          endsAt: slot.endsAt.toISOString(),
          reviewStatus: slot.reviewStatus as "approved",
        })),
      changes: [],
    });
  });

  const successes = results
    .filter((result): result is Extract<ScheduleReadResult, { ok: true }> => result.ok)
    .sort((left, right) => Date.parse(left.course.startsAt) - Date.parse(right.course.startsAt));
  if (successes[0]) return successes[0];

  return results.sort((left, right) => failurePriority(right) - failurePriority(left))[0]
    ?? { ok: false, reason: scheduleSourceUnavailableReason(viewer) };
}

export async function readCoursesForDayFromPrivateSchedule(input: {
  scope: TrustedScheduleScope;
  now: Date;
  dayStart: Date;
  dayEnd: Date;
}): Promise<ScheduleDayReadResult> {
  const { classRefs, groupRefs, teacherRefs, viewer, sourceKinds } = boundedViewer(input.scope);

  if (!["I3", "I4"].includes(viewer.identityLevel)) {
    return { ok: false, reason: "identity_i3_required" };
  }

  if (sourceKinds.length === 0) return { ok: false, reason: "no_authorized_course" };

  const dayStartDate = input.dayStart.toISOString().slice(0, 10);
  const dayEndDate = input.dayEnd.toISOString().slice(0, 10);
  const versions = await db
    .select({
      id: scheduleSourceVersions.id,
      sourceKind: scheduleSourceVersions.sourceKind,
      sourceFormat: scheduleSourceVersions.sourceFormat,
      effectiveFrom: scheduleSourceVersions.effectiveFrom,
      effectiveUntil: scheduleSourceVersions.effectiveUntil,
      activatedAt: scheduleSourceVersions.activatedAt,
      freshUntil: scheduleSourceVersions.freshUntil,
      status: scheduleSourceVersions.status,
    })
    .from(scheduleSourceVersions)
    .where(and(
      eq(scheduleSourceVersions.institutionId, input.scope.institutionId),
      eq(scheduleSourceVersions.status, "active"),
      inArray(scheduleSourceVersions.sourceKind, sourceKinds),
      lte(scheduleSourceVersions.effectiveFrom, dayEndDate),
      or(
        isNull(scheduleSourceVersions.effectiveUntil),
        gte(scheduleSourceVersions.effectiveUntil, dayStartDate)
      )
    ));

  if (versions.length === 0) return { ok: false, reason: scheduleSourceUnavailableReason(viewer) };

  // Directory identity alone is insufficient when its calendar was not imported.
  if (!await hasMappedSubjects(input.scope.institutionId, versions, [...classRefs, ...teacherRefs])) return { ok: false, reason: 'no_authorized_course' };
  const scopePredicates = [
    ...(classRefs.length > 0 ? [inArray(scheduleSlots.classRef, classRefs)] : []),
    ...(groupRefs.length > 0 ? [inArray(scheduleSlots.groupRef, groupRefs)] : []),
    ...(teacherRefs.length > 0 ? [inArray(scheduleSlots.teacherRef, teacherRefs)] : []),
  ];
  const slots = await db
    .select({
      id: scheduleSlots.id,
      sourceVersionId: scheduleSlots.sourceVersionId,
      classRef: scheduleSlots.classRef,
      groupRef: scheduleSlots.groupRef,
      teacherRef: scheduleSlots.teacherRef,
      subjectCode: scheduleSlots.subjectCode,
      subjectLabel: scheduleSlots.subjectLabel,
      roomCode: scheduleSlots.roomCode,
      startsAt: scheduleSlots.startsAt,
      endsAt: scheduleSlots.endsAt,
      reviewStatus: scheduleSlots.reviewStatus,
    })
    .from(scheduleSlots)
    .where(and(
      eq(scheduleSlots.institutionId, input.scope.institutionId),
      inArray(scheduleSlots.sourceVersionId, versions.map((version) => version.id)),
      eq(scheduleSlots.reviewStatus, "approved"),
      lt(scheduleSlots.startsAt, input.dayEnd),
      gt(scheduleSlots.endsAt, input.dayStart),
      or(...scopePredicates)
    ))
    .orderBy(asc(scheduleSlots.startsAt))
    .limit(100);

  const results = sourceKinds.map((sourceKind) => {
    const sourceVersions = versions.filter((version) => version.sourceKind === sourceKind);
    const sourceIds = new Set(sourceVersions.map((version) => version.id));
    return readAuthorizedCoursesForDay({
      viewer,
      now: input.now.toISOString(),
      dayStart: input.dayStart.toISOString(),
      dayEnd: input.dayEnd.toISOString(),
      versions: sourceVersions.map((version) => ({
        id: version.id,
        sourceType: (version.sourceFormat === 'pdf_import' ? 'pdf_import' : 'official_export') as ScheduleSourceType,
        status: version.status as "active",
        effectiveFrom: schoolDayBoundsUtc(new Date(`${version.effectiveFrom}T12:00:00.000Z`)).dayStart.toISOString(),
        effectiveUntil: version.effectiveUntil
          ? new Date(schoolDayBoundsUtc(new Date(`${version.effectiveUntil}T12:00:00.000Z`)).dayEnd.getTime() - 1).toISOString()
          : null,
        activatedAt: version.activatedAt?.toISOString() ?? null,
        freshUntil: version.freshUntil?.toISOString() ?? "1970-01-01T00:00:00.000Z",
      })),
      slots: slots
        .filter((slot) => sourceIds.has(slot.sourceVersionId))
        .map((slot) => ({
          ...slot,
          startsAt: slot.startsAt.toISOString(),
          endsAt: slot.endsAt.toISOString(),
          reviewStatus: slot.reviewStatus as "approved",
        })),
      changes: [],
    });
  });

  const successes = results.filter(
    (result): result is Extract<ScheduleDayReadResult, { ok: true }> => result.ok
  );
  if (successes.length > 0) {
    return {
      ok: true,
      incompleteGroups: successes.some(result => result.incompleteGroups),
      courses: successes
        .flatMap((result) => result.courses)
        .sort((left, right) => Date.parse(left.startsAt) - Date.parse(right.startsAt)),
      source: successes[0].source,
    };
  }

  return results.sort((left, right) => failurePriority(right) - failurePriority(left))[0]
    ?? { ok: false, reason: scheduleSourceUnavailableReason(viewer) };
}
