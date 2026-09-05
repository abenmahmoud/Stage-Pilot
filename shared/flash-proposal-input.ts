// Entrée brute d'une proposition d'information flash (LOT 2), avant écriture
// en base.
//
// Les enums et le format des références de groupe viennent des modules purs
// déjà écrits et testés (flash-version-diff, flash-audience-correction) : ils
// ne sont pas redéfinis ici (règle commune n°5 du plan). Les bornes de
// longueur du titre et du texte reprennent les contraintes CHECK de la
// migration LOT 1 (flash_info_versions.title, .body_markdown) ; ces bornes
// sont déjà dupliquées à l'identique dans shared/flash-payload-policy.ts, qui
// vérifie la même chose côté réponse.
//
// La combinaison canaux/importance reprend exactement la contrainte CHECK de
// flash_info_versions.channels : normale = aucun canal, importante = push
// obligatoire + email facultatif, urgente = push et email obligatoires + sms
// facultatif. Ce n'est pas une règle métier nouvelle, c'est le même graphe
// que celui déjà affiché (en lecture) par FlashProposalPage.tsx.

import { FLASH_IMPORTANCE_LEVELS, type FlashImportance } from "./flash-version-diff.js";
import {
  FLASH_NOTIFICATION_CHANNELS,
  parseFlashGroupRef,
  type FlashNotificationChannel,
} from "./flash-audience-correction.js";

export class FlashProposalInputError extends Error {
  readonly reason: string;

  constructor(reason: string) {
    super("La proposition d'information flash est invalide");
    this.reason = reason;
  }
}

export type FlashProposalInput = {
  title: string;
  bodyMarkdown: string;
  importance: FlashImportance;
  channels: FlashNotificationChannel[];
  groupRefs: string[];
  expiresAt: Date;
};

const ALLOWED_FIELDS = new Set(["title", "bodyMarkdown", "importance", "channels", "groupRefs", "expiresAt"]);

const ALLOWED_CHANNELS_BY_IMPORTANCE: Readonly<Record<FlashImportance, readonly FlashNotificationChannel[]>> = {
  normale: [],
  importante: ["push", "email"],
  urgente: ["push", "email", "sms"],
};

const REQUIRED_CHANNELS_BY_IMPORTANCE: Readonly<Record<FlashImportance, readonly FlashNotificationChannel[]>> = {
  normale: [],
  importante: ["push"],
  urgente: ["push", "email"],
};

function parseChannels(value: unknown, importance: FlashImportance): FlashNotificationChannel[] {
  if (!Array.isArray(value)) throw new FlashProposalInputError("channels_invalid");
  const unique = new Set(value);
  if (unique.size !== value.length) throw new FlashProposalInputError("channels_duplicate");

  const allowed = ALLOWED_CHANNELS_BY_IMPORTANCE[importance];
  const channels = value.filter(
    (channel): channel is FlashNotificationChannel =>
      typeof channel === "string" && (FLASH_NOTIFICATION_CHANNELS as readonly string[]).includes(channel)
  );
  if (channels.length !== value.length || !channels.every((channel) => allowed.includes(channel))) {
    throw new FlashProposalInputError("channels_invalid_for_importance");
  }

  const required = REQUIRED_CHANNELS_BY_IMPORTANCE[importance];
  if (!required.every((channel) => channels.includes(channel))) {
    throw new FlashProposalInputError("channels_missing_required");
  }
  return channels;
}

function parseGroupRefs(value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new FlashProposalInputError("group_refs_invalid");
  }
  let groupRefs: string[];
  try {
    groupRefs = value.map((ref) => parseFlashGroupRef(ref));
  } catch {
    throw new FlashProposalInputError("group_refs_invalid");
  }
  if (new Set(groupRefs).size !== groupRefs.length) {
    throw new FlashProposalInputError("group_refs_duplicate");
  }
  return groupRefs;
}

export function parseFlashProposalInput(value: unknown): FlashProposalInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new FlashProposalInputError("body_invalid");
  }
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some((key) => !ALLOWED_FIELDS.has(key))) {
    throw new FlashProposalInputError("unknown_field");
  }

  if (
    typeof input.title !== "string" ||
    input.title.trim().length < 2 ||
    input.title.trim().length > 180
  ) {
    throw new FlashProposalInputError("title_invalid");
  }

  if (
    typeof input.bodyMarkdown !== "string" ||
    input.bodyMarkdown.length < 1 ||
    input.bodyMarkdown.length > 20000
  ) {
    throw new FlashProposalInputError("body_markdown_invalid");
  }

  if (!(FLASH_IMPORTANCE_LEVELS as readonly string[]).includes(input.importance as string)) {
    throw new FlashProposalInputError("importance_invalid");
  }
  const importance = input.importance as FlashImportance;

  const channels = parseChannels(input.channels, importance);
  const groupRefs = parseGroupRefs(input.groupRefs);

  if (typeof input.expiresAt !== "string" || input.expiresAt.length > 40) {
    throw new FlashProposalInputError("expires_at_invalid");
  }
  const expiresAt = new Date(input.expiresAt);
  if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
    throw new FlashProposalInputError("expires_at_invalid");
  }

  return {
    title: input.title.trim(),
    bodyMarkdown: input.bodyMarkdown,
    importance,
    channels,
    groupRefs,
    expiresAt,
  };
}
