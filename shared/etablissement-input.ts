export type EtablissementInput = {
  nom: string;
  adresse: string;
  codePostal: string;
  ville: string;
  telephone: string | null;
  email: string | null;
  uai: string;
  nomProviseur: string;
  civiliteProviseur: string;
  anneeScolaire: string;
  dateStageDebut: string;
  dateStageFin: string;
  dateLimiteConvention: string;
  dateGoDebut: string;
  dateGoFin: string;
};

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Les paramètres de l'établissement sont invalides.");
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, label: string, maximum: number): string {
  if (typeof value !== "string") throw new Error(`${label} est obligatoire.`);
  const clean = value
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean || clean.length > maximum) {
    throw new Error(`${label} est invalide.`);
  }
  return clean;
}

function optionalText(value: unknown, label: string, maximum: number): string | null {
  if (value === null || value === undefined || value === "") return null;
  return text(value, label, maximum);
}

function isoDate(value: unknown, label: string): string {
  const clean = text(value, label, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(clean)) throw new Error(`${label} est invalide.`);
  const date = new Date(`${clean}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== clean) {
    throw new Error(`${label} est invalide.`);
  }
  return clean;
}

export function parseEtablissementInput(value: unknown): EtablissementInput {
  const input = record(value);
  const codePostal = text(input.codePostal, "Le code postal", 5);
  if (!/^\d{5}$/.test(codePostal)) throw new Error("Le code postal est invalide.");

  const email = optionalText(input.email, "L'adresse email", 254)?.toLowerCase() ?? null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("L'adresse email est invalide.");
  }

  const telephone = optionalText(input.telephone, "Le téléphone", 30);
  if (telephone && !/^[+0-9().\s-]{6,30}$/.test(telephone)) {
    throw new Error("Le téléphone est invalide.");
  }

  const uai = text(input.uai, "L'UAI", 8).toUpperCase();
  if (!/^\d{7}[A-Z]$/.test(uai)) throw new Error("L'UAI est invalide.");

  const anneeScolaire = text(input.anneeScolaire, "L'année scolaire", 9);
  const year = /^(\d{4})-(\d{4})$/.exec(anneeScolaire);
  if (!year || Number(year[2]) !== Number(year[1]) + 1) {
    throw new Error("L'année scolaire est invalide.");
  }

  const dateStageDebut = isoDate(input.dateStageDebut, "Le début du stage");
  const dateStageFin = isoDate(input.dateStageFin, "La fin du stage");
  const dateGoDebut = isoDate(input.dateGoDebut, "Le début du Grand Oral");
  const dateGoFin = isoDate(input.dateGoFin, "La fin du Grand Oral");
  if (dateStageFin < dateStageDebut) throw new Error("La période de stage est invalide.");
  if (dateGoFin < dateGoDebut) throw new Error("La période de Grand Oral est invalide.");

  return {
    nom: text(input.nom, "Le nom", 180),
    adresse: text(input.adresse, "L'adresse", 300),
    codePostal,
    ville: text(input.ville, "La ville", 120),
    telephone,
    email,
    uai,
    nomProviseur: text(input.nomProviseur, "Le nom de la direction", 160),
    civiliteProviseur: text(input.civiliteProviseur, "La civilité", 20),
    anneeScolaire,
    dateStageDebut,
    dateStageFin,
    dateLimiteConvention: isoDate(input.dateLimiteConvention, "La date limite de convention"),
    dateGoDebut,
    dateGoFin,
  };
}
