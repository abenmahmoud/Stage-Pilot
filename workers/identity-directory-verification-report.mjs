import { createHash } from "node:crypto";
import { documentSecretSignals } from "./knowledge-document-secret-policy.mjs";

export const IDENTITY_VERIFICATION_REPORT_MAX_BYTES = 256 * 1024;

const METRICS = [
  "rowCount",
  "personCount",
  "relationshipCount",
  "orphanReferenceCount",
  "duplicatePersonReferenceCount",
  "classRefCount",
  "forbiddenColumnCount",
  "detectedCodeCount",
];

const KEY_ALIASES = new Map([
  ["lignes_total", "rowCount"],
  ["nombre_lignes", "rowCount"],
  ["row_count", "rowCount"],
  ["personnes", "personCount"],
  ["nombre_personnes", "personCount"],
  ["person_count", "personCount"],
  ["relations", "relationshipCount"],
  ["nombre_relations", "relationshipCount"],
  ["relationship_count", "relationshipCount"],
  ["references_orphelines", "orphanReferenceCount"],
  ["orphelines", "orphanReferenceCount"],
  ["orphan_reference_count", "orphanReferenceCount"],
  ["doublons_reference_personne", "duplicatePersonReferenceCount"],
  ["doublons", "duplicatePersonReferenceCount"],
  ["duplicate_person_reference_count", "duplicatePersonReferenceCount"],
  ["classes_distinctes", "classRefCount"],
  ["nombre_classes", "classRefCount"],
  ["class_ref_count", "classRefCount"],
  ["colonnes_interdites", "forbiddenColumnCount"],
  ["forbidden_column_count", "forbiddenColumnCount"],
  ["codes_detectes", "detectedCodeCount"],
  ["codes_d_acces_detectes", "detectedCodeCount"],
  ["detected_code_count", "detectedCodeCount"],
]);

export class IdentityDirectoryVerificationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "IdentityDirectoryVerificationError";
    this.code = code;
  }
}

function normalized(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[’']/g, "_")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function safeInteger(value) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 && parsed <= 25_000 ? parsed : null;
}

function readStructuredMetrics(text) {
  const found = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const match = rawLine.match(/^\s*([^:=]{2,80})\s*[:=]\s*(\d+)\s*$/u);
    if (!match) continue;
    const metric = KEY_ALIASES.get(normalized(match[1]));
    const value = safeInteger(match[2]);
    if (metric && value !== null) found[metric] = value;
  }
  return found;
}

function firstNaturalMetric(text, patterns) {
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (!match) continue;
    const value = safeInteger(match[1]);
    if (value !== null) return value;
  }
  return undefined;
}

function supplementNaturalMetrics(text, found) {
  const plain = text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const patterns = {
    rowCount: [/(\d+)\s+lignes?\b/u, /\btotal(?:\s+des)?\s+lignes?\D{0,30}(\d+)/u],
    personCount: [/(\d+)\s+persons?\b/u, /(\d+)\s+personnes?\b/u, /\bpersonnes?\D{0,30}(\d+)/u],
    relationshipCount: [/(\d+)\s+relationships?\b/u, /(\d+)\s+relations?\b/u, /\brelations?\D{0,30}(\d+)/u],
    orphanReferenceCount: [/\breferences?\s+orphelines?\D{0,30}(\d+)/u, /(\d+)\s+references?\s+orphelines?/u],
    duplicatePersonReferenceCount: [/\bdoublons?(?:\s+de)?\s+reference_personne\D{0,30}(\d+)/u, /(\d+)\s+doublons?/u],
    classRefCount: [/(\d+)\s+reference_classe\s+distinctes?/u, /\bclasses?\s+distinctes?\D{0,30}(\d+)/u],
    forbiddenColumnCount: [/\bcolonnes?\s+interdites?\D{0,30}(\d+)/u],
    detectedCodeCount: [/\bcodes?(?:\s+d_acces)?\s+detectes?\D{0,30}(\d+)/u],
  };
  for (const metric of METRICS) {
    if (found[metric] !== undefined) continue;
    const value = firstNaturalMetric(plain, patterns[metric]);
    if (value !== undefined) found[metric] = value;
  }
  return found;
}

export function verifyIdentityDirectoryReport({ bytes, parsed }) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 1 || bytes.length > IDENTITY_VERIFICATION_REPORT_MAX_BYTES) {
    throw new IdentityDirectoryVerificationError(
      "verification_report_invalid_size",
      "Le rapport de vérification est vide ou trop volumineux"
    );
  }
  if (bytes.includes(0)) {
    throw new IdentityDirectoryVerificationError(
      "verification_report_invalid_signature",
      "Le rapport de vérification n'est pas un fichier texte valide"
    );
  }
  const text = bytes.toString("utf8");
  if (text.includes("\uFFFD")) {
    throw new IdentityDirectoryVerificationError(
      "verification_report_invalid_encoding",
      "Le rapport de vérification doit être encodé en UTF-8"
    );
  }
  if (documentSecretSignals(text).length > 0) {
    throw new IdentityDirectoryVerificationError(
      "verification_report_secret_forbidden",
      "Le rapport de vérification contient une donnée secrète interdite"
    );
  }

  const reported = supplementNaturalMetrics(text, readStructuredMetrics(text));
  const computed = Object.fromEntries(METRICS.map((metric) => [metric, parsed.summary[metric]]));
  const mismatchCodes = [];
  for (const metric of METRICS) {
    if (reported[metric] === undefined) mismatchCodes.push(`missing_${metric}`);
    else if (reported[metric] !== computed[metric]) mismatchCodes.push(`mismatch_${metric}`);
  }

  const classRefsMissingFromReport = parsed.summary.classRefs.filter((classRef) => {
    const escaped = classRef.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return !new RegExp(`(^|[^A-Za-z0-9._:-])${escaped}([^A-Za-z0-9._:-]|$)`, "u").test(text);
  });
  if (classRefsMissingFromReport.length > 0) mismatchCodes.push("class_list_mismatch");

  return {
    schema: 1,
    checksum: createHash("sha256").update(bytes).digest("hex"),
    matches: mismatchCodes.length === 0,
    reported,
    computed,
    mismatchCodes,
    classRefsMissingFromReport,
  };
}
