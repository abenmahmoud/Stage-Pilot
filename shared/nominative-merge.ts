// Fusion nominative : un message par livraison, un seul beneficiaire, une seule
// version de valeur.
//
// Difference volontaire avec `renderSupportReplyTemplate` : ici une variable
// inconnue ou absente est une ERREUR, jamais un texte laisse en place. Un
// message parti avec « {{numero_badge}} » visible est un incident ; un message
// refuse avant mise en file est un simple retour a la verification.

import {
  NominativeValueError,
  parseBeneficiaryRef,
  type NominativeValueRecord,
} from "./nominative-value-policy.js";
import { detectForbiddenSupportSecret } from "./support-secret-policy.js";

const PLACEHOLDER = /\{\{\s*([a-z][a-z0-9_]{0,39})\s*\}\}/g;
const LEFTOVER = /\{\{|\}\}/;
const MAX_SUBJECT = 180;
const MAX_PREHEADER = 240;
const MAX_BODY = 20000;

/** Variables que le serveur sait alimenter pour une diffusion cantine. */
export const NOMINATIVE_TEMPLATE_VARIABLES = [
  "beneficiaire_prenom",
  "beneficiaire_nom",
  "beneficiaire_classe",
  "annee_scolaire",
  "valeur",
] as const;

export type NominativeTemplateVariable = (typeof NOMINATIVE_TEMPLATE_VARIABLES)[number];

/** La valeur personnelle elle-meme. Un modele qui ne la porte pas n'est pas nominatif. */
export const REQUIRED_NOMINATIVE_VARIABLES: readonly NominativeTemplateVariable[] = ["valeur"];

export class NominativeMergeError extends Error {
  readonly reason: string;

  constructor(reason: string) {
    super("La fusion nominative est invalide");
    this.reason = reason;
  }
}

export function nominativeTemplateVariables(body: string): string[] {
  if (typeof body !== "string") throw new NominativeMergeError("template_invalid");
  return [...new Set(Array.from(body.matchAll(PLACEHOLDER), (match) => match[1]))];
}

export type NominativeTemplate = {
  templateRef: string;
  subject: string;
  preheader: string;
  bodyText: string;
};

const TEMPLATE_FIELDS = new Set(["templateRef", "subject", "preheader", "bodyText"]);

/**
 * Controle du modele AVANT toute mise en file : variables connues, variables
 * obligatoires presentes, longueurs tenables une fois la valeur inseree.
 */
export function parseNominativeTemplate(value: unknown): NominativeTemplate {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new NominativeMergeError("template_invalid");
  }
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some((key) => !TEMPLATE_FIELDS.has(key))) {
    throw new NominativeMergeError("unknown_field");
  }
  const templateRef = parseBeneficiaryRef(input.templateRef);
  for (const [field, max] of [["subject", MAX_SUBJECT], ["preheader", MAX_PREHEADER], ["bodyText", MAX_BODY]] as const) {
    const candidate = input[field];
    if (typeof candidate !== "string" || candidate.trim().length < 1 || candidate.length > max) {
      throw new NominativeMergeError(field + "_invalid");
    }
  }
  const template: NominativeTemplate = {
    templateRef,
    subject: (input.subject as string).trim(),
    preheader: (input.preheader as string).trim(),
    bodyText: (input.bodyText as string).replace(/\r\n?/g, "\n").trim(),
  };

  const used = new Set([
    ...nominativeTemplateVariables(template.subject),
    ...nominativeTemplateVariables(template.preheader),
    ...nominativeTemplateVariables(template.bodyText),
  ]);
  for (const variable of used) {
    if (!(NOMINATIVE_TEMPLATE_VARIABLES as readonly string[]).includes(variable)) {
      throw new NominativeMergeError("variable_unknown");
    }
  }
  for (const required of REQUIRED_NOMINATIVE_VARIABLES) {
    if (!used.has(required)) throw new NominativeMergeError("variable_required_missing");
  }
  // Le modele lui-meme ne doit contenir aucune valeur en dur : une valeur
  // ecrite dans le modele partirait a tout le monde.
  if (detectForbiddenSupportSecret(template.subject + "\n" + template.preheader + "\n" + template.bodyText)) {
    throw new NominativeMergeError("template_contains_secret");
  }
  return template;
}

export type NominativeBeneficiaryContext = {
  beneficiaryRef: string;
  firstName: string;
  lastName: string;
  classLabel: string;
};

const CONTEXT_FIELDS = new Set(["beneficiaryRef", "firstName", "lastName", "classLabel"]);
const CONTROL_CHARACTERS = new RegExp(
  "[" + String.fromCharCode(0) + "-" + String.fromCharCode(31) + String.fromCharCode(127) + "]",
  "u"
);

function shortText(value: unknown, field: string): string {
  if (typeof value !== "string") throw new NominativeMergeError(field + "_invalid");
  const cleaned = value.trim();
  if (cleaned.length < 1 || cleaned.length > 80 || CONTROL_CHARACTERS.test(cleaned)) {
    throw new NominativeMergeError(field + "_invalid");
  }
  return cleaned;
}

export function parseNominativeBeneficiaryContext(value: unknown): NominativeBeneficiaryContext {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new NominativeMergeError("beneficiary_invalid");
  }
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some((key) => !CONTEXT_FIELDS.has(key))) {
    throw new NominativeMergeError("unknown_field");
  }
  return {
    beneficiaryRef: parseBeneficiaryRef(input.beneficiaryRef),
    firstName: shortText(input.firstName, "first_name"),
    lastName: shortText(input.lastName, "last_name"),
    classLabel: shortText(input.classLabel, "class_label"),
  };
}

export type NominativeMergedMessage = {
  beneficiaryRef: string;
  templateRef: string;
  valueVersion: string;
  subject: string;
  preheader: string;
  bodyText: string;
};

function substitute(source: string, values: Record<string, string>, field: string): string {
  const rendered = source.replace(PLACEHOLDER, (_placeholder, variable: string) => {
    const replacement = values[variable];
    if (typeof replacement !== "string") {
      throw new NominativeMergeError("variable_missing_value");
    }
    return replacement;
  });
  if (LEFTOVER.test(rendered)) throw new NominativeMergeError(field + "_placeholder_left");
  return rendered;
}

/**
 * Fusion d'UNE livraison. La verification centrale est la premiere ligne : la
 * valeur presentee doit appartenir au beneficiaire de cette livraison. C'est
 * ce controle qui empeche qu'un parent de deux enfants recoive deux fois la
 * meme valeur, ou la valeur de l'autre enfant.
 */
export function mergeNominativeMessage(input: {
  template: NominativeTemplate;
  beneficiary: NominativeBeneficiaryContext;
  record: NominativeValueRecord;
}): NominativeMergedMessage {
  if (input.record.beneficiaryRef !== input.beneficiary.beneficiaryRef) {
    throw new NominativeMergeError("value_beneficiary_mismatch");
  }
  if (input.record.valueClass !== "private_value") {
    throw new NominativeValueError("secret_not_diffusable");
  }

  const values: Record<string, string> = {
    beneficiaire_prenom: input.beneficiary.firstName,
    beneficiaire_nom: input.beneficiary.lastName,
    beneficiaire_classe: input.beneficiary.classLabel,
    annee_scolaire: input.record.schoolYear,
    valeur: input.record.value,
  };

  const subject = substitute(input.template.subject, values, "subject");
  const preheader = substitute(input.template.preheader, values, "preheader");
  const bodyText = substitute(input.template.bodyText, values, "body");

  if (subject.length < 1 || subject.length > MAX_SUBJECT) throw new NominativeMergeError("subject_length");
  if (preheader.length < 1 || preheader.length > MAX_PREHEADER) throw new NominativeMergeError("preheader_length");
  if (bodyText.length < 1 || bodyText.length > MAX_BODY) throw new NominativeMergeError("body_length");
  if (!bodyText.includes(input.record.value)) throw new NominativeMergeError("value_not_delivered");

  return {
    beneficiaryRef: input.beneficiary.beneficiaryRef,
    templateRef: input.template.templateRef,
    valueVersion: input.record.valueVersion,
    subject,
    preheader,
    bodyText,
  };
}
