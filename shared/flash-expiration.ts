// Detection d'une proposition d'information flash expiree sans validation,
// et preparation du message factuel a son auteur (T071D, LOT 5 du plan de
// persistance).
//
// §13 : « Une proposition qui atteint son expiration sans avoir ete validee
// n'est jamais fermee en silence. »
//
// La transition legale correspondante (`proposee` -> `expiree_sans_validation`)
// est deja verifiee par `flash-transitions.ts` ; ce module decide QUAND
// l'appliquer et QUEL message factuel preparer pour l'auteur. Il ne l'envoie
// jamais : c'est au serveur (LOT 5, `api/cron/flash-expiry.ts`) d'enregistrer
// ce message comme "a emettre", jamais comme emis.

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

export type FlashValidatedExpirationReason =
  | "still_awaiting_publication"
  | "expired_after_validation_without_publication"
  | "not_applicable";

export type FlashValidatedExpirationCheck = {
  isExpiredAfterValidationWithoutPublication: boolean;
  reason: FlashValidatedExpirationReason;
};

/**
 * Meme logique que `checkFlashProposalExpiration`, pour le cas distinct
 * d'une version deja VALIDEE mais jamais publiee avant son expiration
 * (T071F, LOT 2 du plan de publication). Ce n'est pas une extension de
 * `checkFlashProposalExpiration` : les deux causes n'appellent pas la meme
 * correction d'organisation (regle du plan, LOT 2) et ne doivent jamais etre
 * comptees ensemble, donc jamais fusionnees dans la meme fonction ni le meme
 * compteur.
 *
 * Seul l'etat `validee` peut expirer sans publication : une version encore
 * `proposee` n'a pas encore ete decidee (voir `checkFlashProposalExpiration`),
 * et une version deja publiee, modifiee, refusee ou deja expiree a deja recu
 * l'issue finale qu'elle attendait.
 */
export function checkFlashValidatedProposalExpiration(input: {
  status: unknown;
  expiresAt: unknown;
  now: unknown;
}): FlashValidatedExpirationCheck {
  if (!(input.expiresAt instanceof Date) || Number.isNaN(input.expiresAt.getTime())) {
    throw new FlashExpirationError("expires_at_invalid");
  }
  if (!(input.now instanceof Date) || Number.isNaN(input.now.getTime())) {
    throw new FlashExpirationError("now_invalid");
  }

  const status = input.status as FlashVersionStatus;
  if (status !== "validee") {
    return { isExpiredAfterValidationWithoutPublication: false, reason: "not_applicable" };
  }

  if (input.now.getTime() < input.expiresAt.getTime()) {
    return { isExpiredAfterValidationWithoutPublication: false, reason: "still_awaiting_publication" };
  }

  return {
    isExpiredAfterValidationWithoutPublication: true,
    reason: "expired_after_validation_without_publication",
  };
}

/**
 * Filtre une liste de versions validees en attente (meme forme que l'index
 * partiel `flash_info_versions_validee_expiration_pending_idx`,
 * `status = 'validee'`) pour ne garder que celles reellement expirees sans
 * avoir ete publiees.
 */
export function selectExpiredValidatedFlashProposals<T extends { status: unknown; expiresAt: unknown }>(
  proposals: readonly T[],
  now: Date
): T[] {
  return proposals.filter(
    (proposal) =>
      checkFlashValidatedProposalExpiration({ status: proposal.status, expiresAt: proposal.expiresAt, now })
        .isExpiredAfterValidationWithoutPublication
  );
}

export type FlashExpirationAuthorNotice = {
  /** Toujours "a_emettre" : ce module prepare le message, il ne l'emet jamais. */
  status: "a_emettre";
  message: string;
};

function assertValidExpirationNoticeInput(input: { title: unknown; expiresAt: unknown }): {
  title: string;
  expiresAt: Date;
} {
  if (typeof input.title !== "string" || input.title.trim().length === 0) {
    throw new FlashExpirationError("title_invalid");
  }
  if (!(input.expiresAt instanceof Date) || Number.isNaN(input.expiresAt.getTime())) {
    throw new FlashExpirationError("expires_at_invalid");
  }
  return { title: input.title, expiresAt: input.expiresAt };
}

/**
 * Message factuel prepare pour l'auteur d'une proposition expiree sans
 * validation (T071D) : dit seulement qu'elle n'a pas ete publiee et que
 * personne n'a ete informe. Ne nomme jamais de valideur, n'ajoute jamais de
 * motif — la proposition a simplement atteint son expiration sans decision.
 */
export function buildFlashExpirationAuthorNotice(input: { title: unknown; expiresAt: unknown }): FlashExpirationAuthorNotice {
  const { title, expiresAt } = assertValidExpirationNoticeInput(input);
  return {
    status: "a_emettre",
    message:
      `Votre proposition d'information flash « ${title} » a expiré ` +
      `(${expiresAt.toISOString()}) sans avoir été validée : elle n'a pas ` +
      "été publiée et personne n'a été informé.",
  };
}

/**
 * Meme avis factuel que `buildFlashExpirationAuthorNotice`, pour le cas
 * distinct d'une proposition VALIDEE mais jamais publiee avant son
 * expiration (T071F, LOT 2). Ne nomme aucun valideur, n'ajoute aucun motif —
 * mais, a la difference du cas "jamais validee", ne peut pas dire "sans
 * avoir été validée" puisque c'est faux ici : elle l'a ete, elle n'a
 * simplement jamais ete publiee.
 */
export function buildFlashValidatedExpirationAuthorNotice(input: {
  title: unknown;
  expiresAt: unknown;
}): FlashExpirationAuthorNotice {
  const { title, expiresAt } = assertValidExpirationNoticeInput(input);
  return {
    status: "a_emettre",
    message:
      `Votre proposition d'information flash « ${title} » a expiré ` +
      `(${expiresAt.toISOString()}) sans avoir été publiée : personne n'a été informé.`,
  };
}
