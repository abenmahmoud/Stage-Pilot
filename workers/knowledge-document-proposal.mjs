const MAX_SENTENCE_CHARS = 320;
const MAX_OVERVIEW_CHARS = 640;
const MAX_ITEMS = 6;

const INJECTION_PATTERNS = [
  ["reserved_prompt_marker", /<\/?(?:system|developer|assistant|tool|instructions|registre_autorise_valide)\b[^>]*>/iu],
  ["instruction_override", /\b(?:ignore|oublie|contourne|remplace)\s+(?:toutes?\s+)?(?:les?\s+)?(?:instructions?|r[eè]gles?|consignes?)\b/iu],
  ["system_prompt_request", /\b(?:system prompt|prompt syst[eè]me|message d[eé]veloppeur|developer message)\b/iu],
  ["role_impersonation", /\b(?:tu es maintenant|you are now|agis comme)\s+(?:un |une )?(?:administrateur|syst[eè]me|agent sans limite)/iu],
];

const RULE_PATTERN = /\b(?:doit|doivent|devra|devront|obligatoire|requis|requise|n[eé]cessaire|il faut)\b/iu;
const PROHIBITION_PATTERN = /\b(?:interdit|interdite|jamais|ne doit pas|ne doivent pas|sans autorisation|aucun acc[eè]s)\b/iu;
const AMBIGUITY_PATTERN = /\b(?:[àa] confirmer|provisoire|selon le cas|sous r[eé]serve|exception|sauf|peut varier|en principe)\b/iu;
const NEGATIVE_PATTERN = /\b(?:non|pas|jamais|interdit|interdite|aucun|aucune)\b/iu;
const DATE_PATTERN = /\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}[/.\-]\d{1,2}(?:[/.\-]\d{2,4})?|\d{1,2}\s+(?:janvier|f[eé]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[eé]cembre)(?:\s+\d{4})?)\b/iu;

function cleanText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function bounded(value, max = MAX_SENTENCE_CHARS) {
  const clean = cleanText(value);
  if (clean.length <= max) return clean;
  const slice = clean.slice(0, max - 1);
  const boundary = slice.lastIndexOf(" ");
  return `${slice.slice(0, boundary > max * 0.6 ? boundary : slice.length)}…`;
}

function sentences(value) {
  const results = [];
  const seen = new Set();
  for (const line of cleanText(value).split(/\n+/)) {
    for (const part of line.split(/(?<=[.!?;:])\s+/u)) {
      const item = bounded(part);
      const key = item.toLocaleLowerCase("fr-FR");
      if (item.length < 12 || seen.has(key)) continue;
      seen.add(key);
      results.push(item);
      if (results.length >= 160) return results;
    }
  }
  return results;
}

function normalizedConflictKey(value) {
  return cleanText(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr-FR")
    .replace(/\b(?:ne|n|pas|non|jamais|interdit|interdite|aucun|aucune|est|sont|sera|seront)\b/gu, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function potentialConflicts(items) {
  const conflicts = [];
  const indexed = items
    .map((text) => ({ text, key: normalizedConflictKey(text), negative: NEGATIVE_PATTERN.test(text) }))
    .filter((item) => item.key.length >= 16);
  for (let left = 0; left < indexed.length; left += 1) {
    for (let right = left + 1; right < indexed.length; right += 1) {
      const first = indexed[left];
      const second = indexed[right];
      if (first.negative === second.negative || first.key !== second.key) continue;
      conflicts.push({ first: first.text, second: second.text });
      if (conflicts.length >= 4) return conflicts;
    }
  }
  return conflicts;
}

export function documentInstructionSignals(value) {
  const text = String(value ?? "");
  return INJECTION_PATTERNS.flatMap(([signal, pattern]) => (pattern.test(text) ? [signal] : []));
}

export function buildKnowledgeReviewProposal(value) {
  const instructionSignals = documentInstructionSignals(value);
  if (instructionSignals.length > 0) {
    return {
      schemaVersion: 1,
      overview: "Le document contient une consigne susceptible de viser le fonctionnement de l’agent.",
      keyPoints: [],
      rules: [],
      prohibitions: [],
      datedStatements: [],
      conflicts: [],
      questions: [
        "Cette consigne appartient-elle réellement à une procédure validée du lycée ?",
        "Faut-il retirer ou reformuler le passage avant de créer une source ?",
      ],
      instructionSignals,
    };
  }

  const items = sentences(value);
  const prohibitions = items.filter((item) => PROHIBITION_PATTERN.test(item)).slice(0, MAX_ITEMS);
  const rules = items
    .filter((item) => RULE_PATTERN.test(item) && !PROHIBITION_PATTERN.test(item))
    .slice(0, MAX_ITEMS);
  const datedStatements = items.filter((item) => DATE_PATTERN.test(item)).slice(0, MAX_ITEMS);
  const conflicts = potentialConflicts(items);
  const excluded = new Set([...rules, ...prohibitions, ...datedStatements]);
  const keyPoints = items.filter((item) => !excluded.has(item)).slice(0, MAX_ITEMS);
  const overview = bounded(items.slice(0, 2).join(" "), MAX_OVERVIEW_CHARS);
  const ambiguity = items.find((item) => AMBIGUITY_PATTERN.test(item));
  const questions = [];
  if (conflicts.length > 0) questions.push("Quelle formulation doit être retenue pour chaque contradiction signalée ?");
  if (datedStatements.length > 0) questions.push("Les dates repérées sont-elles encore valides pour la période annoncée ?");
  if (ambiguity) questions.push(`Point à confirmer : ${bounded(ambiguity, 220)}`);
  questions.push("Le document couvre-t-il uniquement le périmètre indiqué lors du dépôt ?");

  return {
    schemaVersion: 1,
    overview,
    keyPoints,
    rules,
    prohibitions,
    datedStatements,
    conflicts,
    questions: questions.slice(0, MAX_ITEMS),
    instructionSignals: [],
  };
}
