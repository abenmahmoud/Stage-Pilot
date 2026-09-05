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
  type FlashInfoVersionPayload,
  type FlashValidationAccessPayload,
} from "../../shared/flash-payload-policy.js";
import type { FlashValidationDecision } from "../../shared/flash-validation-access.js";
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
