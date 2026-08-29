export const IDENTITY_LOOKUP_SEARCH_TYPES = [
  "academic_email",
  "personal_email",
  "phone",
  "person_ref",
] as const;

export const IDENTITY_LOOKUP_REASON_CATEGORIES = [
  "support_case",
  "identity_verification",
  "contact_correction",
  "other",
] as const;

export type IdentityLookupSearchType = (typeof IDENTITY_LOOKUP_SEARCH_TYPES)[number];
export type IdentityLookupReasonCategory = (typeof IDENTITY_LOOKUP_REASON_CATEGORIES)[number];

export type IdentityLookupInput = {
  searchType: IdentityLookupSearchType;
  query: string;
  reasonCategory: IdentityLookupReasonCategory;
  justification: string;
};

function plainObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("La recherche est invalide.");
  }
  return value as Record<string, unknown>;
}

export function parseIdentityLookupInput(value: unknown): IdentityLookupInput {
  const input = plainObject(value);
  if (
    typeof input.searchType !== "string" ||
    !IDENTITY_LOOKUP_SEARCH_TYPES.includes(input.searchType as IdentityLookupSearchType)
  ) {
    throw new Error("Choisissez un type de recherche autorisé.");
  }
  if (
    typeof input.reasonCategory !== "string" ||
    !IDENTITY_LOOKUP_REASON_CATEGORIES.includes(
      input.reasonCategory as IdentityLookupReasonCategory
    )
  ) {
    throw new Error("Choisissez le motif de la consultation.");
  }
  if (typeof input.query !== "string") throw new Error("Saisissez la valeur exacte.");
  const query = input.query.normalize("NFKC").trim();
  if (query.length < 3 || query.length > 254 || /[\r\n\u0000-\u001f]/.test(query)) {
    throw new Error("La valeur recherchée est invalide.");
  }
  if (
    (input.searchType === "academic_email" || input.searchType === "personal_email") &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(query)
  ) {
    throw new Error("Saisissez une adresse email complète.");
  }
  if (input.searchType === "phone" && !/^[+0-9().\s-]{8,30}$/.test(query)) {
    throw new Error("Saisissez un numéro de téléphone complet.");
  }
  if (
    input.searchType === "person_ref" &&
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{2,119}$/.test(query)
  ) {
    throw new Error("La référence interne est invalide.");
  }
  if (typeof input.justification !== "string") {
    throw new Error("Expliquez pourquoi cette consultation est nécessaire.");
  }
  const justification = input.justification.normalize("NFKC").trim();
  if (
    justification.length < 20 ||
    justification.length > 500 ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(justification)
  ) {
    throw new Error("Expliquez la consultation en 20 à 500 caractères.");
  }
  return {
    searchType: input.searchType as IdentityLookupSearchType,
    query,
    reasonCategory: input.reasonCategory as IdentityLookupReasonCategory,
    justification,
  };
}

export type IdentityLookupResult = {
  firstName: string;
  lastName: string;
  personType: "student" | "guardian" | "staff";
  classRef: string | null;
  serviceCode: string | null;
  personRef: string;
  matchedBy: IdentityLookupSearchType;
  directoryVersionId: string;
  directoryActivatedAt: string;
};

export function parseIdentityLookupResult(value: unknown): IdentityLookupResult {
  const result = plainObject(value);
  const shortText = (field: string, maximum: number): string => {
    const entry = result[field];
    if (typeof entry !== "string" || entry.length < 1 || entry.length > maximum) {
      throw new Error("Résultat de recherche invalide.");
    }
    return entry;
  };
  const optionalText = (field: string): string | null => {
    const entry = result[field];
    if (entry === null) return null;
    if (typeof entry !== "string" || entry.length < 1 || entry.length > 120) {
      throw new Error("Résultat de recherche invalide.");
    }
    return entry;
  };
  const personType = result.personType;
  const matchedBy = result.matchedBy;
  if (!(["student", "guardian", "staff"] as unknown[]).includes(personType)) {
    throw new Error("Résultat de recherche invalide.");
  }
  if (!IDENTITY_LOOKUP_SEARCH_TYPES.includes(matchedBy as IdentityLookupSearchType)) {
    throw new Error("Résultat de recherche invalide.");
  }
  const directoryActivatedAt = shortText("directoryActivatedAt", 40);
  if (Number.isNaN(Date.parse(directoryActivatedAt))) {
    throw new Error("Résultat de recherche invalide.");
  }
  return {
    firstName: shortText("firstName", 200),
    lastName: shortText("lastName", 200),
    personType: personType as IdentityLookupResult["personType"],
    classRef: optionalText("classRef"),
    serviceCode: optionalText("serviceCode"),
    personRef: shortText("personRef", 120),
    matchedBy: matchedBy as IdentityLookupSearchType,
    directoryVersionId: shortText("directoryVersionId", 40),
    directoryActivatedAt,
  };
}
