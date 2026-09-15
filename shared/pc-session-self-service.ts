import type { AssistantConversationMessage } from './assistant-conversation-state.js';
import { decideVaultAccess } from './code-vault-policy.js';

const plain = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[’']/g, ' ');
const pcService = /\b(koxo|session(?:s)? (?:pc|windows|reseau|ordinateur)|(?:pc|ordinateur)s? (?:du |au )?lycee)\b/;
const otherService = /\b(ent|monlycee|pronote|cantine|chromebook|messagerie|emploi|horaire|certificat)\b/;
const isPcService = (text: string) => pcService.test(text) || (!otherService.test(text)
  && /\b(code|codes|identifiant|identifiants|mot de passe|connexion|connecter|acces)\b/.test(text)
  && /\b(pc|windows|ordinateur|session|reseau)\b/.test(text));

/** Only a personal PC-session request; an unrelated later question leaves this journey. */
export function requestsPcSessionAccess(messages: readonly AssistantConversationMessage[]): boolean {
  const latest = plain(messages.findLast(message => message.role === 'requester')?.content ?? '');
  if (otherService.test(latest) && !pcService.test(latest)) return false;
  if (isPcService(latest)) return true;
  const recent = [...messages].reverse().find(message => message.role === 'requester'
    && (isPcService(plain(message.content)) || otherService.test(plain(message.content))));
  return !!recent && isPcService(plain(recent.content))
    && /\b(code|codes|identifiant|identifiants|mot de passe|oublie|perdu|fonctionne|marche|incorrect|invalide|deja essaye)\b/.test(latest);
}

export function pcSessionRecoveryFailed(messages: readonly AssistantConversationMessage[]): boolean {
  return requestsPcSessionAccess(messages) && /\b(ne (?:marche|fonctionne) (?:toujours )?pas|incorrect|invalide|deja essaye)\b/.test(plain(messages.findLast(message => message.role === 'requester')?.content ?? ''));
}

export function pcSessionIdentityPrompt(): string {
  return 'Pour retrouver votre identifiant et votre code personnels de session PC, confirmons votre identité avec un code reçu par SMS ou par email sur un contact connu du lycée.';
}

export function ownPcSessionAccessAllowed(identity: { institutionId: string; personRef: string; personType: string }, target: { institutionId: string; personRef: string }): boolean {
  if (!['staff', 'student'].includes(identity.personType)) return false;
  return decideVaultAccess({
    actor: { profile: identity.personType === 'staff' ? 'professeur' : 'eleve', institutionId: identity.institutionId, personRef: identity.personRef },
    target: { service: 'koxo', institutionId: target.institutionId, subjectKind: 'self', subjectPersonRef: target.personRef, subjectClassRef: null },
  }).allowed;
}

export type PcSessionCredentials = { identifier: string; code: string };
function validCredentials(value: Record<string, unknown>): boolean {
  return typeof value.identifier === 'string' && /^[\x21-\x7e]{1,40}$/.test(value.identifier)
    && typeof value.code === 'string' && /^[\x20-\x7e]{4,60}$/.test(value.code);
}

/** The encrypted depot format is explicit: never derive a login from a person's name. */
export function credentialsFromPcVault(value: string): PcSessionCredentials | null {
  const match = /^Identifiant : ([\x21-\x7e]{1,40}?) \| Code : ([\x20-\x7e]{4,60})$/.exec(value);
  return match ? { identifier: match[1], code: match[2] } : null;
}

export type PcSessionAccessPayload =
  | { status: 'unavailable' | 'available' | 'verification_required' }
  | ({ status: 'ready'; expiresAt: string } & PcSessionCredentials);

export function validPcSessionAccessPayload(value: unknown): value is PcSessionAccessPayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  if (['unavailable', 'available', 'verification_required'].includes(String(v.status))) return Object.keys(v).length === 1;
  return Object.keys(v).length === 4 && v.status === 'ready' && validCredentials(v)
    && typeof v.expiresAt === 'string' && Number.isFinite(Date.parse(v.expiresAt));
}
