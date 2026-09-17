import type { AssistantConversationMessage } from './assistant-conversation-state.js';
import { decideVaultAccess } from './code-vault-policy.js';

// Public entry point verified against the Région FAQ and the live login page.
// Reset URLs contain a temporary login session and must never be stored here.
export const ENT_LOGIN_URL = 'https://auth.monlycee.net/';
export const ENT_RESET_STEPS = [
  'Ouvrez la page de connexion monlycée.net.',
  'Choisissez « Mot de passe oublié ? », saisissez votre identifiant exact, puis cliquez sur « Valider ».',
  'Suivez le lien de réinitialisation reçu et choisissez votre nouveau mot de passe.',
] as const;

export function entIdentityPrompt(): string {
  return `Vous pouvez vous connecter sur [monlycée.net](${ENT_LOGIN_URL}) ; PRONOTE s’ouvre ensuite depuis l’ENT du lycée. Si vous connaissez votre identifiant ENT mais avez oublié votre mot de passe, choisissez « Mot de passe oublié ? », saisissez cet identifiant, puis cliquez sur « Valider » pour recevoir un lien de réinitialisation.\n\nPour retrouver votre identifiant exact ou votre code de première activation ici, confirmons votre identité par SMS ou email sur un contact connu du lycée. Si vous êtes parent, indiquez votre propre nom et prénom : vous utilisez votre compte personnel de parent.`;
}

function plainAccessText(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[’']/g, ' ');
}

export function asksHowToOpenPronote(messages: readonly AssistantConversationMessage[]): boolean {
  const latest = plainAccessText(messages.findLast(m => m.role === 'requester')?.content ?? '');
  return /\bpronote\b/.test(latest)
    && /\b(comment|ou|acces|acceder|ouvrir|trouver|connexion|connecter)\b/.test(latest)
    && !/\b(code|codes|identifiant|identifiants|mot de passe|perdu|oublie|bloqu\w*|impossible|n arrive|ne peux|ne marche|ne fonctionne|reinitialis\w*)\b/.test(latest);
}

export function requestsEntAccess(messages: readonly AssistantConversationMessage[]): boolean {
  const plain = plainAccessText;
  const latest = plain(messages.findLast(m => m.role === 'requester')?.content ?? '');
  if (/^(?:merci(?: beaucoup)?|c est bon|ca marche|au revoir|bonne journee)[.! ]*$/.test(latest)) return false;
  const namedEnt = /\b(ent|monlycee|mon lycee|pronote)\b/.test(latest);
  const otherCode = /\b(?:code|codes|identifiant|identifiants|mot de passe)\s+(?:(?:de|du|pour|d|mon|ma)\s+)?(?:cantine|koxo|session|pc|windows|reseau)\b/.test(latest);
  if (otherCode || (/\b(koxo|cantine|certificat|windows|session|reseau)\b/.test(latest)
    && !namedEnt)) return false;
  if (asksHowToOpenPronote(messages)) return false;
  const accessTrouble = /\b(bloqu\w*|impossible|n arrive|ne peux|ne marche|ne fonctionne|perdu|oublie|reinitialis\w*|probleme de connexion)\b/.test(latest);
  const personalCredential = /\b(code|codes|identifiant|identifiants|mot de passe|activer|activation|mon compte|ma connexion)\b/.test(latest);
  // A login failure can coexist with an urgent timetable need or mention the
  // device used. Resolve access first; a plain timetable question goes to EDT.
  if (namedEnt && (accessTrouble || personalCredential)) return true;
  if (/\b(emplois?|horaires?|salles?|cours|edt|planning|pcs?)\b/.test(latest)) return false;
  if (/\b(koxo|cantine|certificat|windows|session|reseau)\b/.test(latest)) return false;
  const recentService = [...messages].reverse().find(m => m.role === 'requester'
    && /\b(ent|monlycee|mon lycee|pronote|koxo|cantine|messagerie|academique)\b/.test(plain(m.content)));
  const entContext = recentService ? /\b(ent|monlycee|mon lycee|pronote)\b/.test(plain(recentService.content)) : false;
  return /\b(ent|monlycee|mon lycee)\b/.test(latest) || entContext;
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
