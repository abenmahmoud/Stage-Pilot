// Construit la charge renvoyée au navigateur pour une version d'information
// flash, et la fait passer par `isValidFlashInfoVersionPayload`
// (shared/flash-payload-policy.ts, LOT 1) avant de la laisser partir. Aucune
// route flash ne doit répondre une version sans passer par cette fonction.

import type { FlashVersionStatus } from "../../shared/flash-transitions.js";
import type { FlashImportance } from "../../shared/flash-version-diff.js";
import type { FlashNotificationChannel } from "../../shared/flash-audience-correction.js";
import {
  isValidFlashInfoVersionPayload,
  isValidFlashValidationAccessPayload,
  isValidFlashValidationScreenAccessPayload,
  isValidFlashAudienceTreatmentPayload,
  isValidFlashAudiencePayload,
  isValidFlashAuthorNamePayload,
  isValidFlashPublicItemPayload,
  type FlashInfoVersionPayload,
  type FlashValidationAccessPayload,
  type FlashValidationScreenAccessPayload,
  type FlashAudienceTreatmentPayload,
  type FlashPublicItemPayload,
} from "../../shared/flash-payload-policy.js";
import type { FlashValidationDecision } from "../../shared/flash-validation-access.js";
import type { FlashAudienceTreatment } from "../../shared/flash-audience-correction.js";
import { HttpError } from "./auth.js";

export type FlashVersionRow = {
  id: string;
  flashInfoId: string;
  version: number;
  status: string;
  title: string;
  bodyMarkdown: string;
  importance: string;
  channels: unknown;
  expiresAt: Date;
  proposedBy: string;
  validatedBy: string | null;
  validatedAt: Date | null;
  publishedAt: Date | null;
  publishedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export function toFlashVersionPayload(row: FlashVersionRow): FlashInfoVersionPayload {
  const payload = {
    id: row.id,
    flashInfoId: row.flashInfoId,
    version: row.version,
    status: row.status as FlashVersionStatus,
    title: row.title,
    bodyMarkdown: row.bodyMarkdown,
    importance: row.importance as FlashImportance,
    channels: row.channels as FlashNotificationChannel[],
    expiresAt: row.expiresAt.toISOString(),
    proposedBy: row.proposedBy,
    validatedBy: row.validatedBy,
    validatedAt: row.validatedAt ? row.validatedAt.toISOString() : null,
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    publishedBy: row.publishedBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
  if (!isValidFlashInfoVersionPayload(payload)) {
    throw new HttpError(500, "La version de l'information flash ne respecte pas le contrat de réponse.");
  }
  return payload;
}

export function toFlashValidationAccessPayload(
  decision: FlashValidationDecision
): FlashValidationAccessPayload {
  const payload = {
    allowed: decision.allowed,
    selfValidated: decision.selfValidated,
    grantedByService: decision.grantedByService,
    reason: decision.reason,
  };
  if (!isValidFlashValidationAccessPayload(payload)) {
    throw new HttpError(500, "L'autorisation de validation flash ne respecte pas le contrat de réponse.");
  }
  return payload;
}

/**
 * LOT 5 (T071E) : ce que reçoit la porte de l'écran de validation elle-même
 * (`GET /api/flash/validation/screen-access`), avant même de charger une
 * file. `grantedByService` vient de `grantedFlashValidationService`, jamais
 * du rôle applicatif ni des `serviceCodes` bruts — l'écran n'a besoin que de
 * savoir s'il doit s'afficher, pas de recalculer la règle lui-même.
 */
export function toFlashValidationScreenAccessPayload(
  grantedByService: string | null
): FlashValidationScreenAccessPayload {
  const payload = { allowed: grantedByService !== null, grantedByService };
  if (!isValidFlashValidationScreenAccessPayload(payload)) {
    throw new HttpError(500, "L'autorisation d'accès à l'écran de validation flash ne respecte pas le contrat de réponse.");
  }
  return payload;
}

/**
 * LOT 4 : les trois ensembles (maintenus/retirés/ajoutés) et l'éligibilité des
 * canaux d'une correction, calculés par `resolveFlashAudienceTreatment`
 * (shared/flash-audience-correction.ts, §13). Même garde qu'ailleurs dans ce
 * fichier : la route ne répond jamais ce résultat sans repasser par le
 * contrat strict de LOT 1.
 */
export function toFlashAudienceTreatmentPayload(
  treatment: FlashAudienceTreatment
): FlashAudienceTreatmentPayload {
  const payload = {
    maintained: treatment.maintained,
    removed: treatment.removed,
    added: treatment.added,
    eligibleChannels: treatment.eligibleChannels,
    correctionPossible: treatment.correctionPossible,
  };
  if (!isValidFlashAudienceTreatmentPayload(payload)) {
    throw new HttpError(500, "Le traitement d'audience de correction flash ne respecte pas le contrat de réponse.");
  }
  return payload;
}

/**
 * LOT 3 du plan de publication : audience (group_ref) d'une version publiée,
 * pour préremplir l'écran de correction avec le public RÉEL de la version en
 * cours plutôt que de le lui faire ressaisir.
 */
export function toFlashAudiencePayload(groupRefs: string[]): string[] {
  const payload = [...new Set(groupRefs)].sort();
  if (!isValidFlashAudiencePayload(payload)) {
    throw new HttpError(500, "L'audience de l'information flash ne respecte pas le contrat de réponse.");
  }
  return payload;
}

/**
 * LOT 3 du plan de publication : nom d'affichage de l'auteur, résolu par
 * `api/_shared/flash-author.ts`. `null` si non résolu (jamais deviné).
 */
export function toFlashAuthorNamePayload(name: string | null): string | null {
  if (!isValidFlashAuthorNamePayload(name)) {
    throw new HttpError(500, "Le nom de l'auteur de l'information flash ne respecte pas le contrat de réponse.");
  }
  return name;
}

export type FlashPublicItemRow = {
  id: string;
  title: string;
  bodyMarkdown: string;
  importance: string;
  publishedAt: Date;
  expiresAt: Date;
};

/**
 * LOT 2 du plan de publication publique : charge renvoyée par
 * `api/content/flash/public.ts`. Ne reçoit jamais `flashInfoId`, `proposedBy`,
 * `validatedBy`/`publishedBy` ni l'audience brute — voir le commentaire de
 * `FLASH_PUBLIC_ITEM_PAYLOAD_FIELDS` (shared/flash-payload-policy.ts).
 */
export function toPublicFlashItemPayload(row: FlashPublicItemRow): FlashPublicItemPayload {
  const payload = {
    id: row.id,
    title: row.title,
    bodyMarkdown: row.bodyMarkdown,
    importance: row.importance as FlashImportance,
    publishedAt: row.publishedAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
  };
  if (!isValidFlashPublicItemPayload(payload)) {
    throw new HttpError(500, "L'information flash publique ne respecte pas le contrat de réponse.");
  }
  return payload;
}
