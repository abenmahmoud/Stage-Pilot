import type { FamilySchoolIntent, SchoolTargetChoices } from '../../shared/family-school-chat.js';
import { isSchoolTargetChoices } from '../../shared/family-school-chat.js';
import type { ScheduleDayReadResult } from '../../shared/schedule-policy.js';
import { schoolDayBoundsUtc } from '../../shared/assistant-school-context.js';
import type { HomeIdentity, HomeTarget } from './personal-home-service.js';
import { isSchedulePresentation } from '../../shared/schedule-presentation.js';

export type FamilySchoolResult =
  | { status: 'identity_required' | 'unavailable' | 'forbidden' }
  | { status: 'choose_child'; choices: SchoolTargetChoices }
  | { status: 'day_required'; label: string }
  | { status: 'class'; label: string; classRef: string | null }
  | { status: 'schedule'; label: string; day: 0 | 1; result: ScheduleDayReadResult };

export type FamilySchoolReaders = {
  identity: () => Promise<HomeIdentity | null>;
  targets: (identity: HomeIdentity) => Promise<HomeTarget[]>;
  schedule: (target: HomeTarget, bounds: ReturnType<typeof schoolDayBoundsUtc>) => Promise<ScheduleDayReadResult>;
  clock?: () => Date;
};

/** Never choose a child by a typed name, a client reference or an unverified relationship. */
export async function familySchoolChatService(intent: FamilySchoolIntent, key: string | undefined, readers: FamilySchoolReaders): Promise<FamilySchoolResult | null> {
  const clock = readers.clock ?? (() => new Date());
  const identity = await readers.identity();
  if (!identity || identity.expiresAt <= clock()) return intent.explicitChild || key ? { status: 'identity_required' } : null;
  if (identity.personType !== 'guardian') return intent.explicitChild || key ? { status: 'forbidden' } : null;
  const targets = await readers.targets(identity);
  const choices = { expiresAt: new Date(Math.min(identity.expiresAt.getTime(), clock().getTime() + 240_000)).toISOString(), options: targets.map(({ key, label }) => ({ key, label })) };
  if (!isSchoolTargetChoices(choices, clock().getTime())
    || targets.some(t => !/^[A-Za-z0-9][A-Za-z0-9._:-]{2,119}$/.test(t.personRef)
      || (t.classRef != null && !/^[A-Za-z0-9][A-Za-z0-9._:-]{1,79}$/.test(t.classRef)))
    || new Set(targets.map(t => t.personRef)).size !== targets.length) return { status: 'unavailable' };
  const selected = key ? targets.find(t => t.key === key) : targets.length === 1 ? targets[0] : undefined;
  if (key && !selected) return { status: 'forbidden' };
  let result: FamilySchoolResult;
  if (!selected) result = { status: 'choose_child', choices };
  else if (intent.kind === 'class') result = { status: 'class', label: selected.label, classRef: selected.classRef ?? null };
  else if (intent.day === null) result = { status: 'day_required', label: selected.label };
  else {
    const schedule = await readers.schedule(selected, schoolDayBoundsUtc(clock(), intent.day));
    result = { status: 'schedule', label: selected.label, day: intent.day, result: schedule };
  }
  // Recheck both identity and links after in-flight reads, including a choice-only response.
  const confirmed = await readers.identity();
  if (!confirmed || confirmed.id !== identity.id || confirmed.personRef !== identity.personRef
    || confirmed.institutionId !== identity.institutionId || confirmed.sourceImportId !== identity.sourceImportId
    || confirmed.personType !== 'guardian' || confirmed.expiresAt <= clock()) return { status: 'identity_required' };
  const currentTargets = await readers.targets(confirmed);
  const stillAuthorized = targets.every(t => currentTargets.some(c => c.key === t.key && c.personRef === t.personRef && c.classRef === t.classRef && c.label === t.label));
  if (confirmed.expiresAt <= clock()) return { status: 'identity_required' };
  if (!stillAuthorized || choices.expiresAt <= clock().toISOString()) return { status: 'unavailable' };
  if (result.status === 'schedule' && result.result.ok && (
    !Number.isFinite(Date.parse(result.result.source.freshUntil))
    || Date.parse(result.result.source.freshUntil) <= clock().getTime()
    || !isSchedulePresentation({ title: result.label, courses: result.result.courses, updatedAt: result.result.source.activatedAt, incompleteGroups: result.result.incompleteGroups === true })
  )) return { status: 'unavailable' };
  return result;
}
