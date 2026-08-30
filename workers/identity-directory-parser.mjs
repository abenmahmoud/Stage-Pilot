import { createHash, createHmac } from "node:crypto";
import * as XLSX from "xlsx";
import { documentSecretSignals } from "./knowledge-document-secret-policy.mjs";

export const IDENTITY_DIRECTORY_MAX_BYTES = 50 * 1024 * 1024;
export const IDENTITY_DIRECTORY_MAX_ROWS = 25_000;
const MAX_COLUMNS = 24;
const MAX_CELL_LENGTH = 500;
const FORBIDDEN_SECRET_HEADER =
  /(?:^|_)(?:password|mot_de_passe|mdp|otp|token|api_key|cle_api|client_secret|secret_key|cle_secrete|private_key|cle_privee)(?:_|$)|^code_(?:[a-z0-9_]{0,24}_)?(?:ent|pronote|educonnect|academique)(?:_|$)/u;

const PERSON_TYPES = new Set(["student", "guardian", "staff"]);
const RELATIONSHIP_TYPES = new Set([
  "self",
  "guardian_of",
  "member_of",
  "teaches",
  "manages",
]);

const HEADER_ALIASES = new Map(
  Object.entries({
    record_type: "record_type",
    type_ligne: "record_type",
    person_ref: "person_ref",
    reference_personne: "person_ref",
    person_type: "person_type",
    type_personne: "person_type",
    first_name: "first_name",
    prenom: "first_name",
    last_name: "last_name",
    nom: "last_name",
    academic_email: "academic_email",
    email_academique: "academic_email",
    personal_email: "personal_email",
    email_personnel: "personal_email",
    phone: "phone",
    telephone: "phone",
    class_ref: "class_ref",
    reference_classe: "class_ref",
    service_code: "service_code",
    code_service: "service_code",
    active_from: "active_from",
    actif_depuis: "active_from",
    active_until: "active_until",
    actif_jusquau: "active_until",
    subject_person_ref: "subject_person_ref",
    reference_sujet: "subject_person_ref",
    relationship_type: "relationship_type",
    type_relation: "relationship_type",
    object_ref: "object_ref",
    reference_objet: "object_ref",
    valid_from: "valid_from",
    valide_depuis: "valid_from",
    valid_until: "valid_until",
    valide_jusquau: "valid_until",
  })
);

const ALLOWED_HEADERS = new Set(HEADER_ALIASES.values());

export class IdentityDirectoryParseError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "IdentityDirectoryParseError";
    this.code = code;
  }
}

function normalizeHeader(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function assertNoForbiddenDirectorySecrets(matrix) {
  const headers = Array.isArray(matrix[0]) ? matrix[0] : [];
  if (headers.some((header) => FORBIDDEN_SECRET_HEADER.test(normalizeHeader(header)))) {
    throw new IdentityDirectoryParseError(
      "secret_forbidden",
      "Le fichier contient une donnée secrète interdite"
    );
  }

  for (const row of matrix) {
    const cells = Array.isArray(row) ? row : [row];
    for (const cell of cells) {
      if (documentSecretSignals(cell).length > 0) {
        throw new IdentityDirectoryParseError(
          "secret_forbidden",
          "Le fichier contient une donnée secrète interdite"
        );
      }
    }
  }
}

function normalizeText(value) {
  return String(value ?? "").normalize("NFKC").trim();
}

function boundedText(value, column, issues) {
  const normalized = normalizeText(value);
  if (normalized.length > MAX_CELL_LENGTH) {
    issues.push({ severity: "error", code: "value_too_long", column });
    return normalized.slice(0, MAX_CELL_LENGTH);
  }
  return normalized;
}

function issue(issues, severity, code, column) {
  issues.push({ severity, code, column });
}

function normalizeEmail(value, column, issues) {
  const email = boundedText(value, column, issues).toLowerCase();
  if (!email) return "";
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    issue(issues, "error", "invalid_email", column);
    return "";
  }
  return email;
}

function normalizePhone(value, issues) {
  let phone = boundedText(value, "phone", issues).replace(/[\s().-]/g, "");
  if (!phone) return "";
  if (phone.startsWith("00")) phone = `+${phone.slice(2)}`;
  if (/^0\d{9}$/.test(phone)) phone = `+33${phone.slice(1)}`;
  if (!phone.startsWith("+")) phone = `+${phone}`;
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
    issue(issues, "error", "invalid_phone", "phone");
    return "";
  }
  return phone;
}

function normalizeRef(value, column, issues, required = true) {
  const ref = boundedText(value, column, issues);
  if (!ref) {
    if (required) issue(issues, "error", "missing_value", column);
    return "";
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{2,119}$/.test(ref)) {
    issue(issues, "error", "invalid_reference", column);
    return "";
  }
  return ref;
}

function normalizeDate(value, column, issues, required) {
  const date = boundedText(value, column, issues);
  if (!date) {
    if (required) issue(issues, "error", "missing_value", column);
    return null;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    issue(issues, "error", "invalid_date", column);
    return null;
  }
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    issue(issues, "error", "invalid_date", column);
    return null;
  }
  return date;
}

function keyedHash(value, pepper) {
  if (!value) return null;
  return createHmac("sha256", pepper).update(value).digest("hex");
}

function rowFingerprint(row) {
  const stable = {
    recordType: row.recordType,
    personRef: row.personRef,
    personType: row.personType,
    subjectPersonRef: row.subjectPersonRef,
    relationshipType: row.relationshipType,
    objectRef: row.objectRef,
    classRef: row.classRef,
    serviceCode: row.serviceCode,
    academicEmailHash: row.academicEmailHash,
    personalEmailHash: row.personalEmailHash,
    phoneHash: row.phoneHash,
    validFrom: row.validFrom,
    validUntil: row.validUntil,
  };
  return createHash("sha256").update(JSON.stringify(stable)).digest("hex");
}

function addDuplicateIssue(rows, indexes, severity, code, column) {
  if (indexes.length < 2) return;
  for (const index of indexes) issue(rows[index].issues, severity, code, column);
}

function statusFromIssues(issues) {
  if (issues.some((entry) => entry.severity === "error")) return "rejected";
  if (issues.some((entry) => entry.severity === "warning")) return "warning";
  return "valid";
}

function parsePerson(record, base, pepper) {
  const issues = base.issues;
  const personRef = normalizeRef(record.person_ref, "person_ref", issues);
  const personType = boundedText(record.person_type, "person_type", issues).toLowerCase();
  if (!PERSON_TYPES.has(personType)) issue(issues, "error", "invalid_person_type", "person_type");

  const firstName = boundedText(record.first_name, "first_name", issues);
  const lastName = boundedText(record.last_name, "last_name", issues);
  const academicEmail = normalizeEmail(record.academic_email, "academic_email", issues);
  const personalEmail = normalizeEmail(record.personal_email, "personal_email", issues);
  const phone = normalizePhone(record.phone, issues);
  const classRef = normalizeRef(record.class_ref, "class_ref", issues, false);
  const serviceCode = normalizeRef(record.service_code, "service_code", issues, false);
  const validFrom = normalizeDate(record.active_from, "active_from", issues, true);
  const validUntil = normalizeDate(record.active_until, "active_until", issues, false);

  if (validFrom && validUntil && validUntil < validFrom) {
    issue(issues, "error", "invalid_date_range", "active_until");
  }
  if (!academicEmail && !personalEmail && !phone) {
    issue(issues, "warning", "no_contact_factor", "academic_email");
  }
  if (personType === "student" && !classRef) {
    issue(issues, "warning", "student_without_class", "class_ref");
  }
  if (personType === "staff" && !serviceCode) {
    issue(issues, "warning", "staff_without_service", "service_code");
  }

  return {
    ...base,
    recordType: "person",
    personRef,
    personType: PERSON_TYPES.has(personType) ? personType : null,
    subjectPersonRef: null,
    relationshipType: null,
    objectRef: null,
    classRef: classRef || null,
    serviceCode: serviceCode || null,
    academicEmailHash: keyedHash(academicEmail, pepper),
    personalEmailHash: keyedHash(personalEmail, pepper),
    phoneHash: keyedHash(phone, pepper),
    validFrom,
    validUntil,
    privatePayload: {
      firstName,
      lastName,
      academicEmail,
      personalEmail,
      phone,
    },
  };
}

function parseRelationship(record, base) {
  const issues = base.issues;
  const subjectPersonRef = normalizeRef(
    record.subject_person_ref,
    "subject_person_ref",
    issues
  );
  const relationshipType = boundedText(
    record.relationship_type,
    "relationship_type",
    issues
  ).toLowerCase();
  if (!RELATIONSHIP_TYPES.has(relationshipType)) {
    issue(issues, "error", "invalid_relationship_type", "relationship_type");
  }
  const objectRef = normalizeRef(record.object_ref, "object_ref", issues);
  const validFrom = normalizeDate(record.valid_from, "valid_from", issues, true);
  const validUntil = normalizeDate(record.valid_until, "valid_until", issues, false);
  if (validFrom && validUntil && validUntil < validFrom) {
    issue(issues, "error", "invalid_date_range", "valid_until");
  }
  if (relationshipType === "self" && subjectPersonRef && objectRef !== subjectPersonRef) {
    issue(issues, "error", "self_reference_mismatch", "object_ref");
  }

  return {
    ...base,
    recordType: "relationship",
    personRef: null,
    personType: null,
    subjectPersonRef,
    relationshipType: RELATIONSHIP_TYPES.has(relationshipType) ? relationshipType : null,
    objectRef,
    classRef: null,
    serviceCode: null,
    academicEmailHash: null,
    personalEmailHash: null,
    phoneHash: null,
    validFrom,
    validUntil,
  };
}

function inferredRecordType(sheetName) {
  const name = normalizeHeader(sheetName);
  if (["personnes", "persons", "people", "identites"].includes(name)) return "person";
  if (["relations", "relationships", "liens"].includes(name)) return "relationship";
  return "";
}

function sheetRecords(sheet, sheetName) {
  const ref = sheet["!ref"];
  if (!ref) return [];
  const range = XLSX.utils.decode_range(ref);
  const rowCount = range.e.r - range.s.r + 1;
  const columnCount = range.e.c - range.s.c + 1;
  if (rowCount > IDENTITY_DIRECTORY_MAX_ROWS + 1) {
    throw new IdentityDirectoryParseError("too_many_rows", "Le fichier contient trop de lignes");
  }
  if (columnCount > MAX_COLUMNS) {
    throw new IdentityDirectoryParseError("too_many_columns", "Le fichier contient trop de colonnes");
  }
  for (const [address, cell] of Object.entries(sheet)) {
    if (!address.startsWith("!") && cell && typeof cell === "object" && "f" in cell) {
      throw new IdentityDirectoryParseError(
        "formula_not_allowed",
        `La feuille ${sheetName} contient une formule interdite`
      );
    }
  }

  const matrix = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    raw: false,
    blankrows: false,
  });
  if (matrix.length === 0) return [];
  assertNoForbiddenDirectorySecrets(matrix);
  const rawHeaders = matrix[0];
  const headers = rawHeaders.map((header) => {
    const normalized = normalizeHeader(header);
    const canonical = HEADER_ALIASES.get(normalized);
    if (!canonical || !ALLOWED_HEADERS.has(canonical)) {
      throw new IdentityDirectoryParseError(
        "unsupported_column",
        `Colonne non autorisée dans ${sheetName}: ${String(header).slice(0, 80)}`
      );
    }
    return canonical;
  });
  if (new Set(headers).size !== headers.length) {
    throw new IdentityDirectoryParseError(
      "duplicate_column",
      `La feuille ${sheetName} contient deux colonnes équivalentes`
    );
  }
  const inferred = inferredRecordType(sheetName);
  if (!inferred && !headers.includes("record_type")) {
    throw new IdentityDirectoryParseError(
      "missing_record_type",
      `Ajoutez la colonne record_type dans la feuille ${sheetName}`
    );
  }
  return matrix.slice(1).map((values, index) => {
    const record = {};
    for (let column = 0; column < headers.length; column += 1) {
      record[headers[column]] = values[column] ?? "";
    }
    if (!record.record_type) record.record_type = inferred;
    return { record, rowNumber: index + 2, sheetName };
  });
}

function countIssueCodes(rows) {
  const counts = {};
  for (const row of rows) {
    for (const entry of row.issues) counts[entry.code] = (counts[entry.code] ?? 0) + 1;
  }
  return counts;
}

export function parseIdentityDirectoryBytes({ bytes, fileName, contactPepper }) {
  if (!Buffer.isBuffer(bytes)) {
    throw new IdentityDirectoryParseError("invalid_buffer", "Fichier illisible");
  }
  if (bytes.length < 1 || bytes.length > IDENTITY_DIRECTORY_MAX_BYTES) {
    throw new IdentityDirectoryParseError("invalid_size", "Taille de fichier invalide");
  }
  if (typeof contactPepper !== "string" || contactPepper.length < 32) {
    throw new IdentityDirectoryParseError(
      "contact_pepper_missing",
      "La clé privée de rapprochement est absente"
    );
  }
  const extension = String(fileName).split(".").pop()?.toLowerCase();
  if (extension !== "csv" && extension !== "xlsx") {
    throw new IdentityDirectoryParseError("unsupported_format", "Format non accepté");
  }
  if (extension === "xlsx" && !bytes.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))) {
    throw new IdentityDirectoryParseError("invalid_signature", "Signature Excel invalide");
  }
  if (extension === "csv" && bytes.includes(0)) {
    throw new IdentityDirectoryParseError("invalid_signature", "Signature CSV invalide");
  }
  if (extension === "xlsx" && bytes.includes(Buffer.from("vbaProject.bin"))) {
    throw new IdentityDirectoryParseError("macro_not_allowed", "Les macros sont interdites");
  }

  let workbook;
  try {
    workbook = XLSX.read(bytes, {
      type: "buffer",
      raw: false,
      cellFormula: true,
      cellHTML: false,
      cellNF: false,
      cellDates: false,
      bookVBA: false,
      WTF: false,
    });
  } catch {
    throw new IdentityDirectoryParseError("unreadable_workbook", "Le tableau est illisible");
  }
  if (workbook.SheetNames.length < 1 || workbook.SheetNames.length > 4) {
    throw new IdentityDirectoryParseError("invalid_sheet_count", "Nombre de feuilles invalide");
  }

  const records = workbook.SheetNames.flatMap((sheetName) =>
    sheetRecords(workbook.Sheets[sheetName], sheetName)
  );
  if (records.length < 1 || records.length > IDENTITY_DIRECTORY_MAX_ROWS) {
    throw new IdentityDirectoryParseError("invalid_row_count", "Nombre de lignes invalide");
  }

  const rows = records.map(({ record, rowNumber, sheetName }) => {
    const recordType = boundedText(record.record_type, "record_type", []).toLowerCase();
    const base = { sheetName: sheetName.slice(0, 80), rowNumber, issues: [] };
    if (recordType === "person") return parsePerson(record, base, contactPepper);
    if (recordType === "relationship") return parseRelationship(record, base);
    const parsed = parseRelationship(record, base);
    parsed.recordType = "unknown";
    issue(parsed.issues, "error", "invalid_record_type", "record_type");
    return parsed;
  });

  const personIndexes = new Map();
  const relationshipIndexes = new Map();
  const contactIndexes = {
    academic: new Map(),
    personal: new Map(),
    phone: new Map(),
  };
  rows.forEach((row, index) => {
    if (row.recordType === "person" && row.personRef) {
      const values = personIndexes.get(row.personRef) ?? [];
      values.push(index);
      personIndexes.set(row.personRef, values);
    }
    if (row.recordType === "relationship" && row.subjectPersonRef && row.objectRef) {
      const key = `${row.subjectPersonRef}|${row.relationshipType}|${row.objectRef}|${row.validFrom}`;
      const values = relationshipIndexes.get(key) ?? [];
      values.push(index);
      relationshipIndexes.set(key, values);
    }
    for (const [kind, property] of [
      ["academic", "academicEmailHash"],
      ["personal", "personalEmailHash"],
      ["phone", "phoneHash"],
    ]) {
      if (!row[property]) continue;
      const values = contactIndexes[kind].get(row[property]) ?? [];
      values.push(index);
      contactIndexes[kind].set(row[property], values);
    }
  });
  for (const indexes of personIndexes.values()) {
    addDuplicateIssue(rows, indexes, "error", "duplicate_person_ref", "person_ref");
  }
  for (const indexes of relationshipIndexes.values()) {
    addDuplicateIssue(rows, indexes, "error", "duplicate_relationship", "relationship_type");
  }
  for (const indexes of contactIndexes.academic.values()) {
    addDuplicateIssue(rows, indexes, "error", "duplicate_academic_email", "academic_email");
  }
  for (const indexes of contactIndexes.personal.values()) {
    addDuplicateIssue(rows, indexes, "warning", "shared_personal_email", "personal_email");
  }
  for (const indexes of contactIndexes.phone.values()) {
    addDuplicateIssue(rows, indexes, "warning", "shared_phone", "phone");
  }

  const knownPeople = new Set(
    rows.filter((row) => row.recordType === "person" && row.personRef).map((row) => row.personRef)
  );
  for (const row of rows) {
    if (row.recordType !== "relationship") continue;
    if (row.subjectPersonRef && !knownPeople.has(row.subjectPersonRef)) {
      issue(row.issues, "error", "unknown_subject_ref", "subject_person_ref");
    }
    if (
      ["self", "guardian_of"].includes(row.relationshipType) &&
      row.objectRef &&
      !knownPeople.has(row.objectRef)
    ) {
      issue(row.issues, "error", "unknown_object_ref", "object_ref");
    }
  }

  for (const row of rows) {
    row.validationStatus = statusFromIssues(row.issues);
    row.fingerprint = rowFingerprint(row);
  }
  const privateRows = rows
    .filter(
      (row) =>
        row.recordType === "person" &&
        row.personRef &&
        row.validationStatus !== "rejected" &&
        row.privatePayload
    )
    .map((row) => ({ personRef: row.personRef, value: row.privatePayload }));
  for (const row of rows) delete row.privatePayload;
  const rejected = rows.filter((row) => row.validationStatus === "rejected").length;
  const warnings = rows.filter((row) => row.validationStatus === "warning").length;
  const people = rows.filter((row) => row.recordType === "person").length;
  const relationships = rows.filter((row) => row.recordType === "relationship").length;

  return {
    checksum: createHash("sha256").update(bytes).digest("hex"),
    rows,
    privateRows,
    summary: {
      parserVersion: 1,
      sheets: workbook.SheetNames.map((name) => name.slice(0, 80)),
      rowCount: rows.length,
      personCount: people,
      relationshipCount: relationships,
      validRowCount: rows.length - rejected,
      rejectedRowCount: rejected,
      warningRowCount: warnings,
      issueCounts: countIssueCodes(rows),
      containsRawContacts: false,
      readyForApproval: rejected === 0,
    },
  };
}
