// Règle de visibilité d'une version d'information flash (LOT 1 du plan de
// visibilité publique, 5 septembre 2026), pure et testée : sans base ni
// réseau.
//
// Trois conditions cumulatives, toutes nécessaires :
//   1. la version est dans l'état `publiee`, jamais avant (proposee/validee)
//      ni après une correction — une version corrigée passe à `modifiee`
//      (flash-transitions.ts, seule transition légale depuis `publiee`) et
//      ne redevient jamais visible ;
//   2. l'horloge serveur n'a pas atteint `expiresAt`, à la seconde près :
//      `now === expiresAt` est déjà expiré, jamais visible ;
//   3. le visiteur a le droit de voir cette audience : un anonyme (aucune
//      appartenance connue) ne voit que l'audience publique ; une personne
//      identifiée voit en plus toute audience dont elle est membre.
//
// `flash_info_audiences.group_ref` (migration 20260905013000) n'a pas de
// valeur réservée pour « public » : la fondation ne l'impose ni ne
// l'interdit. Ce module introduit `FLASH_PUBLIC_AUDIENCE_GROUP_REF` comme la
// seule valeur qui ouvre l'affichage sur le site anonyme, au même format que
// tout autre `group_ref` (voir flash-audience-correction.ts). C'est une
// décision prise ici pour ce lot, pas une règle déjà actée ailleurs : à
// confirmer avec Adel avant le LOT 2 (route publique), qui en dépend.

import { FLASH_VERSION_STATUSES, type FlashVersionStatus } from "./flash-transitions.js";
import { parseFlashGroupRef } from "./flash-audience-correction.js";

/** Seule valeur de `group_ref` qui rend une audience visible à un anonyme. */
export const FLASH_PUBLIC_AUDIENCE_GROUP_REF = "public:site";

export class FlashVisibilityError extends Error {
  readonly reason: string;

  constructor(reason: string) {
    super("La visibilité de la version flash est invalide");
    this.reason = reason;
  }
}

export type FlashVisibilityReason =
  | "visible"
  | "not_published"
  | "expired"
  | "audience_not_authorized";

export type FlashVisibilityCheck = {
  isVisible: boolean;
  reason: FlashVisibilityReason;
};

export type FlashVisibilityInput = {
  status: unknown;
  expiresAt: unknown;
  now: unknown;
  /** `group_ref` de la version, au moins un élément (flash-proposal-input.ts). */
  audience: unknown;
  /**
   * Groupes d'appartenance du visiteur identifié, ou `null` pour un visiteur
   * anonyme. `null` n'est jamais croisé avec l'audience : seule l'audience
   * publique compte alors.
   */
  viewerGroupRefs: unknown;
};

function parseStatus(value: unknown): FlashVersionStatus {
  if (typeof value !== "string" || !(FLASH_VERSION_STATUSES as readonly string[]).includes(value)) {
    throw new FlashVisibilityError("status_invalid");
  }
  return value as FlashVersionStatus;
}

function parseDate(value: unknown, field: string): Date {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new FlashVisibilityError(field + "_invalid");
  }
  return value;
}

function parseGroupRefArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) throw new FlashVisibilityError(field + "_invalid");
  try {
    return value.map((ref) => parseFlashGroupRef(ref));
  } catch {
    throw new FlashVisibilityError(field + "_invalid");
  }
}

function parseAudience(value: unknown): string[] {
  const audience = parseGroupRefArray(value, "audience");
  if (audience.length === 0) throw new FlashVisibilityError("audience_invalid");
  return audience;
}

function parseViewerGroupRefs(value: unknown): string[] | null {
  if (value === null) return null;
  return parseGroupRefArray(value, "viewer_group_refs");
}

/**
 * L'audience publique autorise tout le monde, y compris l'anonyme. Sinon, un
 * anonyme (`viewerGroupRefs === null`) n'est jamais autorisé ; une personne
 * identifiée l'est si elle appartient à au moins un groupe de l'audience.
 */
function isAudienceAuthorized(audience: readonly string[], viewerGroupRefs: readonly string[] | null): boolean {
  if (audience.includes(FLASH_PUBLIC_AUDIENCE_GROUP_REF)) return true;
  if (viewerGroupRefs === null) return false;
  const viewerGroups = new Set(viewerGroupRefs);
  return audience.some((ref) => viewerGroups.has(ref));
}

export function checkFlashVersionVisibility(input: FlashVisibilityInput): FlashVisibilityCheck {
  const status = parseStatus(input.status);
  const expiresAt = parseDate(input.expiresAt, "expires_at");
  const now = parseDate(input.now, "now");
  const audience = parseAudience(input.audience);
  const viewerGroupRefs = parseViewerGroupRefs(input.viewerGroupRefs);

  if (status !== "publiee") {
    return { isVisible: false, reason: "not_published" };
  }
  if (now.getTime() >= expiresAt.getTime()) {
    return { isVisible: false, reason: "expired" };
  }
  if (!isAudienceAuthorized(audience, viewerGroupRefs)) {
    return { isVisible: false, reason: "audience_not_authorized" };
  }
  return { isVisible: true, reason: "visible" };
}

export function isFlashVersionVisible(input: FlashVisibilityInput): boolean {
  return checkFlashVersionVisibility(input).isVisible;
}

export type FlashVisibilityVersionCandidate = {
  status: unknown;
  expiresAt: unknown;
  audience: unknown;
};

/**
 * Filtre une liste de versions (tous états confondus, par ex. l'historique
 * complet d'une même information flash) pour ne garder que celles réellement
 * visibles maintenant pour ce visiteur. Une version corrigée est passée à
 * `modifiee` par la transition légale (flash-transitions.ts) : elle échoue
 * donc ici en `not_published` et ne réapparaît jamais, même si son audience
 * et son expiration restent par ailleurs valides.
 */
export function selectVisibleFlashVersions<T extends FlashVisibilityVersionCandidate>(
  versions: readonly T[],
  input: { now: Date; viewerGroupRefs: string[] | null }
): T[] {
  return versions.filter((version) =>
    isFlashVersionVisible({
      status: version.status,
      expiresAt: version.expiresAt,
      audience: version.audience,
      now: input.now,
      viewerGroupRefs: input.viewerGroupRefs,
    })
  );
}

// LOT 1 du plan de correction visible
// (docs/operations/PLAN_FLASH_CORRECTION_VISIBLE_2026-09-05.md) : depuis que
// `modifiee -> publiee` est une transition legale (flash-transitions.ts), une
// meme information flash peut avoir plusieurs versions dans l'historique
// passe par `publiee` (premiere publication, puis chaque republication apres
// correction). `selectVisibleFlashVersions` ci-dessus reste la seule autorite
// sur CE QUI est visible ; ce qui suit ne fait qu'empecher, en defense en
// profondeur pure, que deux versions de la MEME information se retrouvent
// visibles en meme temps a l'affichage (doublon), en ne gardant que la plus
// recente (`version` la plus grande). La persistance ne doit jamais laisser
// deux versions `publiee` simultanees pour une meme information — ce module
// ne le suppose pas, il s'en protege quand meme.
export type FlashVisibilityFlashCandidate = FlashVisibilityVersionCandidate & {
  flashInfoId: string;
  version: number;
};

export function selectLatestVisibleFlashVersionPerInfo<T extends FlashVisibilityFlashCandidate>(
  versions: readonly T[],
  input: { now: Date; viewerGroupRefs: string[] | null }
): T[] {
  const visible = selectVisibleFlashVersions(versions, input);
  const latestByFlashInfoId = new Map<string, T>();
  for (const version of visible) {
    const current = latestByFlashInfoId.get(version.flashInfoId);
    if (!current || version.version > current.version) {
      latestByFlashInfoId.set(version.flashInfoId, version);
    }
  }
  return [...latestByFlashInfoId.values()];
}
