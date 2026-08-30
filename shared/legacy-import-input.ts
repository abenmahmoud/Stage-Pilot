export const LEGACY_IMPORT_MAX_ROWS = 5_000;
export const LEGACY_IMPORT_MAX_FILE_BYTES = 10 * 1024 * 1024;

export type LegacyStudentRow = {
  nom: string;
  prenom: string;
  classe: string;
  emailEleve?: string;
  emailFamille?: string;
  telephoneFamille?: string;
  dateNaissance?: string;
};

export type LegacyTeacherRow = {
  nom: string;
  prenom: string;
  email?: string;
  matieres?: string;
};

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} est invalide`);
  }
  return value as Record<string, unknown>;
}

function cleanText(
  value: unknown,
  label: string,
  maxLength: number,
  required: boolean
): string | undefined {
  if (value === undefined || value === null || value === "") {
    if (required) throw new Error(`${label} est obligatoire`);
    return undefined;
  }
  if (typeof value !== "string") throw new Error(`${label} est invalide`);
  const clean = value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim();
  if ((!clean && required) || clean.length > maxLength) {
    throw new Error(`${label} est invalide`);
  }
  return clean || undefined;
}

function importRows(value: unknown): unknown[] {
  const input = record(value, "Le fichier importé");
  if (!Array.isArray(input.rows)) throw new Error("Les lignes à importer sont invalides");
  if (input.rows.length > LEGACY_IMPORT_MAX_ROWS) {
    throw new Error(`Un import est limité à ${LEGACY_IMPORT_MAX_ROWS} lignes`);
  }
  return input.rows;
}

export function parseLegacyStudentImport(value: unknown): LegacyStudentRow[] {
  return importRows(value).map((value, index) => {
    const row = record(value, `La ligne ${index + 1}`);
    return {
      nom: cleanText(row.nom, `Nom ligne ${index + 1}`, 100, true)!,
      prenom: cleanText(row.prenom, `Prénom ligne ${index + 1}`, 100, true)!,
      classe: cleanText(row.classe, `Classe ligne ${index + 1}`, 50, true)!,
      emailEleve: cleanText(row.emailEleve, `Email élève ligne ${index + 1}`, 254, false),
      emailFamille: cleanText(row.emailFamille, `Email famille ligne ${index + 1}`, 254, false),
      telephoneFamille: cleanText(
        row.telephoneFamille,
        `Téléphone famille ligne ${index + 1}`,
        40,
        false
      ),
      dateNaissance: cleanText(
        row.dateNaissance,
        `Date de naissance ligne ${index + 1}`,
        20,
        false
      ),
    };
  });
}

export function parseLegacyTeacherImport(value: unknown): LegacyTeacherRow[] {
  return importRows(value).map((value, index) => {
    const row = record(value, `La ligne ${index + 1}`);
    return {
      nom: cleanText(row.nom, `Nom ligne ${index + 1}`, 100, true)!,
      prenom: cleanText(row.prenom, `Prénom ligne ${index + 1}`, 100, true)!,
      email: cleanText(row.email, `Email ligne ${index + 1}`, 254, false),
      matieres: cleanText(row.matieres, `Matières ligne ${index + 1}`, 1_000, false),
    };
  });
}
