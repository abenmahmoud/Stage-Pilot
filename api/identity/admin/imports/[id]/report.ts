import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, asc, count, eq } from "drizzle-orm";
import { db } from "../../../../../db/index.js";
import {
  identityDirectoryImports,
  identityDirectoryRows,
} from "../../../../../db/schema.js";
import { HttpError } from "../../../../_shared/auth.js";
import { requireIdentityDirectoryManager } from "../../../../_shared/identity-directory.js";
import { identityDirectoryView } from "../../../../_shared/identity-directory-view.js";
import { handleApi, methodNotAllowed } from "../../../../_shared/response.js";

function routeId(req: VercelRequest): string {
  const value = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (!value || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new HttpError(400, "Import invalide");
  }
  return value;
}

function pageNumber(value: string | string[] | undefined): number {
  const parsed = Number(Array.isArray(value) ? value[0] : value ?? 1);
  return Number.isSafeInteger(parsed) && parsed >= 1 && parsed <= 250 ? parsed : 1;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  return handleApi(res, async () => {
    const context = await requireIdentityDirectoryManager(req);
    const id = routeId(req);
    const page = pageNumber(req.query.page);
    const pageSize = 100;
    const [directoryImport] = await db
      .select()
      .from(identityDirectoryImports)
      .where(
        and(
          eq(identityDirectoryImports.id, id),
          eq(identityDirectoryImports.institutionId, context.institutionId)
        )
      )
      .limit(1);
    if (!directoryImport) throw new HttpError(404, "Import introuvable");

    const [totalResult, rows] = await Promise.all([
      db
        .select({ value: count() })
        .from(identityDirectoryRows)
        .where(eq(identityDirectoryRows.importId, id)),
      db
        .select({
          id: identityDirectoryRows.id,
          sourceSheet: identityDirectoryRows.sourceSheet,
          rowNumber: identityDirectoryRows.rowNumber,
          recordType: identityDirectoryRows.recordType,
          personRef: identityDirectoryRows.personRef,
          personType: identityDirectoryRows.personType,
          subjectPersonRef: identityDirectoryRows.subjectPersonRef,
          relationshipType: identityDirectoryRows.relationshipType,
          objectRef: identityDirectoryRows.objectRef,
          classRef: identityDirectoryRows.classRef,
          serviceCode: identityDirectoryRows.serviceCode,
          validFrom: identityDirectoryRows.validFrom,
          validUntil: identityDirectoryRows.validUntil,
          validationStatus: identityDirectoryRows.validationStatus,
          issues: identityDirectoryRows.issues,
        })
        .from(identityDirectoryRows)
        .where(eq(identityDirectoryRows.importId, id))
        .orderBy(asc(identityDirectoryRows.sourceSheet), asc(identityDirectoryRows.rowNumber))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
    ]);

    return {
      import: identityDirectoryView(directoryImport),
      rows,
      pagination: {
        page,
        pageSize,
        total: Number(totalResult[0]?.value ?? 0),
      },
    };
  });
}
