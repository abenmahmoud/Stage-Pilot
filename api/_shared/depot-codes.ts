import {
  constants,
  createDecipheriv,
  createPrivateKey,
  privateDecrypt,
} from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../../db/index.js";
import {
  codeVaultAssignments,
  codeVaultPrivateRows,
  identityDirectoryImports,
  identityDirectoryRows,
} from "../../db/schema.js";
import { getOrCreateVaultAssignment } from "./code-vault-assignment.js";
import { writeVaultCodeValue } from "./code-vault-write.js";
import { HttpError } from "./auth.js";
import type { DepotMultipartPayload } from "./depot-multipart.js";
import type { VaultService } from "../../shared/code-vault-policy.js";

const MAGIC = Buffer.from("LGC1", "ascii");
const AAD = Buffer.from("lyceegest-codes-v1", "ascii");
const EXPECTED_HEADERS = [
  "reference_personne",
  "type_code",
  "identifiant",
  "code",
  "genere_le",
];
const MAX_CODE_ROWS = 25_000;

export type DepotCodeRow = {
  personRef: string;
  service: VaultService;
  identifier: string;
  code: string;
  generatedAt: string;
  schoolYear: string;
};

function privateKeyFromEnvironment(env: NodeJS.ProcessEnv) {
  const direct = env.LYCEEGEST_CODES_PRIVATE_KEY_PEM?.trim();
  const encoded = env.LYCEEGEST_CODES_PRIVATE_KEY_PEM_BASE64?.trim();
  try {
    const pem = direct || (encoded ? Buffer.from(encoded, "base64").toString("utf8") : "");
    if (!pem.includes("PRIVATE KEY")) throw new Error("missing");
    return createPrivateKey(pem);
  } catch {
    throw new HttpError(503, "La clé privée du coffre n'est pas configurée");
  }
}

export function decryptDepotCodeBundle(
  bytes: Buffer,
  env: NodeJS.ProcessEnv = process.env
): Buffer {
  if (!Buffer.isBuffer(bytes) || bytes.length < 4 + 2 + 256 + 12 + 16 || bytes.length > 4 * 1024 * 1024) {
    throw new HttpError(400, "Le fichier chiffré de codes est invalide");
  }
  if (!bytes.subarray(0, 4).equals(MAGIC)) {
    throw new HttpError(400, "Le format chiffré des codes n'est pas reconnu");
  }
  const wrappedLength = bytes.readUInt16BE(4);
  const wrappedStart = 6;
  const nonceStart = wrappedStart + wrappedLength;
  const ciphertextStart = nonceStart + 12;
  if (wrappedLength < 256 || wrappedLength > 1024 || ciphertextStart + 16 >= bytes.length) {
    throw new HttpError(400, "Le fichier chiffré de codes est invalide");
  }
  try {
    const aesKey = privateDecrypt(
      {
        key: privateKeyFromEnvironment(env),
        padding: constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: "sha256",
      },
      bytes.subarray(wrappedStart, nonceStart)
    );
    if (aesKey.length !== 32) throw new Error("key_length");
    const encrypted = bytes.subarray(ciphertextStart);
    const authTag = encrypted.subarray(encrypted.length - 16);
    const ciphertext = encrypted.subarray(0, encrypted.length - 16);
    const decipher = createDecipheriv("aes-256-gcm", aesKey, bytes.subarray(nonceStart, ciphertextStart));
    decipher.setAAD(AAD);
    decipher.setAuthTag(authTag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    aesKey.fill(0);
    return plaintext;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, "Le fichier chiffré de codes ne peut pas être déchiffré");
  }
}

function csvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"' && cell === "") quoted = true;
    else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell.endsWith("\r") ? cell.slice(0, -1) : cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }
  if (quoted) throw new HttpError(400, "Le CSV chiffré est invalide");
  if (cell || row.length) {
    row.push(cell.endsWith("\r") ? cell.slice(0, -1) : cell);
    rows.push(row);
  }
  return rows;
}

function serviceOf(value: string): VaultService {
  const normalized = value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  if (["ent", "activation_ent", "premiere_connexion_ent"].includes(normalized)) return "ent";
  if (["koxo", "session", "session_reseau", "code_session"].includes(normalized)) return "koxo";
  if (["cantine", "badge_cantine", "badge"].includes(normalized)) return "cantine";
  throw new HttpError(400, "Un type de code n'est pas pris en charge");
}

function schoolYearOf(generatedAt: string): string {
  const date = new Date(generatedAt);
  if (!Number.isFinite(date.getTime())) throw new HttpError(400, "Une date de génération est invalide");
  const year = date.getUTCFullYear();
  const start = date.getUTCMonth() >= 7 ? year : year - 1;
  return `${start}-${start + 1}`;
}

function printable(value: string, min: number, max: number): string | null {
  const clean = value.normalize("NFKC").trim();
  return clean.length >= min && clean.length <= max && /^[\x20-\x7e]+$/.test(clean) ? clean : null;
}

export function parseDecryptedDepotCodes(bytes: Buffer, requestedSchoolYear = ""): DepotCodeRow[] {
  if (!Buffer.isBuffer(bytes) || bytes.length < 1 || bytes.includes(0)) {
    throw new HttpError(400, "Le contenu chiffré des codes est invalide");
  }
  const text = bytes.toString("utf8");
  if (text.includes("\uFFFD")) throw new HttpError(400, "Le CSV chiffré doit être encodé en UTF-8");
  const matrix = csvRows(text);
  if (matrix.length < 2 || matrix.length > MAX_CODE_ROWS + 1) {
    throw new HttpError(400, "Le nombre de codes est invalide");
  }
  if (
    matrix[0].length !== EXPECTED_HEADERS.length
    || matrix[0].some((value, index) => value.trim() !== EXPECTED_HEADERS[index])
  ) throw new HttpError(400, "Les colonnes du fichier chiffré sont invalides");
  if (requestedSchoolYear && !/^20\d{2}-20\d{2}$/.test(requestedSchoolYear)) {
    throw new HttpError(400, "L'année scolaire est invalide");
  }
  const seen = new Set<string>();
  return matrix.slice(1).map((values) => {
    if (values.length !== EXPECTED_HEADERS.length) throw new HttpError(400, "Une ligne de codes est invalide");
    const personRef = printable(values[0], 4, 200);
    const identifier = printable(values[2], 1, 40);
    const code = printable(values[3], 4, 60);
    const generatedAt = values[4].trim();
    if (!personRef || !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(personRef) || !identifier || !code) {
      throw new HttpError(400, "Une ligne de codes est invalide");
    }
    const service = serviceOf(values[1]);
    const schoolYear = requestedSchoolYear || schoolYearOf(generatedAt);
    if (requestedSchoolYear && schoolYearOf(generatedAt) !== requestedSchoolYear) {
      throw new HttpError(400, "Une date de code ne correspond pas à l'année scolaire annoncée");
    }
    const key = `${personRef}:${service}:${schoolYear}`;
    if (seen.has(key)) throw new HttpError(400, "Le fichier contient une attribution de code en double");
    seen.add(key);
    return { personRef, service, identifier, code, generatedAt, schoolYear };
  });
}

function rowsOf<T>(value: unknown): T[] {
  return Array.from(value as unknown as T[]);
}

export async function receiveDepotCodes(params: {
  institutionId: string;
  payload: DepotMultipartPayload;
}): Promise<{ accepted: number; alreadyPresent: number }> {
  const file = params.payload.files.fichier;
  if (!file || params.payload.files.rapport) {
    throw new HttpError(400, "Le champ fichier est obligatoire et unique pour les codes");
  }
  if (!/\.enc$/i.test(file.fileName)) {
    throw new HttpError(415, "Les codes doivent être envoyés dans un fichier .enc chiffré");
  }
  const plaintext = decryptDepotCodeBundle(file.bytes);
  let rows: DepotCodeRow[];
  try {
    rows = parseDecryptedDepotCodes(plaintext, params.payload.fields.annee_scolaire);
  } finally {
    plaintext.fill(0);
  }
  const refs = [...new Set(rows.map((row) => row.personRef))];
  const known = await db
    .select({ personRef: identityDirectoryRows.personRef })
    .from(identityDirectoryRows)
    .innerJoin(
      identityDirectoryImports,
      and(
        eq(identityDirectoryImports.id, identityDirectoryRows.importId),
        eq(identityDirectoryImports.institutionId, identityDirectoryRows.institutionId)
      )
    )
    .where(and(
      eq(identityDirectoryRows.institutionId, params.institutionId),
      eq(identityDirectoryImports.status, "active"),
      eq(identityDirectoryRows.recordType, "person"),
      inArray(identityDirectoryRows.personRef, refs)
    ));
  const knownRefs = new Set(known.map((row) => row.personRef).filter(Boolean));
  if (knownRefs.size !== refs.length) {
    throw new HttpError(409, "Certains codes ne correspondent pas à l'annuaire actif");
  }

  return db.transaction(async (tx) => {
    let accepted = 0;
    let alreadyPresent = 0;
    for (const row of rows) {
      const assignment = await getOrCreateVaultAssignment(tx, {
        institutionId: params.institutionId,
        personRef: row.personRef,
        service: row.service,
        schoolYear: row.schoolYear,
        version: 1,
      });
      const existing = await tx
        .select({ id: codeVaultPrivateRows.id })
        .from(codeVaultPrivateRows)
        .innerJoin(
          codeVaultAssignments,
          and(
            eq(codeVaultAssignments.id, codeVaultPrivateRows.assignmentId),
            eq(codeVaultAssignments.institutionId, codeVaultPrivateRows.institutionId)
          )
        )
        .where(and(
          eq(codeVaultPrivateRows.institutionId, params.institutionId),
          eq(codeVaultPrivateRows.assignmentId, assignment.id)
        ))
        .limit(1);
      if (existing[0]) {
        alreadyPresent += 1;
        continue;
      }
      await writeVaultCodeValue(tx, {
        assignmentId: assignment.id,
        institutionId: params.institutionId,
        value: `Identifiant : ${row.identifier} | Code : ${row.code}`,
      });
      accepted += 1;
    }
    return { accepted, alreadyPresent };
  });
}
