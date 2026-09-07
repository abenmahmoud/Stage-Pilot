import { identityAtLeast } from "./agent-identity-policy.js";
import type { AgentIdentityLevel } from "./agent-identity-policy.js";

export type ScheduleSourceType =
  | "pdf_import"
  | "official_export"
  | "official_connector";

export type ScheduleViewer = {
  identityLevel: AgentIdentityLevel;
  authorizedClassRefs: string[];
  authorizedGroupRefs: string[];
  authorizedTeacherRefs: string[];
};

export type ScheduleVersion = {
  id: string;
  sourceType: ScheduleSourceType;
  status: "review" | "active" | "superseded" | "rejected";
  effectiveFrom: string;
  effectiveUntil: string | null;
  activatedAt: string | null;
  freshUntil: string;
};

export type ScheduleSlot = {
  id: string;
  sourceVersionId: string;
  classRef: string | null;
  groupRef: string | null;
  teacherRef: string | null;
  subjectCode: string;
  subjectLabel: string;
  roomCode: string | null;
  startsAt: string;
  endsAt: string;
  reviewStatus: "pending" | "approved" | "rejected";
};

export type ScheduleChange = {
  id: string;
  baseSlotId: string;
  changeType:
    | "maintained"
    | "moved"
    | "cancelled"
    | "room_changed"
    | "time_changed";
  newRoomCode: string | null;
  newStartsAt: string | null;
  newEndsAt: string | null;
  observedAt: string;
  expiresAt: string;
  status: "active" | "superseded" | "revoked";
};

export type ScheduleReadResult =
  | {
      ok: true;
      course: {
        subjectCode: string;
        subjectLabel: string;
        roomCode: string | null;
        startsAt: string;
        endsAt: string;
        state: "scheduled" | "maintained" | "moved" | "cancelled";
      };
      source: {
        versionId: string;
        sourceType: ScheduleSourceType;
        activatedAt: string;
        freshUntil: string;
        changeObservedAt: string | null;
      };
    }
  | {
      ok: false;
      reason: ScheduleReadFailureReason;
    };

export type ScheduleReadFailureReason =
  | "identity_i3_required"
  | "source_unavailable"
  | "teacher_schedule_unavailable"
  | "source_stale"
  | "no_authorized_course"
  | "conflicting_changes";

// Un professeur n'a jamais de classe ni de groupe autorisés dans son
// périmètre : seule sa référence d'enseignant est peuplée
// (`schedule-identity-reader.ts`, `isOwnStaffSchedule`). Tant que la source
// active ne porte aucune version de type "teachers" (l'export disponible
// aujourd'hui est un PDF par classe, sans référence d'enseignant), ce
// périmètre ne peut jamais trouver de version : le distinguer du cas
// générique évite de répondre à un professeur qu'il "n'a pas de cours" alors
// qu'aucune source ne le concerne du tout.
export function scheduleSourceUnavailableReason(viewer: {
  authorizedClassRefs: string[];
  authorizedGroupRefs: string[];
  authorizedTeacherRefs: string[];
}): "teacher_schedule_unavailable" | "source_unavailable" {
  const isTeacherOnlyScope =
    viewer.authorizedTeacherRefs.length > 0 &&
    viewer.authorizedClassRefs.length === 0 &&
    viewer.authorizedGroupRefs.length === 0;
  return isTeacherOnlyScope ? "teacher_schedule_unavailable" : "source_unavailable";
}

export type ScheduleDayCourse = {
  subjectCode: string;
  subjectLabel: string;
  roomCode: string | null;
  startsAt: string;
  endsAt: string;
  state: "scheduled" | "maintained" | "moved" | "cancelled";
};

export type ScheduleDayReadResult =
  | {
      ok: true;
      courses: ScheduleDayCourse[];
      source: {
        versionId: string;
        sourceType: ScheduleSourceType;
        activatedAt: string;
        freshUntil: string;
      };
    }
  | {
      ok: false;
      reason: ScheduleReadFailureReason;
    };

function timestamp(value: string): number {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function isAuthorized(viewer: ScheduleViewer, slot: ScheduleSlot): boolean {
  const teacherAuthorized =
    slot.teacherRef !== null && viewer.authorizedTeacherRefs.includes(slot.teacherRef);
  const learnerAuthorized = slot.groupRef !== null
    ? viewer.authorizedGroupRefs.includes(slot.groupRef)
    : slot.classRef !== null && viewer.authorizedClassRefs.includes(slot.classRef);
  return teacherAuthorized || learnerAuthorized;
}

function selectActiveVersion(
  versions: ScheduleVersion[],
  now: number,
  requestedAt: number
): ScheduleVersion | null {
  return (
    versions
      .filter((version) => {
        const effectiveFrom = timestamp(version.effectiveFrom);
        const effectiveUntil = version.effectiveUntil
          ? timestamp(version.effectiveUntil)
          : Number.POSITIVE_INFINITY;
        return (
          version.status === "active" &&
          version.activatedAt !== null &&
          Number.isFinite(effectiveFrom) &&
          requestedAt >= effectiveFrom &&
          requestedAt <= effectiveUntil &&
          timestamp(version.activatedAt) <= now
        );
      })
      .sort(
        (left, right) =>
          timestamp(right.activatedAt as string) - timestamp(left.activatedAt as string)
      )[0] ?? null
  );
}

function selectChange(
  changes: ScheduleChange[],
  slotId: string,
  now: number
): ScheduleChange | "conflict" | null {
  const active = changes
    .filter(
      (change) =>
        change.baseSlotId === slotId &&
        change.status === "active" &&
        timestamp(change.observedAt) <= now &&
        timestamp(change.expiresAt) >= now
    )
    .sort((left, right) => timestamp(right.observedAt) - timestamp(left.observedAt));

  if (active.length < 2) return active[0] ?? null;
  if (
    timestamp(active[0].observedAt) === timestamp(active[1].observedAt) &&
    (active[0].changeType !== active[1].changeType ||
      active[0].newRoomCode !== active[1].newRoomCode ||
      active[0].newStartsAt !== active[1].newStartsAt ||
      active[0].newEndsAt !== active[1].newEndsAt)
  ) {
    return "conflict";
  }
  return active[0];
}

function applyChange(
  slot: ScheduleSlot,
  change: ScheduleChange | null
): ScheduleDayCourse {
  const startsAt = change?.newStartsAt ?? slot.startsAt;
  const endsAt = change?.newEndsAt ?? slot.endsAt;
  const roomCode = change?.changeType === "cancelled"
    ? null
    : change?.newRoomCode ?? slot.roomCode;
  const state = change
    ? change.changeType === "room_changed" || change.changeType === "time_changed"
      ? "moved"
      : change.changeType
    : "scheduled";
  return {
    subjectCode: slot.subjectCode,
    subjectLabel: slot.subjectLabel,
    roomCode,
    startsAt,
    endsAt,
    state,
  };
}

export function readNextAuthorizedCourse(input: {
  viewer: ScheduleViewer;
  now: string;
  requestedAt: string;
  versions: ScheduleVersion[];
  slots: ScheduleSlot[];
  changes: ScheduleChange[];
}): ScheduleReadResult {
  if (!identityAtLeast(input.viewer.identityLevel, "I3")) {
    return { ok: false, reason: "identity_i3_required" };
  }

  const now = timestamp(input.now);
  const requestedAt = timestamp(input.requestedAt);
  const version = selectActiveVersion(input.versions, now, requestedAt);
  if (!version) return { ok: false, reason: scheduleSourceUnavailableReason(input.viewer) };
  if (timestamp(version.freshUntil) < now) {
    return { ok: false, reason: "source_stale" };
  }

  const slot = input.slots
    .filter(
      (candidate) =>
        candidate.sourceVersionId === version.id &&
        candidate.reviewStatus === "approved" &&
        isAuthorized(input.viewer, candidate) &&
        timestamp(candidate.endsAt) >= requestedAt
    )
    .sort((left, right) => timestamp(left.startsAt) - timestamp(right.startsAt))[0];

  if (!slot) return { ok: false, reason: "no_authorized_course" };

  const change = selectChange(input.changes, slot.id, now);
  if (change === "conflict") return { ok: false, reason: "conflicting_changes" };

  return {
    ok: true,
    course: applyChange(slot, change),
    source: {
      versionId: version.id,
      sourceType: version.sourceType,
      activatedAt: version.activatedAt as string,
      freshUntil: version.freshUntil,
      changeObservedAt: change?.observedAt ?? null,
    },
  };
}

export function readAuthorizedCoursesForDay(input: {
  viewer: ScheduleViewer;
  now: string;
  dayStart: string;
  dayEnd: string;
  versions: ScheduleVersion[];
  slots: ScheduleSlot[];
  changes: ScheduleChange[];
}): ScheduleDayReadResult {
  if (!identityAtLeast(input.viewer.identityLevel, "I3")) {
    return { ok: false, reason: "identity_i3_required" };
  }

  const now = timestamp(input.now);
  const dayStart = timestamp(input.dayStart);
  const dayEnd = timestamp(input.dayEnd);
  const version = selectActiveVersion(input.versions, now, dayStart);
  if (!version) return { ok: false, reason: scheduleSourceUnavailableReason(input.viewer) };
  if (timestamp(version.freshUntil) < now) {
    return { ok: false, reason: "source_stale" };
  }

  const daySlots = input.slots
    .filter(
      (candidate) =>
        candidate.sourceVersionId === version.id &&
        candidate.reviewStatus === "approved" &&
        isAuthorized(input.viewer, candidate) &&
        timestamp(candidate.startsAt) < dayEnd &&
        timestamp(candidate.endsAt) > dayStart
    )
    .sort((left, right) => timestamp(left.startsAt) - timestamp(right.startsAt));

  const courses: ScheduleDayCourse[] = [];
  for (const slot of daySlots) {
    const change = selectChange(input.changes, slot.id, now);
    if (change === "conflict") return { ok: false, reason: "conflicting_changes" };
    courses.push(applyChange(slot, change));
  }

  return {
    ok: true,
    courses,
    source: {
      versionId: version.id,
      sourceType: version.sourceType,
      activatedAt: version.activatedAt as string,
      freshUntil: version.freshUntil,
    },
  };
}
