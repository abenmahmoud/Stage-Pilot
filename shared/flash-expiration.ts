// Detection d'une proposition d'information flash expiree sans validation.
//
// §13 : « Une proposition qui atteint son expiration sans avoir ete validee
// n'est jamais fermee en silence. » Ce module se limite a la DETECTION pure
// (aucune horloge, aucun envoi) : le message factuel a l'auteur et le
// comptage des echecs (T071D) relevent de l'ecran de validation (LOT 4) et de
// la recette (LOT 5), pas de ce lot.
//
// La transition legale correspondante (`proposee` -> `expiree_sans_validation`)
// est deja verifiee par `flash-transitions.ts` ; ce module decide seulement
// QUAND l'appliquer.

import { type FlashVersionStatus } from "./flash-transitions.js";

export type FlashExpirationReason = "still_pending" | "expired_without_validation" | "not_applicable";

export type FlashExpirationCheck = {
  isExpiredWithoutValidation: boolean;
  reason: FlashExpirationReason;
};

export class FlashExpirationError extends Error {
  readonly reason: string;

  constructor(reason: string) {
    super("Le controle d'expiration de la proposition flash est invalide");
    this.reason = reason;
  }
}

/**
 * Seul l'etat `proposee` peut expirer sans validation : une version deja
 * validee, publiee, modifiee, refusee ou deja marquee expiree a deja recu une
 * decision humaine (ou n'en attend plus une). Comparer `expiresAt` a `now`
 * n'a de sens que pour une proposition encore en attente.
 */
export function checkFlashProposalExpiration(input: {
  status: unknown;
  expiresAt: unknown;
  now: unknown;
}): FlashExpirationCheck {
  if (!(input.expiresAt instanceof Date) || Number.isNaN(input.expiresAt.getTime())) {
    throw new FlashExpirationError("expires_at_invalid");
  }
  if (!(input.now instanceof Date) || Number.isNaN(input.now.getTime())) {
    throw new FlashExpirationError("now_invalid");
  }

  const status = input.status as FlashVersionStatus;
  if (status !== "proposee") {
    return { isExpiredWithoutValidation: false, reason: "not_applicable" };
  }

  if (input.now.getTime() < input.expiresAt.getTime()) {
    return { isExpiredWithoutValidation: false, reason: "still_pending" };
  }

  return { isExpiredWithoutValidation: true, reason: "expired_without_validation" };
}

/**
 * Filtre une liste de propositions en attente (meme forme que l'index partiel
 * `flash_info_versions_expiration_pending_idx`, `status = 'proposee'` trie par
 * `expires_at`) pour ne garder que celles reellement expirees a `now`.
 */
export function selectExpiredFlashProposals<T extends { status: unknown; expiresAt: unknown }>(
  proposals: readonly T[],
  now: Date
): T[] {
  return proposals.filter(
    (proposal) => checkFlashProposalExpiration({ status: proposal.status, expiresAt: proposal.expiresAt, now }).isExpiredWithoutValidation
  );
}
