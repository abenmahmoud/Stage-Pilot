export type ForbiddenSupportSecretKind =
  | "password"
  | "one_time_code"
  | "school_access_code"
  | "api_secret"
  | "private_key";

export const FORBIDDEN_SUPPORT_SECRET_MESSAGE =
  "Pour votre sécurité, retirez tout mot de passe, code reçu par SMS, code ENT/PRONOTE ou clé secrète, puis renvoyez votre message. Le lycée n’en a jamais besoin pour traiter votre demande.";

const BENIGN_CANDIDATES = new Set([
  "absent",
  "aucun",
  "bloque",
  "bloquee",
  "demander",
  "expire",
  "expiree",
  "inconnu",
  "inconnue",
  "incorrect",
  "incorrecte",
  "indisponible",
  "oubli",
  "oublie",
  "oubliee",
  "perdu",
  "perdue",
  "recevoir",
  "reinitialiser",
]);

const DIRECT_SECRET_PATTERNS: ReadonlyArray<{
  kind: ForbiddenSupportSecretKind;
  pattern: RegExp;
}> = [
  {
    kind: "private_key",
    pattern: /-----BEGIN\s+(?:(?:RSA|EC|OPENSSH)\s+)?PRIVATE KEY-----/iu,
  },
  {
    kind: "api_secret",
    pattern: /\bsk-[a-z0-9_-]{16,}\b/iu,
  },
  {
    kind: "api_secret",
    pattern: /\bgh[pousr]_[a-z0-9]{20,}\b/iu,
  },
  {
    kind: "api_secret",
    pattern: /\bAKIA[A-Z0-9]{16}\b/u,
  },
  {
    kind: "api_secret",
    pattern: /\bBearer\s+[a-z0-9._~+/=-]{16,}\b/iu,
  },
  {
    kind: "api_secret",
    pattern: /\beyJ[a-z0-9_-]{8,}\.[a-z0-9_-]{8,}\.[a-z0-9_-]{8,}\b/iu,
  },
];

const LABELED_SECRET_PATTERNS: ReadonlyArray<{
  kind: ForbiddenSupportSecretKind;
  pattern: RegExp;
}> = [
  {
    kind: "password",
    pattern:
      /\b(?:mon\s+)?(?:mot\s+de\s+passe|mdp|password)\s*(?:(?::|=)|(?:est|is|c['’]est))\s*["'“”]?([^\s,;]{4,128})/iu,
  },
  {
    kind: "one_time_code",
    pattern:
      /\b(?:code\s+otp|otp|code\s+de\s+v[eé]rification|code\s+de\s+s[eé]curit[eé]|code\s+re[cç]u\s+(?:par\s+)?sms|sms\s+code)\s*(?:(?::|=)|(?:est|is))?\s*([0-9]{4,8})\b/iu,
  },
  {
    kind: "school_access_code",
    pattern:
      /\b(?:mon\s+)?code\s+(?:d['’]acc[eè]s\s+)?(?:ent|pronote|educonnect|acad[eé]mique)\s*(?:(?::|=)|(?:est|is))\s*["'“”]?([^\s,;]{4,128})/iu,
  },
  {
    kind: "school_access_code",
    pattern:
      /\b(?:mon\s+)?code\s+(?:d['’]acc[eè]s\s+)?(?:ent|pronote|educonnect|acad[eé]mique)\s+([a-z0-9._-]*\d[a-z0-9._-]{3,63})\b/iu,
  },
  {
    kind: "api_secret",
    pattern:
      /\b(?:api[_ -]?key|cl[eé]\s+api|secret[_ -]?key|client[_ -]?secret|service[_ -]?role(?:[_ -]?key)?)\s*(?:(?::|=)|(?:est|is))\s*["'“”]?([^\s,;]{8,256})/iu,
  },
];

function normalizeCandidate(value: string): string {
  return value
    .replace(/^["'“”([{]+|["'“”\])}.!?]+$/g, "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr-FR");
}

function isLikelySecretCandidate(value: string): boolean {
  const candidate = normalizeCandidate(value);
  return candidate.length >= 4 && !BENIGN_CANDIDATES.has(candidate);
}

export function detectForbiddenSupportSecret(
  value: string
): ForbiddenSupportSecretKind | null {
  for (const { kind, pattern } of DIRECT_SECRET_PATTERNS) {
    if (pattern.test(value)) return kind;
  }
  for (const { kind, pattern } of LABELED_SECRET_PATTERNS) {
    const match = pattern.exec(value);
    if (match?.[1] && isLikelySecretCandidate(match[1])) return kind;
  }
  return null;
}

export function containsForbiddenSupportSecret(value: string): boolean {
  return detectForbiddenSupportSecret(value) !== null;
}
