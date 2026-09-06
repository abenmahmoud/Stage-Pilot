// LOT 6 du plan de connaissance OB1 (2026-09-05). La cartographie relève
// (ligne 21/25) que le balayage de péremption tourne à `15 2 * * *` en UTC —
// donc à 3 h ou 4 h heure de Paris selon l'heure d'été/d'hiver, pas à 2 h 15
// — et qu'aucun contrôle de fraîcheur n'existe à 08 h, 13 h et 18 h heure de
// Paris. Vercel Cron ne connaît que l'UTC (aucun fuseau dans vercel.json) :
// un horaire fixe ne peut donc pas suivre le changement d'heure. La
// correction n'est pas de deviner un décalage UTC différent l'été et
// l'hiver, mais d'appeler la route toutes les heures (voir vercel.json) et
// de laisser ce module pur décider, à partir de l'heure locale Paris réelle
// de `now`, si l'appel en cours doit déclencher un balayage.

import { parisHourOf } from "./paris-time.js";

export const KNOWLEDGE_EXPIRY_SWEEP_HOUR = 2;
export const KNOWLEDGE_FRESHNESS_CHECK_HOURS = [8, 13, 18] as const;

export type ScheduledKnowledgeSweepTrigger =
  | "scheduled_nightly_expiry"
  | "scheduled_freshness_check"
  | "not_scheduled";

/**
 * Décide, pour un instant `now`, si le passage planifié en cours correspond
 * au balayage nocturne (2 h, héritier du `15 2 * * *` d'origine) ou à l'un
 * des contrôles de fraîcheur (8 h, 13 h, 18 h) — jamais les deux à la fois,
 * les heures ne se recouvrent pas. En dehors de ces heures, ne déclenche
 * rien : la route appelante doit répondre sans ouvrir de transaction.
 */
export function scheduledKnowledgeSweepTrigger(now: Date): ScheduledKnowledgeSweepTrigger {
  const hour = parisHourOf(now);
  if (hour === KNOWLEDGE_EXPIRY_SWEEP_HOUR) return "scheduled_nightly_expiry";
  if ((KNOWLEDGE_FRESHNESS_CHECK_HOURS as readonly number[]).includes(hour)) {
    return "scheduled_freshness_check";
  }
  return "not_scheduled";
}
