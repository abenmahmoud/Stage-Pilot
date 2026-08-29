const BASE_STOP_WORDS = new Set([
  "avec", "avoir", "dans", "elle", "elles", "etre", "faire", "pour", "sans",
  "sont", "tout", "tous", "une", "vous", "votre", "mais", "comme", "plus",
  "quoi", "quel", "quelle", "besoin", "aide", "lycee", "bonjour", "merci",
]);

const SHORT_TOKENS = new Set(["ent", "edt", "pc"]);

const CONCEPT_BY_TOKEN: Record<string, string> = {
  acces: "acces_numerique",
  connecter: "acces_numerique",
  connexion: "acces_numerique",
  educonnect: "acces_numerique",
  ent: "acces_numerique",
  identifiant: "acces_numerique",
  academique: "messagerie_academique",
  courriel: "messagerie_academique",
  email: "messagerie_academique",
  mail: "messagerie_academique",
  messagerie: "messagerie_academique",
  webmail: "messagerie_academique",
  zimbra: "messagerie_academique",
  chargeur: "equipement_informatique",
  ecran: "equipement_informatique",
  ordinateur: "equipement_informatique",
  portable: "equipement_informatique",
  pc: "equipement_informatique",
  tablette: "equipement_informatique",
  attestation: "document_scolarite",
  certificat: "document_scolarite",
  justificatif: "document_scolarite",
  scolarite: "document_scolarite",
  edt: "emploi_temps",
  horaire: "emploi_temps",
  salle: "emploi_temps",
  cantine: "restauration_scolaire",
  pension: "restauration_scolaire",
  restauration: "restauration_scolaire",
  reinscription: "inscription_scolaire",
  inscription: "inscription_scolaire",
  inscrire: "inscription_scolaire",
  absence: "vie_scolaire",
  cpe: "vie_scolaire",
  retard: "vie_scolaire",
};

const PHRASE_CONCEPTS: Array<{ pattern: RegExp; concept: string }> = [
  { pattern: /\bmot de passe\b/, concept: "acces_numerique" },
  { pattern: /\bemploi du temps\b/, concept: "emploi_temps" },
  { pattern: /\bdemi pension\b/, concept: "restauration_scolaire" },
  { pattern: /\bemail academique\b/, concept: "messagerie_academique" },
];

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function knowledgeQueryTokens(
  value: string,
  extraStopWords: ReadonlySet<string> = new Set()
): string[] {
  const normalized = normalize(value);
  const result = new Set<string>();
  for (const token of normalized.split(/\s+/)) {
    if (!token || BASE_STOP_WORDS.has(token) || extraStopWords.has(token)) continue;
    if (token.length < 3 && !SHORT_TOKENS.has(token)) continue;
    result.add(token);
    const concept = CONCEPT_BY_TOKEN[token];
    if (concept) result.add(concept);
  }
  for (const phrase of PHRASE_CONCEPTS) {
    if (phrase.pattern.test(normalized)) result.add(phrase.concept);
  }
  return [...result];
}
