import { createHash, randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../../db/index.js";
import {
  identityDirectoryImports,
  identityDirectoryRows,
  personAttributeEvents,
  personAttributeImports,
  personAttributeRows,
} from "../../db/schema.js";
import { encryptPersonAttributeValue } from "../../shared/person-attribute-crypto.js";
import { parsePersonAttributeCsv } from "../../shared/person-attribute-input.js";
import { HttpError } from "./auth.js";
import type { DepotMultipartPayload } from "./depot-multipart.js";

export async function receiveDepotAttributs(params: {
  institutionId: string;
  actorId: string;
  payload: DepotMultipartPayload;
}): Promise<{ importId: string; status: string; rowCount: number; duplicate: boolean }> {
  const file = params.payload.files.fichier;
  if (!file || params.payload.files.rapport || !/\.csv$/i.test(file.fileName) || file.mimeType !== "text/csv") {
    throw new HttpError(415, "Les attributs doivent être envoyés dans un unique fichier CSV");
  }
  let rows;
  try {
    rows = parsePersonAttributeCsv(file.bytes);
  } catch {
    throw new HttpError(400, "Le fichier d'attributs nominatifs est invalide");
  }
  const checksum = createHash("sha256").update(file.bytes).digest("hex");
  const [existing] = await db
    .select({
      id: personAttributeImports.id,
      status: personAttributeImports.status,
      rowCount: personAttributeImports.rowCount,
    })
    .from(personAttributeImports)
    .where(and(
      eq(personAttributeImports.institutionId, params.institutionId),
      eq(personAttributeImports.checksum, checksum)
    ))
    .limit(1);
  if (existing) {
    return { importId: existing.id, status: existing.status, rowCount: existing.rowCount, duplicate: true };
  }

  const refs = [...new Set(rows.map((row) => row.personRef))];
  const [activeDirectory] = await db
    .select({ id: identityDirectoryImports.id })
    .from(identityDirectoryImports)
    .where(and(
      eq(identityDirectoryImports.institutionId, params.institutionId),
      eq(identityDirectoryImports.status, "active")
    ))
    .limit(1);
  if (!activeDirectory) {
    throw new HttpError(409, "Aucun annuaire actif ne permet de vérifier ces attributs");
  }
  const known = await db
    .select({ personRef: identityDirectoryRows.personRef })
    .from(identityDirectoryRows)
    .where(and(
      eq(identityDirectoryRows.institutionId, params.institutionId),
      eq(identityDirectoryRows.importId, activeDirectory.id),
      eq(identityDirectoryRows.recordType, "person"),
      inArray(identityDirectoryRows.personRef, refs)
    ));
  const knownRefs = new Set(known.map((row) => row.personRef).filter(Boolean));
  if (knownRefs.size !== refs.length) {
    throw new HttpError(409, "Certains attributs ne correspondent pas à l'annuaire actif");
  }

  const importId = randomUUID();
  const encryptedRows = rows.map((row) => {
    const id = randomUUID();
    const envelope = encryptPersonAttributeValue({
      value: row.value,
      institutionId: params.institutionId,
      importId,
      rowId: id,
      personRef: row.personRef,
      attributeKey: row.attributeKey,
    });
    return {
      id,
      institutionId: params.institutionId,
      importId,
      personRef: row.personRef,
      attributeKey: row.attributeKey,
      validFrom: row.validFrom,
      validUntil: row.validUntil,
      source: row.source,
      ...envelope,
    };
  });
  try {
    await db.transaction(async (tx) => {
      await tx.insert(personAttributeImports).values({
        id: importId,
        institutionId: params.institutionId,
        directoryImportId: activeDirectory.id,
        checksum,
        originalName: file.fileName,
        sizeBytes: file.bytes.length,
        rowCount: encryptedRows.length,
        status: "review",
        uploadedBy: params.actorId,
      });
      for (let offset = 0; offset < encryptedRows.length; offset += 500) {
        await tx.insert(personAttributeRows).values(encryptedRows.slice(offset, offset + 500));
      }
      await tx.insert(personAttributeEvents).values({
        institutionId: params.institutionId,
        importId,
        action: "receive",
        actorId: params.actorId,
        summary: {
          rowCount: encryptedRows.length,
          checksum,
          source: "depot_lycee",
          directoryImportId: activeDirectory.id,
        },
      });
    });
  } catch (error) {
    const [duplicate] = await db
      .select({
        id: personAttributeImports.id,
        status: personAttributeImports.status,
        rowCount: personAttributeImports.rowCount,
      })
      .from(personAttributeImports)
      .where(and(
        eq(personAttributeImports.institutionId, params.institutionId),
        eq(personAttributeImports.checksum, checksum)
      ))
      .limit(1);
    if (duplicate) {
      return { importId: duplicate.id, status: duplicate.status, rowCount: duplicate.rowCount, duplicate: true };
    }
    throw error;
  }
  return { importId, status: "review", rowCount: encryptedRows.length, duplicate: false };
}
