// Politique des valeurs nominatives (informations de cantine, badges, et plus
// tard toute donnee personnelle diffusee individuellement).
//
// Deux principes tiennent tout le module :
//
// 1. La classification depend de ce que la valeur PERMET DE FAIRE, pas du titre
//    de sa colonne. Une colonne « code » peut contenir un numero de badge sans
//    pouvoir d'acces ; une colonne « numero » peut contenir un code
//    d'activation. Le referent declare la fonction reelle, et c'est cette
//    declaration qui ouvre ou ferme le circuit de diffusion.
// 2. La valeur est TOUJOURS traitee comme du texte. Un numero de badge
//    « 0042 » n'est pas 42 : les zeros initiaux appartiennent a la valeur.

import { detectForbiddenSupportSecret } from "./support-secret-policy.js";

export const NOMINATIVE_VALUE_FUNCTIONS = [
  "cantine_information",
  "badge_number",
  "access_secret",
  "activation_secret",
] as const;

export type NominativeValueFunction = (typeof NOMINATIVE_VALUE_FUNCTIONS)[number];

/**
 * `private_value` : donnee personnelle sans pouvoir d'acces. Elle peut etre
 * fusionnee dans un email apres validation du lot et du contact autorise.
 *
 * `access_secret` : la valeur ouvre un acces ou active un compte. Elle releve
 * du coffre de remise de secrets (FR-043), pas du circuit de diffusion.
 */
export type NominativeValueClass = "private_value" | "access_secret";

const CLASS_BY_FUNCTION: Readonly<Record<NominativeValueFunction, NominativeValueClass>> = {
  cantine_information: "private_value",
  badge_number: "private_value",
  access_secret: "access_secret",
  activation_secret: "access_secret",
};

export class NominativeValueError extends Error {
  readonly reason: string;

  constructor(reason: string) {
    super("La valeur nominative est invalide");
    this.reason = reason;
  }
}

export function classifyNominativeValueFunction(value: unknown): NominativeValueClass {
  if (typeof value !== "string" || !(NOMINATIVE_VALUE_FUNCTIONS as readonly string[]).includes(value)) {
    throw new NominativeValueError("value_function_invalid");
  }
  return CLASS_BY_FUNCTION[value as NominativeValueFunction];
}

export function isDiffusableNominativeValue(value: unknown): boolean {
  try {
    return classifyNominativeValueFunction(value) === "private_value";
  } catch {
    return false;
  }
}

/**
 * Le circuit de diffusion refuse par construction toute valeur classee secret.
 * L'appel est volontairement separe de la classification : il documente le
 * refus la ou il est decide, et il est teste comme tel.
 */
export function assertDiffusableNominativeValue(valueFunction: unknown): NominativeValueFunction {
  if (classifyNominativeValueFunction(valueFunction) !== "private_value") {
    throw new NominativeValueError("secret_not_diffusable");
  }
  return valueFunction as NominativeValueFunction;
}

const REF_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9:_-]{7,119}$/;
const MAX_VALUE_LENGTH = 120;
const CONTROL_CHARACTERS = new RegExp(
  "[" + String.fromCharCode(0) + "-" + String.fromCharCode(31) + String.fromCharCode(127) + "]",
  "u"
);
const NON_BREAKING_SPACE = new RegExp(String.fromCharCode(160), "g");

export function parseBeneficiaryRef(value: unknown): string {
  if (
    typeof value !== "string" ||
    value !== value.trim() ||
    !REF_PATTERN.test(value) ||
    /@|mailto:|https?:|tel:|www\./i.test(value)
  ) {
    throw new NominativeValueError("beneficiary_ref_invalid");
  }
  return value;
}

/**
 * Normalisation minimale : on remplace l'espace insecable par une espace
 * ordinaire, on retire les espaces de bord, et rien d'autre. Aucune conversion
 * numerique, aucun retrait de zero initial, aucune casse forcee. Deux valeurs
 * qui different d'un zero initial sont deux valeurs differentes.
 */
export function parseNominativeValueText(value: unknown): string {
  if (typeof value !== "string") throw new NominativeValueError("value_invalid");
  const cleaned = value.replace(NON_BREAKING_SPACE, " ").trim();
  if (cleaned.length < 1 || cleaned.length > MAX_VALUE_LENGTH) {
    throw new NominativeValueError("value_invalid");
  }
  if (CONTROL_CHARACTERS.test(cleaned)) throw new NominativeValueError("value_invalid");
  if (detectForbiddenSupportSecret(cleaned)) throw new NominativeValueError("value_looks_like_secret");
  return cleaned;
}

const YEAR_PATTERN = /^(20\d{2})-(20\d{2})$/;

export function parseSchoolYear(value: unknown): string {
  if (typeof value !== "string") throw new NominativeValueError("school_year_invalid");
  const parts = value.match(YEAR_PATTERN);
  if (!parts) throw new NominativeValueError("school_year_invalid");
  if (Number(parts[2]) !== Number(parts[1]) + 1) throw new NominativeValueError("school_year_invalid");
  return value;
}

export type NominativeValueRecordInput = {
  beneficiaryRef: string;
  valueFunction: NominativeValueFunction;
  value: string;
  schoolYear: string;
  sourceRef: string;
};

export type NominativeValueRecord = NominativeValueRecordInput & {
  valueClass: NominativeValueClass;
  /** Empreinte stable de la valeur pour ce beneficiaire, cette annee et cette source. */
  valueVersion: string;
};

export type NominativeHasher = {
  update(data: string): unknown;
  digest(encoding: "hex"): string;
};

const RECORD_FIELDS = new Set([
  "beneficiaryRef",
  "valueFunction",
  "value",
  "schoolYear",
  "sourceRef",
]);

const SEPARATOR = String.fromCharCode(0);

/**
 * L'empreinte est calculee sur les champs qui definissent l'identite de la
 * valeur. Elle sert a figer un lot : si la valeur change, l'empreinte change,
 * et le lot approuve n'est plus applicable en l'etat.
 */
export function nominativeValueVersion(
  input: NominativeValueRecordInput,
  hasher: NominativeHasher
): string {
  hasher.update("nominative-value-v1" + SEPARATOR);
  hasher.update(input.beneficiaryRef);
  hasher.update(SEPARATOR);
  hasher.update(input.valueFunction);
  hasher.update(SEPARATOR);
  hasher.update(input.schoolYear);
  hasher.update(SEPARATOR);
  hasher.update(input.sourceRef);
  hasher.update(SEPARATOR);
  hasher.update(input.value);
  return hasher.digest("hex");
}

export function parseNominativeValueRecord(
  value: unknown,
  hasherFactory: () => NominativeHasher
): NominativeValueRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new NominativeValueError("record_invalid");
  }
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some((key) => !RECORD_FIELDS.has(key))) {
    throw new NominativeValueError("unknown_field");
  }
  const valueFunction = assertDiffusableNominativeValue(input.valueFunction);
  const record: NominativeValueRecordInput = {
    beneficiaryRef: parseBeneficiaryRef(input.beneficiaryRef),
    valueFunction,
    value: parseNominativeValueText(input.value),
    schoolYear: parseSchoolYear(input.schoolYear),
    sourceRef: parseBeneficiaryRef(input.sourceRef),
  };
  return {
    ...record,
    valueClass: "private_value",
    valueVersion: nominativeValueVersion(record, hasherFactory()),
  };
}
