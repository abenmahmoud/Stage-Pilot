const BENIGN_VALUES = new Set([
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
  "interdit",
  "interdite",
  "jamais",
  "ne",
  "oubli",
  "oublie",
  "oubliee",
  "perdu",
  "perdue",
  "recevoir",
  "reinitialiser",
]);

const DIRECT_PATTERNS = [
  ["private_key", /-----BEGIN\s+(?:(?:RSA|EC|OPENSSH)\s+)?PRIVATE KEY-----/iu],
  ["api_secret", /\bsk-[a-z0-9_-]{16,}\b/iu],
  ["api_secret", /\bgh[pousr]_[a-z0-9]{20,}\b/iu],
  ["api_secret", /\bAKIA[A-Z0-9]{16}\b/u],
  ["api_secret", /\bBearer\s+[a-z0-9._~+/=-]{16,}\b/iu],
  ["api_secret", /\beyJ[a-z0-9_-]{8,}\.[a-z0-9_-]{8,}\.[a-z0-9_-]{8,}\b/iu],
];

const LABELED_PATTERNS = [
  [
    "password_value",
    /["']?\b(?:mot[_ -]+de[_ -]+passe|mdp|password)\b["']?\s*(?:(?:[:=;,|\t])|(?:est|is))\s*["'“”]?([^\s,;|\t]{4,128})/iu,
  ],
  [
    "one_time_code",
    /["']?\b(?:code[_ -]+otp|otp|code[_ -]+de[_ -]+v[eé]rification|code[_ -]+de[_ -]+s[eé]curit[eé]|code[_ -]+re[cç]u[_ -]+(?:par[_ -]+)?sms|sms[_ -]+code)\b["']?\s*(?:(?:[:=;,|\t])|(?:est|is))?\s*([0-9]{4,8})\b/iu,
  ],
  [
    "school_access_code",
    /["']?\bcode[_ -]+(?:d['’]_?acc[eè]s[_ -]+)?(?:ent|pronote|educonnect|acad[eé]mique)\b["']?\s*(?:(?:[:=;,|\t])|(?:est|is))\s*["'“”]?([^\s,;|\t]{4,128})/iu,
  ],
  [
    "api_secret",
    /["']?\b(?:api[_ -]?key|cl[eé][_ -]+api|secret[_ -]?key|client[_ -]?secret|service[_ -]?role(?:[_ -]?key)?)\b["']?\s*(?:(?:[:=;,|\t])|(?:est|is))\s*["'“”]?([^\s,;|\t]{8,256})/iu,
  ],
];

function normalizedCandidate(value) {
  return String(value)
    .replace(/^["'“”([{]+|["'“”\])}.!?]+$/g, "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr-FR");
}

function likelySecret(value) {
  const candidate = normalizedCandidate(value);
  return candidate.length >= 4 && !BENIGN_VALUES.has(candidate);
}

export function documentSecretSignals(value) {
  const text = String(value ?? "");
  const signals = new Set();
  for (const [signal, pattern] of DIRECT_PATTERNS) {
    if (pattern.test(text)) signals.add(signal);
  }
  for (const [signal, pattern] of LABELED_PATTERNS) {
    const match = pattern.exec(text);
    if (match?.[1] && likelySecret(match[1])) signals.add(signal);
  }
  return [...signals];
}
