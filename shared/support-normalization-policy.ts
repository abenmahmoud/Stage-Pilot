import { neutralizeSupportPromptMarkers, pseudonymizeSupportText } from "./support-pseudonymizer.js";

export function normalizeSupportSummaryText(value: string): string {
  const clean = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim();
  return neutralizeSupportPromptMarkers(pseudonymizeSupportText(clean));
}

export function supportNormalizationLabels(context: Record<string, unknown>): {
  summary: string;
  language: string;
  notice: string;
} {
  const verified = context.normalizationStatus === "assistant_signe_a_verifier"
    && typeof context.normalizationReceiptHash === "string"
    && /^[a-f0-9]{64}$/.test(context.normalizationReceiptHash)
    && typeof context.normalizationSourceAt === "string"
    && Number.isFinite(Date.parse(context.normalizationSourceAt));
  return verified ? {
    summary: "Résumé de l’assistant en français",
    language: "Langue détectée par l’assistant",
    notice: "Origine vérifiée. À comparer aux messages originaux avant toute décision.",
  } : {
    summary: "Résumé transmis en français",
    language: "Langue indiquée, à confirmer",
    notice: "Origine non vérifiée. Fiez-vous aux messages originaux, pas à ce résumé seul.",
  };
}
