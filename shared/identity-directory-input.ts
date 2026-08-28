export const IDENTITY_DIRECTORY_MAX_BYTES = 50 * 1024 * 1024;

export const IDENTITY_DIRECTORY_MIME_TYPES = [
  "text/csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
] as const;

export const IDENTITY_DIRECTORY_SOURCE_TYPES = [
  "csv",
  "xlsx",
  "official_export",
] as const;

export type IdentityDirectoryInput = {
  title: string;
  purposeDescription: string;
  sourceType: (typeof IDENTITY_DIRECTORY_SOURCE_TYPES)[number];
  originalName: string;
  mimeType: (typeof IDENTITY_DIRECTORY_MIME_TYPES)[number];
  sizeBytes: number;
};

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Les données sont invalides");
  }
  return value as Record<string, unknown>;
}

function cleanText(value: unknown, label: string, min: number, max: number): string {
  if (typeof value !== "string") throw new Error(`${label} est obligatoire`);
  const clean = value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .trim();
  if (clean.length < min || clean.length > max) {
    throw new Error(`${label} doit contenir entre ${min} et ${max} caractères`);
  }
  return clean;
}

function enumValue<T extends string>(value: unknown, values: readonly T[], label: string): T {
  if (typeof value !== "string" || !values.includes(value as T)) {
    throw new Error(`${label} est invalide`);
  }
  return value as T;
}

export function identityDirectoryMime(fileName: string, suppliedMime = ""): string {
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (extension === "csv") return "text/csv";
  if (extension === "xlsx") {
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  }
  const normalized = suppliedMime.toLowerCase().trim();
  return (IDENTITY_DIRECTORY_MIME_TYPES as readonly string[]).includes(normalized)
    ? normalized
    : "";
}

export function parseIdentityDirectoryInput(value: unknown): IdentityDirectoryInput {
  const input = record(value);
  const originalName = cleanText(input.originalName, "Nom du fichier", 1, 255);
  const mimeType = enumValue(
    identityDirectoryMime(originalName, String(input.mimeType ?? "")),
    IDENTITY_DIRECTORY_MIME_TYPES,
    "Format du fichier"
  );
  const sizeBytes = Number(input.sizeBytes);
  if (
    !Number.isInteger(sizeBytes) ||
    sizeBytes <= 0 ||
    sizeBytes > IDENTITY_DIRECTORY_MAX_BYTES
  ) {
    throw new Error("Le fichier doit faire 50 Mo maximum pour ce pilote");
  }

  return {
    title: cleanText(input.title, "Titre", 2, 180),
    purposeDescription: cleanText(input.purposeDescription, "Explication", 20, 2000),
    sourceType: enumValue(
      input.sourceType,
      IDENTITY_DIRECTORY_SOURCE_TYPES,
      "Origine du fichier"
    ),
    originalName,
    mimeType,
    sizeBytes,
  };
}
