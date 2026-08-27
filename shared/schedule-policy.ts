export type ScheduleIdentityLevel =
  | "visitor"
  | "contact_verified"
  | "school_identity"
  | "agent";

export type ScheduleSourceType =
  | "pdf_import"
  | "official_export"
  | "official_connector";

export type ScheduleViewer = {
  identityLevel: ScheduleIdentityLevel;
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
      reason:
        | "school_identity_required"
        | "source_unavailable"
        | "source_stale"
        | "no_authorized_course"
        | "conflicting_changes";
    };

function timestamp(value: string): number {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function isAuthorized(viewer: ScheduleViewer, slot: ScheduleSlot): boolean {
  return (
    (slot.classRef !== null && viewer.authorizedClassRefs.includes(slot.classRef)) ||
    (slot.groupRef !== null && viewer.authorizedGroupRefs.includes(slot.groupRef)) ||
    (slot.teacherRef !== null && viewer.authorizedTeacherRefs.includes(slot.teacherRef))
  );
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

export function readNextAuthorizedCourse(input: {
  viewer: ScheduleViewer;
  now: string;
  requestedAt: string;
  versions: ScheduleVersion[];
  slots: ScheduleSlot[];
  changes: ScheduleChange[];
}): ScheduleReadResult {
  if (!["school_identity", "agent"].includes(input.viewer.identityLevel)) {
    return { ok: false, reason: "school_identity_required" };
  }

  const now = timestamp(input.now);
  const requestedAt = timestamp(input.requestedAt);
  const version = selectActiveVersion(input.versions, now, requestedAt);
  if (!version) return { ok: false, reason: "source_unavailable" };
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
    ok: true,
    course: {
      subjectCode: slot.subjectCode,
      subjectLabel: slot.subjectLabel,
      roomCode,
      startsAt,
      endsAt,
      state,
    },
    source: {
      versionId: version.id,
      sourceType: version.sourceType,
      activatedAt: version.activatedAt as string,
      freshUntil: version.freshUntil,
      changeObservedAt: change?.observedAt ?? null,
    },
  };
}
