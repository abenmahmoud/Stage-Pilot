// Trois ensembles (maintenus / retires / ajoutes) et eligibilite des canaux
// pour une correction d'information flash, a partir de §13.
//
// Regle centrale, documentee aussi sur la colonne
// `flash_notification_dispatches.status` (migration LOT 1) : c'est la trace de
// ce qui a REELLEMENT notifie (status = 'sent'), jamais l'importance
// declaree, qui decide si une correction peut reutiliser un canal. Consequence
// directe : si rien n'a jamais notifie personne pour la version precedente
// (le cas normal d'une flash « normale », qui n'a aucun canal), il n'existe
// rien a corriger — soit la nouvelle version ne notifie pas non plus (rien a
// proposer), soit elle notifie pour la premiere fois et tout le monde recoit
// une information NEUVE, jamais une correction (§13 : « un passage de normale
// a importante ou urgente place tout le public dans les ajoutes »).

import { FLASH_IMPORTANCE_LEVELS, type FlashImportance } from "./flash-version-diff.js";

export const FLASH_NOTIFICATION_CHANNELS = ["push", "email", "sms"] as const;
export type FlashNotificationChannel = (typeof FLASH_NOTIFICATION_CHANNELS)[number];

export class FlashAudienceError extends Error {
  readonly reason: string;

  constructor(reason: string) {
    super("L'audience ou le canal d'information flash est invalide");
    this.reason = reason;
  }
}

// Meme motif que `flash_info_audiences.group_ref` (migration LOT 1) : pas de
// '@', longueur et alphabet identiques, pour rester le meme filtre des deux
// cotes.
const GROUP_REF_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9:_-]{2,79}$/;

export function parseFlashGroupRef(value: unknown): string {
  if (typeof value !== "string" || !GROUP_REF_PATTERN.test(value) || value.includes("@")) {
    throw new FlashAudienceError("group_ref_invalid");
  }
  return value;
}

function parseGroupRefList(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) throw new FlashAudienceError(field + "_invalid");
  try {
    return value.map(parseFlashGroupRef);
  } catch {
    throw new FlashAudienceError(field + "_invalid");
  }
}

function parseChannelList(value: unknown): FlashNotificationChannel[] {
  if (!Array.isArray(value)) throw new FlashAudienceError("previous_notified_channels_invalid");
  for (const channel of value) {
    if (!(FLASH_NOTIFICATION_CHANNELS as readonly string[]).includes(channel as string)) {
      throw new FlashAudienceError("previous_notified_channels_invalid");
    }
  }
  return [...new Set(value as FlashNotificationChannel[])].sort();
}

export type FlashAudienceTreatment = {
  maintained: string[];
  removed: string[];
  added: string[];
  /** Canaux ayant reellement notifie la version precedente, dedupliques et tries. */
  eligibleChannels: FlashNotificationChannel[];
  /**
   * Vrai seulement quand une correction (reutilisant un canal deja notifie)
   * est possible. Faux dans les deux cas ou aucune correction n'a de sens :
   * rien a corriger (nouvelle version « normale ») ou premiere notification
   * reelle (montee en importance depuis une version jamais notifiee).
   */
  correctionPossible: boolean;
};

/**
 * `previousNotifiedChannels` vient de `flash_notification_dispatches` filtre
 * sur `status = 'sent'` pour la version PRECEDENTE, jamais sur son importance
 * declaree. `nextImportance` est l'importance de la nouvelle version : une
 * version normale ne notifie jamais (contrainte SQL `channels`), donc si elle
 * reste normale, rien n'est propose.
 */
export function resolveFlashAudienceTreatment(input: {
  previousAudience: unknown;
  nextAudience: unknown;
  previousNotifiedChannels: unknown;
  nextImportance: unknown;
}): FlashAudienceTreatment {
  const previousList = parseGroupRefList(input.previousAudience, "previous_audience");
  const nextList = parseGroupRefList(input.nextAudience, "next_audience");
  const previousNotifiedChannels = parseChannelList(input.previousNotifiedChannels);
  if (!(FLASH_IMPORTANCE_LEVELS as readonly string[]).includes(input.nextImportance as string)) {
    throw new FlashAudienceError("next_importance_invalid");
  }
  const nextImportance = input.nextImportance as FlashImportance;

  const previousSet = new Set(previousList);
  const nextSet = new Set(nextList);

  const nextWillNotify = nextImportance !== "normale";
  if (!nextWillNotify) {
    // La nouvelle version reste normale : seul le site change, aucun message
    // de correction n'est propose (§13).
    return { maintained: [], removed: [], added: [], eligibleChannels: [], correctionPossible: false };
  }

  if (previousNotifiedChannels.length === 0) {
    // Personne n'a ete reellement prevenu avant (ex. normale -> urgente) :
    // ce n'est pas une correction, c'est la premiere notification reelle.
    return {
      maintained: [],
      removed: [],
      added: [...nextSet].sort(),
      eligibleChannels: [],
      correctionPossible: false,
    };
  }

  const maintained = [...previousSet].filter((ref) => nextSet.has(ref)).sort();
  const removed = [...previousSet].filter((ref) => !nextSet.has(ref)).sort();
  const added = [...nextSet].filter((ref) => !previousSet.has(ref)).sort();

  return {
    maintained,
    removed,
    added,
    eligibleChannels: previousNotifiedChannels,
    correctionPossible: true,
  };
}
