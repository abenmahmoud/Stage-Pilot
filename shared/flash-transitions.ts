// Transitions d'etat legales d'une version d'information flash.
//
// Double filet avec la base : `flash_guard_version()`
// (supabase/migrations/20260905013000_create_flash_info_foundation.sql) refuse
// deja les memes transitions au niveau trigger. Ce module n'est pas un
// remplacement de ce garde-fou, c'est le meme graphe rejoue en TypeScript pur,
// pour pouvoir le tester sans base et le reutiliser cote agent/UI avant meme
// d'ecrire en base.
//
// LOT 1 du plan de correction visible
// (docs/operations/PLAN_FLASH_CORRECTION_VISIBLE_2026-09-05.md) ouvre
// `modifiee -> publiee` : une correction redevient publiable par le meme
// service et le meme geste que la premiere publication (meme route,
// `assertFlashValidationAccess`), au lieu de rester bloquee a l'etat terminal.
// ECART CONNU, NON CORRIGE PAR CE LOT : le trigger `flash_guard_version` cote
// base n'autorise encore que `old.status = 'publiee' and new.status =
// 'modifiee'` ; il refusera `modifiee -> publiee` tant qu'une migration ne
// l'aura pas mis a jour. Ce module et le trigger divergent donc jusqu'a cette
// migration (voir le compte rendu du lot).

export const FLASH_VERSION_STATUSES = [
  "proposee",
  "validee",
  "publiee",
  "modifiee",
  "expiree_sans_validation",
  "expiree_sans_publication",
  "refusee",
] as const;

export type FlashVersionStatus = (typeof FLASH_VERSION_STATUSES)[number];

export class FlashTransitionError extends Error {
  readonly reason: string;

  constructor(reason: string) {
    super("La transition d'etat de la version flash est refusee");
    this.reason = reason;
  }
}

/**
 * Graphe exact du trigger `flash_guard_version`. Rester une meme valeur n'est
 * pas une transition (la base l'autorise aussi, cf. `if old.status = new.status
 * then return new;`), donc ce n'est pas repris ici : `isLegalFlashVersionTransition`
 * traite ce cas a part, `assertLegalFlashVersionTransition` aussi.
 */
const LEGAL_TRANSITIONS: Readonly<Record<FlashVersionStatus, readonly FlashVersionStatus[]>> = {
  proposee: ["validee", "refusee", "expiree_sans_validation"],
  validee: ["publiee", "expiree_sans_publication"],
  publiee: ["modifiee"],
  modifiee: ["publiee"],
  expiree_sans_validation: [],
  expiree_sans_publication: [],
  refusee: [],
};

function isFlashVersionStatus(value: unknown): value is FlashVersionStatus {
  return typeof value === "string" && (FLASH_VERSION_STATUSES as readonly string[]).includes(value);
}

export function isLegalFlashVersionTransition(from: unknown, to: unknown): boolean {
  if (!isFlashVersionStatus(from) || !isFlashVersionStatus(to)) return false;
  if (from === to) return false;
  return LEGAL_TRANSITIONS[from].includes(to);
}

/**
 * Refuse toute transition illegale, y compris rester sur place (ce n'est pas
 * une transition) et tout etat inconnu. Le `reason` distingue les deux cas
 * pour que l'appelant puisse afficher un message different.
 */
export function assertLegalFlashVersionTransition(from: unknown, to: unknown): FlashVersionStatus {
  if (!isFlashVersionStatus(from)) throw new FlashTransitionError("from_status_invalid");
  if (!isFlashVersionStatus(to)) throw new FlashTransitionError("to_status_invalid");
  if (from === to) throw new FlashTransitionError("not_a_transition");
  if (!LEGAL_TRANSITIONS[from].includes(to)) throw new FlashTransitionError("transition_illegal");
  return to;
}

/** Les seuls etats depuis lesquels une nouvelle transition reste possible. */
export function isFlashVersionStatusTerminal(status: unknown): boolean {
  return isFlashVersionStatus(status) && LEGAL_TRANSITIONS[status].length === 0;
}
