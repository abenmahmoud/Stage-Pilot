// Le lot nominatif : ce que le referent approuve, et ce qui reste vrai apres
// son approbation.
//
// Un lot fige quatre choses : le fichier source et son annee, le modele, la
// liste des livraisons (beneficiaire, contact, version de valeur), et les
// exclusions avec leur motif. L'empreinte du lot resume ces quatre choses. Si
// l'une bouge, l'empreinte bouge, et le lot approuve n'est plus applicable :
// il repasse par la verification au lieu d'etre remplace en silence.

import {
  parseBeneficiaryRef,
  parseSchoolYear,
  type NominativeHasher,
} from "./nominative-value-policy.js";

const HASH_PATTERN = /^[a-f0-9]{64}$/;
const MAX_LINES = 5000;
const SEPARATOR = String.fromCharCode(0);

export const NOMINATIVE_EXCLUSION_REASONS = [
  "contact_absent",
  "contact_revoque",
  "rapprochement_absent",
  "rapprochement_ambigu",
  "valeur_manquante",
  "doublon_source",
  "hors_perimetre",
] as const;

export type NominativeExclusionReason = (typeof NOMINATIVE_EXCLUSION_REASONS)[number];

export class NominativeBatchError extends Error {
  readonly reason: string;

  constructor(reason: string) {
    super("Le lot nominatif est invalide");
    this.reason = reason;
  }
}

export type NominativeBatchLine = {
  beneficiaryRef: string;
  contactRef: string;
  valueVersion: string;
};

export type NominativeBatchExclusion = {
  beneficiaryRef: string;
  reason: NominativeExclusionReason;
};

export type NominativeBatchInput = {
  institutionId: string;
  sourceRef: string;
  schoolYear: string;
  templateRef: string;
  templateHash: string;
  lines: NominativeBatchLine[];
  exclusions: NominativeBatchExclusion[];
};

export type FrozenNominativeBatch = NominativeBatchInput & {
  /** Ordre canonique : l'empreinte ne depend pas de l'ordre d'arrivee des lignes. */
  lines: NominativeBatchLine[];
  exclusions: NominativeBatchExclusion[];
  readyCount: number;
  excludedCount: number;
  scopeHash: string;
};

const BATCH_FIELDS = new Set([
  "institutionId",
  "sourceRef",
  "schoolYear",
  "templateRef",
  "templateHash",
  "lines",
  "exclusions",
]);
const LINE_FIELDS = new Set(["beneficiaryRef", "contactRef", "valueVersion"]);
const EXCLUSION_FIELDS = new Set(["beneficiaryRef", "reason"]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseLine(value: unknown): NominativeBatchLine {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new NominativeBatchError("line_invalid");
  }
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some((key) => !LINE_FIELDS.has(key))) {
    throw new NominativeBatchError("unknown_field");
  }
  if (typeof input.valueVersion !== "string" || !HASH_PATTERN.test(input.valueVersion)) {
    throw new NominativeBatchError("value_version_invalid");
  }
  return {
    beneficiaryRef: parseBeneficiaryRef(input.beneficiaryRef),
    contactRef: parseBeneficiaryRef(input.contactRef),
    valueVersion: input.valueVersion,
  };
}

function parseExclusion(value: unknown): NominativeBatchExclusion {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new NominativeBatchError("exclusion_invalid");
  }
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some((key) => !EXCLUSION_FIELDS.has(key))) {
    throw new NominativeBatchError("unknown_field");
  }
  if (
    typeof input.reason !== "string" ||
    !(NOMINATIVE_EXCLUSION_REASONS as readonly string[]).includes(input.reason)
  ) {
    throw new NominativeBatchError("exclusion_reason_invalid");
  }
  return {
    beneficiaryRef: parseBeneficiaryRef(input.beneficiaryRef),
    reason: input.reason as NominativeExclusionReason,
  };
}

function compareLines(left: NominativeBatchLine, right: NominativeBatchLine): number {
  if (left.beneficiaryRef !== right.beneficiaryRef) {
    return left.beneficiaryRef < right.beneficiaryRef ? -1 : 1;
  }
  if (left.contactRef !== right.contactRef) return left.contactRef < right.contactRef ? -1 : 1;
  return left.valueVersion < right.valueVersion ? -1 : left.valueVersion > right.valueVersion ? 1 : 0;
}

/**
 * Un beneficiaire n'apparait qu'une fois dans les lignes pretes, et jamais a la
 * fois pret et exclu. En revanche DEUX beneficiaires peuvent partager le meme
 * contact : c'est le cas normal du parent de deux enfants, et les deux
 * livraisons doivent exister.
 */
export function freezeNominativeBatch(
  value: unknown,
  hasherFactory: () => NominativeHasher
): FrozenNominativeBatch {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new NominativeBatchError("batch_invalid");
  }
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some((key) => !BATCH_FIELDS.has(key))) {
    throw new NominativeBatchError("unknown_field");
  }
  if (typeof input.institutionId !== "string" || !UUID_PATTERN.test(input.institutionId)) {
    throw new NominativeBatchError("institution_scope_invalid");
  }
  if (typeof input.templateHash !== "string" || !HASH_PATTERN.test(input.templateHash)) {
    throw new NominativeBatchError("template_hash_invalid");
  }
  if (!Array.isArray(input.lines) || input.lines.length < 1 || input.lines.length > MAX_LINES) {
    throw new NominativeBatchError("lines_invalid");
  }
  if (!Array.isArray(input.exclusions) || input.exclusions.length > MAX_LINES) {
    throw new NominativeBatchError("exclusions_invalid");
  }

  const lines = (input.lines as unknown[]).map(parseLine).sort(compareLines);
  const exclusions = (input.exclusions as unknown[]).map(parseExclusion).sort((left, right) =>
    left.beneficiaryRef < right.beneficiaryRef ? -1 : left.beneficiaryRef > right.beneficiaryRef ? 1 : 0
  );

  const readyRefs = new Set<string>();
  for (const line of lines) {
    if (readyRefs.has(line.beneficiaryRef)) throw new NominativeBatchError("beneficiary_duplicated");
    readyRefs.add(line.beneficiaryRef);
  }
  const excludedRefs = new Set<string>();
  for (const exclusion of exclusions) {
    if (excludedRefs.has(exclusion.beneficiaryRef)) throw new NominativeBatchError("exclusion_duplicated");
    if (readyRefs.has(exclusion.beneficiaryRef)) throw new NominativeBatchError("beneficiary_ready_and_excluded");
    excludedRefs.add(exclusion.beneficiaryRef);
  }

  const batch: NominativeBatchInput = {
    institutionId: input.institutionId,
    sourceRef: parseBeneficiaryRef(input.sourceRef),
    schoolYear: parseSchoolYear(input.schoolYear),
    templateRef: parseBeneficiaryRef(input.templateRef),
    templateHash: input.templateHash,
    lines,
    exclusions,
  };

  const hasher = hasherFactory();
  hasher.update("nominative-batch-v1" + SEPARATOR);
  hasher.update(batch.institutionId + SEPARATOR);
  hasher.update(batch.sourceRef + SEPARATOR);
  hasher.update(batch.schoolYear + SEPARATOR);
  hasher.update(batch.templateRef + SEPARATOR);
  hasher.update(batch.templateHash + SEPARATOR);
  for (const line of lines) {
    hasher.update(line.beneficiaryRef + SEPARATOR + line.contactRef + SEPARATOR + line.valueVersion + SEPARATOR);
  }
  hasher.update("exclusions" + SEPARATOR);
  for (const exclusion of exclusions) {
    hasher.update(exclusion.beneficiaryRef + SEPARATOR + exclusion.reason + SEPARATOR);
  }

  return {
    ...batch,
    readyCount: lines.length,
    excludedCount: exclusions.length,
    scopeHash: hasher.digest("hex"),
  };
}

export type NominativeBatchDrift = {
  applicable: boolean;
  changedBeneficiaries: string[];
  removedBeneficiaries: string[];
  addedBeneficiaries: string[];
  templateChanged: boolean;
};

/**
 * Revalidation avant envoi. Un changement significatif ne remplace jamais le
 * lot approuve : il le rend inapplicable et renvoie ce qui a bouge.
 */
export function compareNominativeBatch(
  approved: FrozenNominativeBatch,
  current: FrozenNominativeBatch
): NominativeBatchDrift {
  const approvedByRef = new Map(approved.lines.map((line) => [line.beneficiaryRef, line]));
  const currentByRef = new Map(current.lines.map((line) => [line.beneficiaryRef, line]));

  const changed: string[] = [];
  const removed: string[] = [];
  const added: string[] = [];

  for (const [ref, line] of approvedByRef) {
    const now = currentByRef.get(ref);
    if (!now) {
      removed.push(ref);
      continue;
    }
    if (now.contactRef !== line.contactRef || now.valueVersion !== line.valueVersion) changed.push(ref);
  }
  for (const ref of currentByRef.keys()) {
    if (!approvedByRef.has(ref)) added.push(ref);
  }

  const templateChanged =
    approved.templateRef !== current.templateRef || approved.templateHash !== current.templateHash;

  return {
    applicable:
      !templateChanged &&
      changed.length === 0 &&
      removed.length === 0 &&
      added.length === 0 &&
      approved.scopeHash === current.scopeHash,
    changedBeneficiaries: changed.sort(),
    removedBeneficiaries: removed.sort(),
    addedBeneficiaries: added.sort(),
    templateChanged,
  };
}

export type PreparedNominativeDelivery = {
  institutionId: string;
  contactRef: string;
  beneficiaryRef: string;
  valueVersion: string;
  templateRef: string;
  channel: "email";
  status: "prepared";
  idempotencyKeyHash: string;
};

export type NominativeHmacFactory = (secret: string) => NominativeHasher;

/**
 * Cle d'idempotence NOMINATIVE.
 *
 * La cle de groupe existante (`communication-delivery-v1`) porte sur
 * (etablissement, communication, version, contactRef). Deux enfants qui
 * partagent l'adresse d'un parent produisent alors la MEME cle : la seconde
 * livraison disparait a l'insertion. Pour le nominatif on ajoute le
 * beneficiaire et la version de valeur : les deux livraisons coexistent, avec
 * chacune sa propre valeur.
 */
export function prepareNominativeDeliveryRows(input: {
  batch: FrozenNominativeBatch;
  communicationId: string;
  versionId: string;
  version: number;
  secret: string | undefined;
  hmacFactory: NominativeHmacFactory;
}): PreparedNominativeDelivery[] {
  if (typeof input.secret !== "string" || input.secret.length < 32 || input.secret.length > 512) {
    throw new NominativeBatchError("idempotency_secret_invalid");
  }
  for (const id of [input.communicationId, input.versionId]) {
    if (typeof id !== "string" || !UUID_PATTERN.test(id)) {
      throw new NominativeBatchError("communication_scope_invalid");
    }
  }
  if (!Number.isInteger(input.version) || input.version < 1 || input.version > 10000) {
    throw new NominativeBatchError("content_version_invalid");
  }

  return input.batch.lines.map((line) => {
    const hmac = input.hmacFactory(input.secret as string);
    hmac.update("communication-delivery-nominative-v1" + SEPARATOR);
    hmac.update(input.batch.institutionId + SEPARATOR);
    hmac.update(input.communicationId + SEPARATOR);
    hmac.update(input.versionId + SEPARATOR);
    hmac.update(String(input.version) + SEPARATOR);
    hmac.update(line.contactRef + SEPARATOR);
    hmac.update(line.beneficiaryRef + SEPARATOR);
    hmac.update(line.valueVersion + SEPARATOR);
    hmac.update(input.batch.scopeHash);
    return {
      institutionId: input.batch.institutionId,
      contactRef: line.contactRef,
      beneficiaryRef: line.beneficiaryRef,
      valueVersion: line.valueVersion,
      templateRef: input.batch.templateRef,
      channel: "email" as const,
      status: "prepared" as const,
      idempotencyKeyHash: hmac.digest("hex"),
    };
  });
}
