// Contrats stricts de tout ce que le navigateur reçoit pour les écrans flash.
//
// Ce module ne décide rien : il vérifie qu'une réponse serveur a exactement
// la forme attendue, avant qu'elle ne parte. Les ensembles de valeurs permises
// viennent des modules purs déjà écrits et testés (flash-transitions,
// flash-version-diff, flash-audience-correction) — aucune règle métier n'est
// recopiée ici (règle commune n°5 du plan).
//
// Booléens stricts : jamais `null` là où un booléen est attendu. Champs
// inconnus refusés : `hasExactFields` rejette toute clé qui ne fait pas
// partie du contrat, même une clé de debug ajoutée par erreur côté serveur.

import { FLASH_VERSION_STATUSES, type FlashVersionStatus } from "./flash-transitions.js";
import { FLASH_IMPORTANCE_LEVELS, type FlashImportance } from "./flash-version-diff.js";
import { FLASH_NOTIFICATION_CHANNELS, type FlashNotificationChannel } from "./flash-audience-correction.js";

const FLASH_EXPIRATION_REASONS = [
  "still_pending",
  "expired_without_validation",
  "not_applicable",
] as const;
type FlashExpirationReason = (typeof FLASH_EXPIRATION_REASONS)[number];

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const FLASH_VERSION_PAYLOAD_FIELDS = new Set([
  "id",
  "flashInfoId",
  "version",
  "status",
  "title",
  "bodyMarkdown",
  "importance",
  "channels",
  "expiresAt",
  "proposedBy",
  "validatedBy",
  "validatedAt",
  "publishedAt",
  "createdAt",
  "updatedAt",
]);

const FLASH_VALIDATION_ACCESS_PAYLOAD_FIELDS = new Set([
  "allowed",
  "selfValidated",
  "grantedByService",
  "reason",
]);

const FLASH_AUDIENCE_TREATMENT_PAYLOAD_FIELDS = new Set([
  "maintained",
  "removed",
  "added",
  "eligibleChannels",
  "correctionPossible",
]);

const FLASH_EXPIRATION_CHECK_PAYLOAD_FIELDS = new Set(["isExpiredWithoutValidation", "reason"]);

export type FlashInfoVersionPayload = {
  id: string;
  flashInfoId: string;
  version: number;
  status: FlashVersionStatus;
  title: string;
  bodyMarkdown: string;
  importance: FlashImportance;
  channels: FlashNotificationChannel[];
  expiresAt: string;
  proposedBy: string;
  validatedBy: string | null;
  validatedAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FlashValidationAccessPayload = {
  allowed: boolean;
  selfValidated: boolean;
  grantedByService: string | null;
  reason: string | null;
};

export type FlashAudienceTreatmentPayload = {
  maintained: string[];
  removed: string[];
  added: string[];
  eligibleChannels: FlashNotificationChannel[];
  correctionPossible: boolean;
};

export type FlashExpirationCheckPayload = {
  isExpiredWithoutValidation: boolean;
  reason: FlashExpirationReason;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactFields(value: Record<string, unknown>, fields: Set<string>): boolean {
  const keys = Object.keys(value);
  return keys.length === fields.size && keys.every((key) => fields.has(key));
}

function isKnownValue<T extends readonly string[]>(value: unknown, allowed: T): value is T[number] {
  return typeof value === "string" && allowed.includes(value as T[number]);
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function isNullableUuid(value: unknown): value is string | null {
  return value === null || isUuid(value);
}

function isBoundedText(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maxLength;
}

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && value.length <= 40 && Number.isFinite(Date.parse(value));
}

function isNullableIsoDate(value: unknown): value is string | null {
  return value === null || isIsoDate(value);
}

function isUniqueStringArray(value: unknown): value is string[] {
  return Array.isArray(value)
    && value.every((item) => typeof item === "string")
    && new Set(value).size === value.length;
}

function isChannelList(value: unknown): value is FlashNotificationChannel[] {
  return isUniqueStringArray(value)
    && value.every((channel) => isKnownValue(channel, FLASH_NOTIFICATION_CHANNELS));
}

function isGroupRefList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string" && item.length > 0);
}

export function isValidFlashInfoVersionPayload(value: unknown): value is FlashInfoVersionPayload {
  if (!isRecord(value) || !hasExactFields(value, FLASH_VERSION_PAYLOAD_FIELDS)) return false;
  return isUuid(value.id)
    && isUuid(value.flashInfoId)
    && Number.isInteger(value.version) && (value.version as number) >= 1
    && isKnownValue(value.status, FLASH_VERSION_STATUSES)
    && isBoundedText(value.title, 180)
    && isBoundedText(value.bodyMarkdown, 20000)
    && isKnownValue(value.importance, FLASH_IMPORTANCE_LEVELS)
    && isChannelList(value.channels)
    && isIsoDate(value.expiresAt)
    && isUuid(value.proposedBy)
    && isNullableUuid(value.validatedBy)
    && isNullableIsoDate(value.validatedAt)
    && isNullableIsoDate(value.publishedAt)
    && isIsoDate(value.createdAt)
    && isIsoDate(value.updatedAt);
}

/**
 * Miroir de `FlashValidationDecision` (shared/flash-validation-access.ts) :
 * `reason` est `null` si et seulement si `allowed` est vrai. C'est déjà
 * l'invariant du module de décision ; ce garde vérifie qu'il survit au
 * passage en JSON, pas qu'il existe.
 */
export function isValidFlashValidationAccessPayload(
  value: unknown
): value is FlashValidationAccessPayload {
  if (!isRecord(value) || !hasExactFields(value, FLASH_VALIDATION_ACCESS_PAYLOAD_FIELDS)) return false;
  if (typeof value.allowed !== "boolean" || typeof value.selfValidated !== "boolean") return false;
  if (value.grantedByService !== null && typeof value.grantedByService !== "string") return false;
  if (value.reason !== null && typeof value.reason !== "string") return false;
  if (value.allowed === (value.reason !== null)) return false;
  return true;
}

export function isValidFlashAudienceTreatmentPayload(
  value: unknown
): value is FlashAudienceTreatmentPayload {
  if (!isRecord(value) || !hasExactFields(value, FLASH_AUDIENCE_TREATMENT_PAYLOAD_FIELDS)) return false;
  return isGroupRefList(value.maintained)
    && isGroupRefList(value.removed)
    && isGroupRefList(value.added)
    && isChannelList(value.eligibleChannels)
    && typeof value.correctionPossible === "boolean";
}

export function isValidFlashExpirationCheckPayload(
  value: unknown
): value is FlashExpirationCheckPayload {
  if (!isRecord(value) || !hasExactFields(value, FLASH_EXPIRATION_CHECK_PAYLOAD_FIELDS)) return false;
  return typeof value.isExpiredWithoutValidation === "boolean"
    && isKnownValue(value.reason, FLASH_EXPIRATION_REASONS);
}
