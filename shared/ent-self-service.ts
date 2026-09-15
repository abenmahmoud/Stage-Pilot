import type { AssistantConversationMessage } from './assistant-conversation-state.js';
import { decideVaultAccess } from './code-vault-policy.js';

export function requestsEntAccess(messages: readonly AssistantConversationMessage[]): boolean {
  const plain = (v: string) => v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[’']/g, ' ');
  const latest = plain(messages.findLast(m => m.role === 'requester')?.content ?? '');
  const history = plain(messages.filter(m => m.role === 'requester').map(m => m.content).join(' '));
  if (/\bcomment\b/.test(latest) && /\b(reinitialis\w*|mot de passe oublie)\b/.test(latest)
    && !/\b(mon identifiant|mes codes|mon code)\b/.test(latest)) return false;
  if (/\b(pronote|koxo|cantine|emploi|horaire|salle|certificat)\b/.test(latest)) return false;
  return /\b(ent|monlycee|mon lycee)\b/.test(latest)
    || (/\b(ent|monlycee|mon lycee)\b/.test(history) && /\b(code|codes|identifiant|identifiants|activer|activation|connecter|connexion|acces|compte|mot de passe)\b/.test(latest));
}

export type EntAccount = { identifier: string; activationState: 'active' | 'inactive' };
export function validEntAccount(value: unknown): value is EntAccount {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return Object.keys(v).length === 2 && typeof v.identifier === 'string'
    && /^[A-Za-z0-9][A-Za-z0-9._:-]{3,199}$/.test(v.identifier)
    && ['active','inactive'].includes(String(v.activationState));
}

export function ownEntAccessAllowed(identity: { institutionId: string; personRef: string; personType: string }, target: { institutionId: string; personRef: string }): boolean {
  if (!['student','guardian','staff'].includes(identity.personType)) return false;
  return decideVaultAccess({actor:{profile:identity.personType==='guardian'?'parent':identity.personType==='student'?'eleve':'professeur',
    institutionId:identity.institutionId,personRef:identity.personRef},
    target:{service:'ent',institutionId:target.institutionId,subjectKind:'self',subjectPersonRef:target.personRef,subjectClassRef:null}}).allowed;
}

/** Identity, export status and exact login all have to agree before a code leaves the vault. */
export function codeFromEntVault(value: string, account: EntAccount): string | null {
  if (account.activationState !== 'inactive') return null;
  const prefix = `Identifiant : ${account.identifier} | Code : `;
  if (!value.startsWith(prefix)) return null;
  const code = value.slice(prefix.length);
  return /^[\x21-\x7e]{4,60}$/.test(code) ? code : null;
}

export type EntAccessPayload =
  | { status: 'unavailable' }
  | { status: 'ready'; account: EntAccount; profile: 'student'|'guardian'|'staff'; code: string|null; expiresAt: string };
export function validEntAccessPayload(value: unknown): value is EntAccessPayload {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  if (v.status === 'unavailable') return Object.keys(v).length === 1;
  return Object.keys(v).length === 5 && v.status === 'ready' && validEntAccount(v.account)
    && ['student','guardian','staff'].includes(String(v.profile))
    && typeof v.expiresAt === 'string' && Number.isFinite(Date.parse(v.expiresAt))
    && (v.code === null || (v.account.activationState === 'inactive' && typeof v.code === 'string' && /^[\x21-\x7e]{4,60}$/.test(v.code)));
}
