import { containsForbiddenSupportSecret } from "./support-secret-policy.js";

export type CommunicationInboundClassification =
  | "withdrawal"
  | "contact_correction"
  | "question"
  | "free_reply";

export type CommunicationInboundClassificationResult = {
  classification: CommunicationInboundClassification;
  confidence: "high" | "medium" | "low";
  proposedAction:
    | "confirm_withdrawal"
    | "review_contact_correction"
    | "answer_question"
    | "review_reply"
    | "secure_manual_review";
  signalCodes: string[];
  sensitive: boolean;
  requiresHumanReview: true;
};

const FIELDS = new Set(["subject", "bodyText"]);

const WITHDRAWAL_NEGATIONS = [
  /\b(?:ne|n['’])\s*(?:me\s+)?(?:retirez|retirer|desabonnez|desabonner)\s+pas\b/u,
  /\bje\s+ne\s+(?:veux|souhaite)\s+pas\s+(?:etre\s+)?(?:retire|desabonne)\b/u,
  /\bdo\s+not\s+(?:remove|unsubscribe)\b/u,
  /\bno\s+(?:quiero\s+)?(?:eliminar|dar\s+de\s+baja)\b/u,
];

const WITHDRAWAL_SIGNALS: Array<{ code: string; pattern: RegExp }> = [
  {
    code: "withdrawal_fr_explicit",
    pattern: /\b(?:retirez|retirer|supprimez|supprimer)[\s-]+(?:moi|mon\s+(?:adresse|email|courriel)|cette\s+adresse)\s+(?:de|des)\s+(?:la\s+)?liste/u,
  },
  {
    code: "withdrawal_fr_stop",
    pattern: /\b(?:je\s+)?ne\s+(?:veux|souhaite)\s+plus\s+recevoir\s+(?:vos|ces|les|d['’])?\s*(?:messages|emails|courriels|informations)/u,
  },
  { code: "withdrawal_fr_unsubscribe", pattern: /\b(?:desabonnez|desabonner|desinscrire|desinscrivez)\b/u },
  { code: "withdrawal_en", pattern: /\b(?:unsubscribe\s+me|remove\s+me\s+from\s+(?:the\s+)?(?:list|mailing))\b/u },
  { code: "withdrawal_es", pattern: /\b(?:darme\s+de\s+baja|eliminar\s+mi\s+correo\s+de\s+la\s+lista)\b/u },
  { code: "withdrawal_ar", pattern: /(?:إلغاء\s+الاشتراك|احذف\s+بريدي)/u },
];

const CONTACT_CORRECTION_SIGNALS: Array<{ code: string; pattern: RegExp }> = [
  {
    code: "contact_correction_fr_change",
    pattern: /\b(?:mon|notre)\s+(?:adresse(?:\s+email)?|email|courriel|numero)\s+(?:a\s+change|est\s+(?:errone|erronee|incorrect|incorrecte))/u,
  },
  {
    code: "contact_correction_fr_action",
    pattern: /\b(?:corrigez|corriger|remplacez|remplacer|mettez\s+a\s+jour|mettre\s+a\s+jour)\s+(?:mon|notre|l['’])?\s*(?:adresse|email|courriel|numero)/u,
  },
  { code: "contact_correction_en", pattern: /\b(?:my\s+(?:email|address|phone)\s+(?:has\s+changed|is\s+wrong)|change\s+my\s+(?:email|address|phone))\b/u },
  { code: "contact_correction_es", pattern: /\b(?:mi\s+correo\s+ha\s+cambiado|cambiar\s+mi\s+correo)\b/u },
  { code: "contact_correction_ar", pattern: /(?:تغير\s+بريدي|صحح\s+بريدي)/u },
];

const QUESTION_PATTERN = /(?:\?|؟)|\b(?:comment|pourquoi|quand|ou|qui|que|quel|quelle|peut-on|pouvez-vous|est-ce|how|why|when|where|who|can\s+you|could\s+you|como|por\s+que|cuando|donde)\b/u;

function boundedText(value: unknown, field: string, maximum: number): string {
  if (typeof value !== "string") throw new Error(`${field}_invalid`);
  const normalized = value.replace(/\r\n?/g, "\n").trim();
  if (normalized.length > maximum) throw new Error(`${field}_invalid`);
  return normalized;
}

function normalizedForSignals(value: string): string {
  return value
    .toLocaleLowerCase("fr-FR")
    .normalize("NFC")
    .replace(/[àáâäãå]/g, "a")
    .replace(/[ç]/g, "c")
    .replace(/[èéêë]/g, "e")
    .replace(/[ìíîï]/g, "i")
    .replace(/[òóôöõ]/g, "o")
    .replace(/[ùúûü]/g, "u")
    .replace(/[ýÿ]/g, "y")
    .replace(/\s+/g, " ")
    .trim();
}

function matchingCodes(
  text: string,
  signals: Array<{ code: string; pattern: RegExp }>
): string[] {
  return signals.filter(({ pattern }) => pattern.test(text)).map(({ code }) => code);
}

export function classifyCommunicationInbound(value: unknown): CommunicationInboundClassificationResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("input_invalid");
  }
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some((key) => !FIELDS.has(key))) throw new Error("unknown_field");
  const subject = boundedText(input.subject ?? "", "subject", 500);
  const bodyText = boundedText(input.bodyText, "body", 20_000);
  if (bodyText.length < 1) throw new Error("body_invalid");

  const original = `${subject}\n${bodyText}`;
  const text = normalizedForSignals(original);
  const sensitive = containsForbiddenSupportSecret(original);
  const withdrawalNegated = WITHDRAWAL_NEGATIONS.some((pattern) => pattern.test(text));
  const withdrawalCodes = withdrawalNegated ? [] : matchingCodes(text, WITHDRAWAL_SIGNALS);
  const correctionCodes = matchingCodes(text, CONTACT_CORRECTION_SIGNALS);

  let classification: CommunicationInboundClassification = "free_reply";
  let confidence: CommunicationInboundClassificationResult["confidence"] = "low";
  let proposedAction: CommunicationInboundClassificationResult["proposedAction"] = "review_reply";
  let signalCodes: string[] = withdrawalNegated ? ["withdrawal_negated"] : [];

  if (withdrawalCodes.length > 0) {
    classification = "withdrawal";
    confidence = "high";
    proposedAction = "confirm_withdrawal";
    signalCodes = withdrawalCodes;
  } else if (correctionCodes.length > 0) {
    classification = "contact_correction";
    confidence = "high";
    proposedAction = "review_contact_correction";
    signalCodes = correctionCodes;
  } else if (QUESTION_PATTERN.test(text)) {
    classification = "question";
    confidence = "medium";
    proposedAction = "answer_question";
    signalCodes = ["question_marker"];
  }

  if (sensitive) {
    proposedAction = "secure_manual_review";
    signalCodes = [...new Set([...signalCodes, "sensitive_content_detected"])];
  }

  return {
    classification,
    confidence,
    proposedAction,
    signalCodes,
    sensitive,
    requiresHumanReview: true,
  };
}
