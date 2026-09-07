// Validation stricte de la réponse de `api/schedule/admin/imports/[id]/pages/[pageId]/slots.ts`
// (point d'écriture unique de `schedule_slots`, voir `api/_shared/schedule-slot-write.ts`).
// Symétrique de `shared/schedule-admin-payload.ts` : le front ne fait jamais confiance
// à la forme d'une réponse réseau sans la revalider entièrement.

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SUBJECT_CODE_PATTERN = /^[A-Z0-9][A-Z0-9._:-]{0,31}$/;
const REF_PATTERN = /^[A-Z0-9][A-Z0-9._:-]{1,79}$/;
const ISO_PATTERN = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$/;

export type ScheduleSlotWritePayload = {
  id: string;
  classRef: string | null;
  groupRef: string | null;
  teacherRef: string | null;
  subjectCode: string;
  subjectLabel: string;
  roomCode: string | null;
  startsAt: string;
  endsAt: string;
  weekPattern: string | null;
};

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function exactRecord(value: unknown, keys: readonly string[]): Record<string, unknown> | null {
  const candidate = record(value);
  if (!candidate) return null;
  const actual = Object.keys(candidate).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index])
    ? candidate
    : null;
}

function hasControlChar(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}

function boundedText(value: unknown, minimum: number, maximum: number): string | null {
  if (typeof value !== "string" || hasControlChar(value)) return null;
  return value.length >= minimum && value.length <= maximum ? value : null;
}

function nullableRef(value: unknown): string | null | undefined {
  if (value === null) return null;
  return typeof value === "string" && REF_PATTERN.test(value) ? value : undefined;
}

function timestamp(value: unknown): string | null {
  if (typeof value !== "string" || !ISO_PATTERN.test(value)) return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? value : null;
}

function nullableText(value: unknown, minimum: number, maximum: number): string | null | undefined {
  if (value === null) return null;
  return boundedText(value, minimum, maximum) ?? undefined;
}

function parseSlot(value: unknown): ScheduleSlotWritePayload | null {
  const row = exactRecord(value, [
    "id",
    "classRef",
    "groupRef",
    "teacherRef",
    "subjectCode",
    "subjectLabel",
    "roomCode",
    "startsAt",
    "endsAt",
    "weekPattern",
  ]);
  if (!row || typeof row.id !== "string" || !UUID_PATTERN.test(row.id)) return null;
  const classRef = nullableRef(row.classRef);
  const teacherRef = nullableRef(row.teacherRef);
  const groupRef = nullableRef(row.groupRef);
  const subjectCode = typeof row.subjectCode === "string" && SUBJECT_CODE_PATTERN.test(row.subjectCode)
    ? row.subjectCode
    : null;
  const subjectLabel = boundedText(row.subjectLabel, 2, 120);
  const roomCode = nullableText(row.roomCode, 1, 40);
  const weekPattern = nullableText(row.weekPattern, 1, 16);
  const startsAt = timestamp(row.startsAt);
  const endsAt = timestamp(row.endsAt);
  if (
    classRef === undefined
    || teacherRef === undefined
    || groupRef === undefined
    || !subjectCode
    || !subjectLabel
    || roomCode === undefined
    || weekPattern === undefined
    || !startsAt
    || !endsAt
    || Date.parse(endsAt) <= Date.parse(startsAt)
    || (classRef === null) === (teacherRef === null)
  ) return null;
  return {
    id: row.id,
    classRef,
    groupRef,
    teacherRef,
    subjectCode,
    subjectLabel,
    roomCode,
    startsAt,
    endsAt,
    weekPattern,
  };
}

export function parseScheduleSlotWritePayload(
  value: unknown,
  expected: { subjectType: "class" | "teacher"; subjectRef: string; rowCount: number }
): { slots: ScheduleSlotWritePayload[] } | null {
  const root = exactRecord(value, ["slots"]);
  if (!root || !Array.isArray(root.slots) || root.slots.length !== expected.rowCount) return null;
  const slots: ScheduleSlotWritePayload[] = [];
  for (const entry of root.slots) {
    const slot = parseSlot(entry);
    if (!slot) return null;
    const ownRef = expected.subjectType === "class" ? slot.classRef : slot.teacherRef;
    const otherRef = expected.subjectType === "class" ? slot.teacherRef : slot.classRef;
    if (ownRef !== expected.subjectRef || otherRef !== null) return null;
    slots.push(slot);
  }
  return { slots };
}
