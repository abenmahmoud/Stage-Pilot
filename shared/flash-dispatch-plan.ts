// Calcule les lignes `flash_notification_dispatches` a ecrire a la
// publication (LOT 3 du plan de publication publique,
// docs/operations/PLAN_FLASH_PUBLIC_2026-09-05.md). Pure, sans base ni
// reseau : la route de publication n'a plus qu'a inserer exactement ce que
// cette fonction renvoie, avec le statut imprime par l'appelant (jamais
// decide ici -- voir le commentaire sur la route : `simulated`, jamais
// `sent`, tant que les drapeaux d'envoi sont fermes).
//
// Regle reprise telle quelle du §13 :
// - normale n'ecrit rien ;
// - push et email sont portes par groupe (une ligne par groupe choisi, la
//   resolution du groupe en personnes reelles est le travail du LOT 4 /
//   Webmail, jamais celui-ci) ;
// - sms est le seul canal porte par personne, jamais par groupe -- meme
//   contrainte que la colonne CHECK de `flash_notification_dispatches`
//   (`channel = 'sms' => contact_ref renseigne, group_ref absent`).

import { FLASH_IMPORTANCE_LEVELS, type FlashImportance } from "./flash-version-diff.js";
import type { FlashNotificationChannel } from "./flash-audience-correction.js";

export type FlashDispatchTarget =
  | { channel: "push" | "email"; groupRef: string; contactRef: null }
  | { channel: "sms"; groupRef: null; contactRef: string };

export type FlashDispatchPlanInput = {
  importance: FlashImportance;
  channels: readonly FlashNotificationChannel[];
  groupRefs: readonly string[];
  smsContactRefs: readonly string[];
};

export function resolveFlashDispatchPlan(input: FlashDispatchPlanInput): FlashDispatchTarget[] {
  if (!(FLASH_IMPORTANCE_LEVELS as readonly string[]).includes(input.importance)) {
    throw new RangeError("flash_dispatch_plan_importance_invalid");
  }

  // Une flash normale n'a jamais de canal choisi (contrainte deja verifiee en
  // amont par shared/flash-proposal-input.ts) ; le garde ici est defensif,
  // pas une seconde source de verite sur la combinaison canaux/importance.
  if (input.importance === "normale") {
    return [];
  }

  const groupRefs = [...new Set(input.groupRefs)].sort();
  const smsContactRefs = [...new Set(input.smsContactRefs)].sort();
  const targets: FlashDispatchTarget[] = [];

  for (const channel of input.channels) {
    if (channel === "push" || channel === "email") {
      for (const groupRef of groupRefs) {
        targets.push({ channel, groupRef, contactRef: null });
      }
    } else if (channel === "sms") {
      for (const contactRef of smsContactRefs) {
        targets.push({ channel, groupRef: null, contactRef });
      }
    }
  }

  return targets;
}
