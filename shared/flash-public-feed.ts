// Tri et bornage du flux public d'informations flash (LOT 2 du plan de
// visibilité publique, docs/operations/PLAN_FLASH_PUBLIC_2026-09-05.md),
// pur, sans base ni réseau.
//
// La visibilité elle-même (statut, expiration, audience) est déjà décidée par
// shared/flash-visibility.ts (LOT 1) : ce module ne la revérifie pas, il ne
// fait que classer et borner une liste déjà filtrée visible.
//
// Règle du plan : « triées par importance puis par date, bornées en nombre ».
// L'ordre de sévérité vient de FLASH_IMPORTANCE_LEVELS
// (shared/flash-version-diff.ts, ordre croissant "normale" < "importante" <
// "urgente") : on ne redéfinit pas un second classement, on inverse son rang.

import { FLASH_IMPORTANCE_LEVELS, type FlashImportance } from "./flash-version-diff.js";

/** Nombre maximal d'informations affichées sur le flux public. */
export const FLASH_PUBLIC_FEED_LIMIT = 20;

export type FlashPublicFeedCandidate = {
  importance: FlashImportance;
  publishedAt: Date;
};

function importanceSeverityRank(importance: FlashImportance): number {
  // Rang 0 = la plus sévère ("urgente"), pour un tri croissant simple.
  return FLASH_IMPORTANCE_LEVELS.length - 1 - FLASH_IMPORTANCE_LEVELS.indexOf(importance);
}

/**
 * Trie par importance décroissante (urgente d'abord) puis par date de
 * publication décroissante (la plus récente d'abord) à importance égale.
 */
export function sortFlashPublicFeed<T extends FlashPublicFeedCandidate>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => {
    const rankDiff = importanceSeverityRank(a.importance) - importanceSeverityRank(b.importance);
    if (rankDiff !== 0) return rankDiff;
    return b.publishedAt.getTime() - a.publishedAt.getTime();
  });
}

/**
 * Trie puis borne à FLASH_PUBLIC_FEED_LIMIT : « rien ne s'affiche s'il n'y a
 * rien » (LOT 2) reste vrai à l'arrivée — un tableau vide en entrée ressort
 * vide, jamais un faux contenu de remplissage.
 */
export function selectFlashPublicFeedPage<T extends FlashPublicFeedCandidate>(items: readonly T[]): T[] {
  return sortFlashPublicFeed(items).slice(0, FLASH_PUBLIC_FEED_LIMIT);
}
