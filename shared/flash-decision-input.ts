// Entrée brute d'une décision de validation (LOT 3) : valider, refuser, ou
// modifier-puis-valider.
//
// La base n'a que deux statuts atteignables depuis `proposee` par une
// décision humaine : `validee` et `refusee` (voir `flash-transitions.ts` et le
// trigger `flash_guard_version`). « Modifier » n'est donc pas un troisième
// statut : c'est une validation accompagnée d'un contenu édité. La présence de
// `content` distingue les deux cas ; son contenu est validé par
// `parseFlashProposalInput` (LOT 2), jamais redéfini ici (règle commune n°5).

import {
  parseFlashProposalInput,
  FlashProposalInputError,
  type FlashProposalInput,
} from "./flash-proposal-input.js";

export const FLASH_DECISION_TARGETS = ["validee", "refusee"] as const;
export type FlashDecisionTarget = (typeof FLASH_DECISION_TARGETS)[number];

export class FlashDecisionInputError extends Error {
  readonly reason: string;

  constructor(reason: string) {
    super("La décision de validation d'information flash est invalide");
    this.reason = reason;
  }
}

export type FlashDecisionInput = {
  decision: FlashDecisionTarget;
  /** Contenu édité par le valideur ; `null` = valider ou refuser tel quel. */
  content: FlashProposalInput | null;
};

const ALLOWED_FIELDS = new Set(["decision", "content"]);

export function parseFlashDecisionInput(value: unknown): FlashDecisionInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new FlashDecisionInputError("body_invalid");
  }
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some((key) => !ALLOWED_FIELDS.has(key))) {
    throw new FlashDecisionInputError("unknown_field");
  }

  if (!(FLASH_DECISION_TARGETS as readonly string[]).includes(input.decision as string)) {
    throw new FlashDecisionInputError("decision_invalid");
  }
  const decision = input.decision as FlashDecisionTarget;

  if (input.content === undefined || input.content === null) {
    return { decision, content: null };
  }

  if (decision === "refusee") {
    throw new FlashDecisionInputError("content_not_allowed_for_refusal");
  }

  let content: FlashProposalInput;
  try {
    content = parseFlashProposalInput(input.content);
  } catch (error) {
    if (error instanceof FlashProposalInputError) {
      throw new FlashDecisionInputError("content_" + error.reason);
    }
    throw error;
  }
  return { decision, content };
}
