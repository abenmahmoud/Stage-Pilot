const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_PATTERN = /(?:(?:\+|00)33[\s.-]?(?:\(0\)[\s.-]?)?|0)[1-9](?:[\s.-]?\d{2}){4}/g;
const NAME_TOKEN = String.raw`[\p{L}][\p{L}'’-]*`;
const NAME_STOP_WORD = String.raw`(?:et|mais|car|parce|je|j['’]ai|pour|avec|qui|dont|mon|ma|mes|le|la|les)`;
const EXPLICIT_NAME_PATTERN = new RegExp(
  String.raw`\b(je m['’]appelle|mon nom est|nom\s*:|mon fils s['’]appelle|ma fille s['’]appelle)\s*(${NAME_TOKEN}(?:\s+(?!${NAME_STOP_WORD}\b)${NAME_TOKEN}){0,3})`,
  "giu"
);
const BIRTH_DATE_PATTERN = /\b(date de naissance|né(?:e)? le)\s*:?\s*\d{1,2}[/.\-]\d{1,2}[/.\-]\d{2,4}\b/gi;
const SCHOOL_ID_PATTERN = /\b(INE|identifiant élève|identifiant eleve|numéro élève|numero eleve)\s*[:=]?\s*[A-Z0-9-]{6,24}\b/gi;
const EXPLICIT_ADDRESS_PATTERN = /\b(adresse(?: postale)?\s*:)\s*[^\n]{5,140}/gi;
const SECRET_PATTERN = /\b(mot de passe|mdp|password|code secret|code de vérification|code de verification|code otp)\s*[:=]\s*\S+/gi;

export function pseudonymizeSupportText(value: string): string {
  return value
    .replace(EMAIL_PATTERN, "[EMAIL_MASQUE]")
    .replace(PHONE_PATTERN, "[TELEPHONE_MASQUE]")
    .replace(EXPLICIT_NAME_PATTERN, "$1 [NOM_MASQUE]")
    .replace(BIRTH_DATE_PATTERN, "$1 [DATE_MASQUEE]")
    .replace(SCHOOL_ID_PATTERN, "$1: [IDENTIFIANT_MASQUE]")
    .replace(EXPLICIT_ADDRESS_PATTERN, "$1 [ADRESSE_MASQUEE]")
    .replace(SECRET_PATTERN, "$1: [SECRET_MASQUE]");
}
