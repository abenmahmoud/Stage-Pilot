export const SUPPORT_IDENTITY_VERIFICATION_MESSAGE =
  "Bonjour, pour protéger vos accès, nous devons d’abord confirmer votre identité avec une source officielle du lycée. Ne transmettez aucun mot de passe ni aucun code reçu par SMS. Nous revenons vers vous dès que la vérification est terminée.";

const NON_TRANSLATED_LANGUAGES = new Set([
  "francais",
  "français",
  "french",
  "indeterminee",
  "indéterminée",
  "indetermine",
  "indéterminé",
]);

export function supportTranslationTargetLanguage(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const language = value.trim().replace(/\s+/g, " ");
  if (language.length < 2 || language.length > 60) return null;
  if (!/^[\p{L}\p{M}'’ -]+$/u.test(language)) return null;
  return NON_TRANSLATED_LANGUAGES.has(language.toLocaleLowerCase("fr-FR"))
    ? null
    : language;
}

export function normalizeSupportReplyText(value: unknown, maxLength = 10_000): string | null {
  if (typeof value !== "string") return null;
  const text = value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .trim();
  return text && text.length <= maxLength ? text : null;
}
