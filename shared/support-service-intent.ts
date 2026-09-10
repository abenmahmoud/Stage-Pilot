import { resolveAssistantConversationTransition, type AssistantConversationMessage } from './assistant-conversation-state.js';

type Message = AssistantConversationMessage;

function normalize(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[’'–—-]/g, ' ').replace(/\s+/g, ' ').trim();
}

function latestText(messages: readonly Message[]): string {
  return normalize(messages.findLast(message => message.role === 'requester')?.content ?? '');
}

export function requestsOwnClass(messages: readonly Message[]): boolean {
  const text = latestText(messages);
  if (/\b(enfant|fils|fille|autre|changer|changement|liste|effectif|eleves de|emploi|cours|salle|absence)\b/.test(text)) return false;
  return /\b(quelle est ma classe|dans quelle classe (?:je suis|suis je)|(?:connaitre|savoir|trouver|consulter|donne[rz]?|veux|voudrais|souhaite) (?:moi )?ma classe)\b/.test(text)
    || /^(?:bonjour[,. ]+)?ma classe[ ?.]*$/.test(text);
}

export function accessGuidanceKind(messages: readonly Message[]): 'reset' | 'recovery_failed' | null {
  const text = latestText(messages);
  const history = normalize(messages.filter(m => m.role === 'requester').map(m => m.content).join(' '));
  const recoveryContext = /\b(mot de passe|reinitialis\w*|recuperation|connexion|connecter|ent|pronote)\b/.test(history);
  // A failed attempt is information to preserve, never an instruction to repeat it.
  if (recoveryContext && /\b(aucun (?:e ?mail|sms|code|resultat)|ne recois (?:aucun|pas|plus)|pas recu (?:de |le |l |d )?(?:e ?mail|sms|lien)|deja essaye|deja fait)\b/.test(text)) return 'recovery_failed';
  if (/\b(reinitialis\w*|mot de passe oublie)\b/.test(text)
    && !/\b(mes codes|mon identifiant|mon code|donne\w* moi)\b/.test(text)) return 'reset';
  return null;
}

/** UX only. Every personal reader independently verifies the server session. */
export function requiresIdentityForPersonalSupport(messages: readonly Message[], category: string): boolean {
  // Agreeing to prepare a request (or declining) must remain possible without OTP.
  // This never grants access to a private reader or validates a new contact.
  const transition = resolveAssistantConversationTransition([...messages]);
  if (transition.stage === 'action_confirmed' || transition.stage === 'action_declined') return false;
  if (requestsOwnClass(messages)) return true;
  if (accessGuidanceKind(messages)) return false;
  const latest = latestText(messages);
  if (/\b(comment|quel formulaire|quelle procedure)\b/.test(latest)
    && /\b(paiement|payer|cantine|inscri\w*|autorisation d absence|formulaire)\b/.test(latest)
    && !/\b(mon code|mes codes|mon identifiant|ma classe|mon emploi|mes cours|mon dossier|mon certificat)\b/.test(latest)) return false;
  const text = normalize(messages.filter(m => m.role === 'requester').map(m => m.content).join(' '));
  return ['affectation_classe', 'documents_scolarite', 'ent', 'email_academique', 'logiciel', 'restauration_bourse', 'vie_scolaire'].includes(category)
    && /\b(mon|ma|mes|moi|notre|enfant|je veux|je souhaite|je voudrais|j aimerais)\b/.test(text);
}

export type OwnClassReadResult =
  | { ok: true; classRef: string }
  | { ok: false; reason: 'identity_required' | 'class_unavailable' };
