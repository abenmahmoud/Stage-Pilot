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

// Concepts atteignables depuis les langues du pilote.
//
// Preserver l'Unicode ne suffit pas : la base documentaire est en francais, et
// un mot arabe conserve tel quel ne rencontre aucun document. Il faut le faire
// arriver sur le MEME concept que son equivalent francais. C'est la seule
// facon qu'une question sur la cantine posee en arabe trouve la procedure de
// restauration scolaire.
const CONCEPT_BY_FOREIGN_TOKEN: Record<string, string> = {
  // acces numerique
  "كلمه": "acces_numerique",
  "المرور": "acces_numerique",
  "السر": "acces_numerique",
  "الدخول": "acces_numerique",
  "دخول": "acces_numerique",
  "تسجيل": "acces_numerique",
  "حساب": "acces_numerique",
  "معرف": "acces_numerique",
  // messagerie academique
  "بريد": "messagerie_academique",
  "الكتروني": "messagerie_academique",
  "ايميل": "messagerie_academique",
  "مراسله": "messagerie_academique",
  // equipement informatique
  "حاسوب": "equipement_informatique",
  "كمبيوتر": "equipement_informatique",
  "شاحن": "equipement_informatique",
  "شاشه": "equipement_informatique",
  "لوحي": "equipement_informatique",
  // documents de scolarite
  "شهاده": "document_scolarite",
  "افاده": "document_scolarite",
  "وثيقه": "document_scolarite",
  // emploi du temps
  "جدول": "emploi_temps",
  "الحصص": "emploi_temps",
  "التوقيت": "emploi_temps",
  "قاعه": "emploi_temps",
  // restauration scolaire
  "مطعم": "restauration_scolaire",
  "كانتين": "restauration_scolaire",
  "الاكل": "restauration_scolaire",
  "وجبه": "restauration_scolaire",
  // inscription
  "التسجيل": "inscription_scolaire",
  "تسجيلي": "inscription_scolaire",
  "انتساب": "inscription_scolaire",
  // vie scolaire
  "غياب": "vie_scolaire",
  "تاخر": "vie_scolaire",
  "عقوبه": "vie_scolaire",
};

// 064B-0655 couvre les diacritiques, la maddah et les deux hamzas suscrite et
// souscrite ; 0640 est le tatweel d'allongement.
const ARABIC_DIACRITICS = new RegExp("[" + String.fromCharCode(0x064b) + "-" + String.fromCharCode(0x0655) + String.fromCharCode(0x0640) + "]", "gu");
// Les marques combinantes restent attachees au mot : la decomposition NFD a
// deja retire les accents latins, et separer ici couperait un mot arabe en
// deux fragments qui ne rencontreraient plus rien.
const NON_WORD = /[^\p{Letter}\p{Number}\p{Mark}]+/gu;

/**
 * Normalisation arabe minimale : diacritiques et tatweel retires, formes de
 * l'alef ramenees a une seule, ta marbouta et alef maqsura unifiees, article
 * defini « al » retire quand il ne laisse pas un fragment trop court.
 */
function normalizeArabicToken(token: string): string {
  let value = token
    .replace(ARABIC_DIACRITICS, "")
    .replace(/[\u0623\u0625\u0622\u0671]/g, "\u0627")
    .replace(/\u0629/g, "\u0647")
    .replace(/\u0649/g, "\u064a");
  if (value.startsWith("\u0627\u0644") && value.length > 4) value = value.slice(2);
  return value;
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(NON_WORD, " ")
    .trim();
}

export function knowledgeQueryTokens(
  value: string,
  extraStopWords: ReadonlySet<string> = new Set()
): string[] {
  const normalized = normalize(value);
  const result = new Set<string>();
  for (const rawToken of normalized.split(/\s+/)) {
    if (!rawToken) continue;
    const isLatin = /^[a-z0-9]+$/.test(rawToken);
    const token = isLatin ? rawToken : normalizeArabicToken(rawToken);
    if (BASE_STOP_WORDS.has(token) || extraStopWords.has(token)) continue;
    if (token.length < 3 && !SHORT_TOKENS.has(token)) continue;
    result.add(token);
    const concept = isLatin ? CONCEPT_BY_TOKEN[token] : CONCEPT_BY_FOREIGN_TOKEN[token];
    if (concept) result.add(concept);
  }
  for (const phrase of PHRASE_CONCEPTS) {
    if (phrase.pattern.test(normalized)) result.add(phrase.concept);
  }
  return [...result];
}
