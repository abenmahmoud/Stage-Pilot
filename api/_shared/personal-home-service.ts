import type { PersonalHome, PersonalHomeRequest, PersonalHomeTarget } from '../../shared/personal-home.js';
import type { ScheduleDayReadResult } from '../../shared/schedule-policy.js';
import { schoolDayBoundsUtc } from '../../shared/assistant-school-context.js';
import { HttpError } from './auth.js';

export type HomeIdentity = { id: string; institutionId: string; personRef: string; sourceImportId: string; personType: 'student' | 'guardian' | 'staff'; expiresAt: Date };
export type HomeTarget = PersonalHomeTarget & { personRef: string };
export type PersonalHomeReaders = {
  identity: () => Promise<HomeIdentity | null>;
  targets: (identity: HomeIdentity) => Promise<HomeTarget[]>;
  schedule: (target: HomeTarget, bounds: ReturnType<typeof schoolDayBoundsUtc>) => Promise<ScheduleDayReadResult>;
  requests: (identity: HomeIdentity) => Promise<PersonalHomeRequest[]>;
};

/** Only authenticated server readers supply facts. No model call or client-supplied identity. */
export async function personalHomeService(input: { day: 0 | 1; target?: string; now: Date }, readers: PersonalHomeReaders): Promise<PersonalHome> {
  const identity = await readers.identity();
  if (!identity || identity.expiresAt <= input.now) return { status: 'unavailable' };
  const targets = await readers.targets(identity);
  const selected = input.target ? targets.find(target => target.key === input.target) : targets[0];
  if (input.target && !selected) throw new HttpError(403, 'Cet emploi du temps n’est pas accessible depuis votre espace.');
  const bounds = schoolDayBoundsUtc(input.now, input.day);
  const [courses, requests] = await Promise.allSettled([
    selected ? readers.schedule(selected, bounds) : Promise.resolve(null), readers.requests(identity),
  ]);
  // Discard in-flight results if the identity expired, was replaced, or was revoked.
  const confirmed = await readers.identity();
  if (!confirmed || confirmed.id !== identity.id || confirmed.personRef !== identity.personRef
    || confirmed.institutionId !== identity.institutionId || confirmed.sourceImportId !== identity.sourceImportId
    || confirmed.expiresAt <= new Date()) return { status: 'unavailable' };
  const result = courses.status === 'fulfilled' ? courses.value : null;
  const message = !selected && identity.personType === 'guardian'
    ? 'Le lien avec un enfant doit être confirmé dans l’annuaire du lycée. Blaise peut vous aider à faire vérifier la situation.'
    : result && !result.ok && result.reason === 'source_stale'
      ? 'Votre emploi du temps doit être actualisé par le lycée avant de pouvoir être affiché.'
      : 'Votre emploi du temps n’est pas encore disponible ici. Vous pouvez en demander la vérification à Blaise.';
  const dayLabel = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Paris' }).format(bounds.dayStart);
  const schedule: Extract<PersonalHome, { status: 'verified' }>['schedule'] = result?.ok && Date.parse(result.source.freshUntil) > Date.now()
    ? { status: 'ready', validUntil: result.source.freshUntil, value: { title: `Emploi du temps · ${dayLabel}`, courses: result.courses, updatedAt: result.source.activatedAt, incompleteGroups: result.incompleteGroups === true } }
    : { status: 'unavailable', message };
  return {
    status: 'verified', personType: identity.personType, expiresAt: confirmed.expiresAt.toISOString(), date: bounds.dayDate,
    targets: targets.map(({ key, label }) => ({ key, label })), selectedTarget: selected?.key ?? null, schedule,
    requests: requests.status === 'fulfilled'
      ? { status: 'available', items: requests.value.slice(0, 3), more: requests.value.length > 3 }
      : { status: 'unavailable', items: [], more: false },
  };
}
