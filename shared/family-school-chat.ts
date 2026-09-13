import { requestedOwnCoursesDayOffset, requestsOwnSchedule } from './schedule-assistant.js';

type Message = { role: 'assistant' | 'requester'; content: string };
export type FamilySchoolIntent = { kind: 'class' | 'schedule'; day: 0 | 1 | null; explicitChild: boolean };
export type SchoolTargetChoices = { expiresAt: string; options: { key: string; label: string }[] };
const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[’`]/g, "'").trim();
export const isSchoolDayFollowup = (text: string) => /^(?:(?:oui|et|pour|plutot)[ ,]*){0,2}(demain|aujourd'hui)(?:[ ,]*(?:svp|stp|merci|s'il (?:vous|te) plait))?[.!?\s]*$/.test(normalize(text));

/** Intent only. Names or references in the conversation never establish authorization. */
export function familySchoolIntent(messages: readonly Message[]): FamilySchoolIntent | null {
  const requests = messages.filter(m => m.role === 'requester');
  const last = requests.at(-1);
  if (!last) return null;
  const text = normalize(last.content);
  if (/\b(absences?|absent|retards?|changer|changement de classe|inscri\w*|autre eleve|autre enfant|notes?|bulletins?|sanctions?|resultats?|dossiers?|coordonnees|e-?mail|telephone|adresse)\b/.test(text)) return null;
  const child = /\b(mon enfant|mes enfants|mon fils|ma fille)\b/.test(text);
  if (child && /\b(classe|classes)\b/.test(text) && !/\b(emploi|cours|edt|planning)\b/.test(text)) return { kind: 'class', day: null, explicitChild: true };
  if (child && /\b(emploi du temps|cours|edt|planning)\b/.test(text)) {
    // Unsupported periods must be clarified instead of silently returning today.
    const day = /\b(semaine|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|apres.demain)\b/.test(text) ? null
      : /\bdemain\b/.test(text) ? 1 : /\b(aujourd'hui|du jour|ce matin|cet apres-midi)\b/.test(text) ? 0 : null;
    return { kind: 'schedule', day, explicitChild: true };
  }
  if (isSchoolDayFollowup(text)) {
    const previous = requests.slice(0, -1).findLast(m => !isSchoolDayFollowup(m.content));
    const intent = previous ? familySchoolIntent([previous]) : null;
    if (intent?.kind === 'schedule') return { ...intent, day: text.includes('demain') ? 1 : 0 };
  }
  const ownDay = requestedOwnCoursesDayOffset([...messages]);
  if (requestsOwnSchedule([...messages]) || ownDay !== null) return { kind: 'schedule', day: ownDay, explicitChild: false };
  return null;
}

export function isSchoolTargetChoices(value: unknown, nowMs = Date.now()): value is SchoolTargetChoices {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return Object.keys(v).length === 2 && typeof v.expiresAt === 'string'
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v.expiresAt)
    && Date.parse(v.expiresAt) > nowMs && Date.parse(v.expiresAt) <= nowMs + 5 * 60_000
    && Array.isArray(v.options) && v.options.length > 0 && v.options.length <= 20
    && v.options.every(o => o && typeof o === 'object' && !Array.isArray(o) && Object.keys(o).length === 2
      && typeof o.key === 'string' && /^[a-f0-9]{64}$/.test(o.key)
      && typeof o.label === 'string' && o.label.trim().length > 0 && o.label.length <= 120 && !/[\u0000-\u001f]/.test(o.label))
    && new Set(v.options.map(o => o.key)).size === v.options.length;
}
