import { and, asc, eq, gte, inArray, isNull, lte, or } from "drizzle-orm";
import { db } from "../../db/index.js";
import { scheduleSlots, scheduleSourceVersions } from "../../db/schema.js";
import {
  readNextAuthorizedCourse,
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

function failurePriority(result: ScheduleReadResult): number {
  if (result.ok) return 0;
  return {
    conflicting_changes: 4,
    source_stale: 3,
    no_authorized_course: 2,
    source_unavailable: 1,
    identity_i3_required: 0,
  }[result.reason];
}

export async function readNextCourseFromPrivateSchedule(input: {
  scope: TrustedScheduleScope;
  now: Date;
  requestedAt: Date;
}): Promise<ScheduleReadResult> {
  const classRefs = boundedRefs(input.scope.authorizedClassRefs);
  const groupRefs = boundedRefs(input.scope.authorizedGroupRefs);
  const teacherRefs = boundedRefs(input.scope.authorizedTeacherRefs);
  const viewer: ScheduleViewer = {
    identityLevel: input.scope.identityLevel,
    authorizedClassRefs: classRefs,
    authorizedGroupRefs: groupRefs,
    authorizedTeacherRefs: teacherRefs,
  };

  if (!["I3", "I4"].includes(viewer.identityLevel)) {
    return { ok: false, reason: "identity_i3_required" };
  }

  const sourceKinds = [
    ...(classRefs.length > 0 || groupRefs.length > 0 ? ["classes"] : []),
    ...(teacherRefs.length > 0 ? ["teachers"] : []),
  ];
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

  if (versions.length === 0) return { ok: false, reason: "source_unavailable" };

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
        sourceType: version.sourceFormat as ScheduleSourceType,
        status: version.status as "active",
        effectiveFrom: `${version.effectiveFrom}T00:00:00.000Z`,
        effectiveUntil: version.effectiveUntil
          ? `${version.effectiveUntil}T23:59:59.999Z`
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
    ?? { ok: false, reason: "source_unavailable" };
}
