export const REQUESTER_RESOLVABLE_STATUSES = [
  'nouveau',
  'a_qualifier',
  'assigne',
  'en_cours',
  'attente_demandeur',
  'attente_interne',
] as const;

export const REQUESTER_MESSAGE_REOPEN_STATUSES = ['attente_demandeur', 'resolu'] as const;

export function canRequesterResolve(status: string): boolean {
  return (REQUESTER_RESOLVABLE_STATUSES as readonly string[]).includes(status);
}

export function shouldReopenOnRequesterMessage(status: string): boolean {
  return (REQUESTER_MESSAGE_REOPEN_STATUSES as readonly string[]).includes(status);
}
