import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, count, eq, inArray, sql } from "drizzle-orm";
import { db } from "../../../../../db/index.js";
import {
  identityDirectoryAudit,
  identityDirectoryImports,
  identityDirectoryPrivateRows,
  identityDirectoryRows,
  schoolIdentities,
  schoolRelationships,
} from "../../../../../db/schema.js";
import { HttpError, supabaseAdmin } from "../../../../_shared/auth.js";
import { requireIdentityDirectoryManager } from "../../../../_shared/identity-directory.js";
import { identityDirectoryView } from "../../../../_shared/identity-directory-view.js";
import { handleApi, methodNotAllowed } from "../../../../_shared/response.js";

const RETIRABLE_STATUSES = ["review", "approved", "superseded", "rejected", "failed"];

function routeId(req: VercelRequest): string {
  const value = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (!value || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new HttpError(400, "Import invalide");
  }
  return value;
}

function retirementInput(req: VercelRequest): string {
  const body = req.body as Record<string, unknown> | undefined;
  if (body?.confirmation !== "RETIRER") {
    throw new HttpError(400, "Confirmation de retrait manquante");
  }
  if (
    typeof body.justification !== "string" ||
    body.justification.trim().length < 20 ||
    body.justification.trim().length > 1000
  ) {
    throw new HttpError(400, "Expliquez le retrait en 20 à 1 000 caractères");
  }
  return body.justification.trim();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  return handleApi(res, async () => {
    const context = await requireIdentityDirectoryManager(req);
    const id = routeId(req);
    const reason = retirementInput(req);

    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`
        select pg_advisory_xact_lock(
          hashtextextended(${context.institutionId}::text, 934821)
        )
      `);
      const [candidate] = await tx
        .select()
        .from(identityDirectoryImports)
        .where(
          and(
            eq(identityDirectoryImports.id, id),
            eq(identityDirectoryImports.institutionId, context.institutionId)
          )
        )
        .limit(1);
      if (!candidate) throw new HttpError(404, "Import introuvable");
      if (candidate.status === "retired") {
        return { import: candidate, duplicate: true };
      }
      if (candidate.status === "active") {
        throw new HttpError(409, "Activez d’abord une version de remplacement");
      }
      if (!RETIRABLE_STATUSES.includes(candidate.status)) {
        throw new HttpError(409, "Cette version est encore en cours de traitement");
      }

      const [[identityUse], [relationshipUse]] = await Promise.all([
        tx
          .select({ value: count() })
          .from(schoolIdentities)
          .where(eq(schoolIdentities.sourceImportId, id)),
        tx
          .select({ value: count() })
          .from(schoolRelationships)
          .where(eq(schoolRelationships.sourceImportId, id)),
      ]);
      const dependencyCount = Number(identityUse?.value ?? 0) + Number(relationshipUse?.value ?? 0);
      if (dependencyCount > 0) {
        throw new HttpError(
          409,
          "Cette version justifie encore des identités ou des relations. Révoquez-les avant le retrait."
        );
      }

      const { error: storageError } = await supabaseAdmin.storage
        .from(candidate.storageBucket)
        .remove([candidate.storagePath]);
      if (storageError) {
        throw new Error(`Private identity file removal failed: ${storageError.message}`);
      }

      const [deletedRows] = await tx
        .select({ value: count() })
        .from(identityDirectoryRows)
        .where(eq(identityDirectoryRows.importId, id));
      const [deletedPrivateRows] = await tx
        .select({ value: count() })
        .from(identityDirectoryPrivateRows)
        .where(eq(identityDirectoryPrivateRows.importId, id));
      await tx.delete(identityDirectoryRows).where(eq(identityDirectoryRows.importId, id));
      await tx
        .delete(identityDirectoryPrivateRows)
        .where(eq(identityDirectoryPrivateRows.importId, id));
      const retiredAt = new Date();
      const [retired] = await tx
        .update(identityDirectoryImports)
        .set({
          status: "retired",
          retiredBy: context.user.id,
          retiredAt,
          retirementReason: reason,
          checksum: null,
          validationSummary: {
            retired: true,
            privateFileRemoved: true,
            quarantineRowsRemoved: Number(deletedRows?.value ?? 0),
            encryptedRowsRemoved: Number(deletedPrivateRows?.value ?? 0),
          },
        })
        .where(
          and(
            eq(identityDirectoryImports.id, id),
            eq(identityDirectoryImports.institutionId, context.institutionId),
            inArray(identityDirectoryImports.status, RETIRABLE_STATUSES)
          )
        )
        .returning();
      if (!retired) throw new HttpError(409, "Cette version a déjà changé");

      await tx.insert(identityDirectoryAudit).values({
        institutionId: context.institutionId,
        resourceType: "import",
        resourceId: id,
        action: "retire",
        actorId: context.user.id,
        summary: {
          justification: reason,
          privateFileRemoved: true,
          quarantineRowsRemoved: Number(deletedRows?.value ?? 0),
          encryptedRowsRemoved: Number(deletedPrivateRows?.value ?? 0),
        },
      });
      return { import: retired, duplicate: false };
    });

    return { import: identityDirectoryView(result.import), duplicate: result.duplicate };
  });
}

export const config = { api: { bodyParser: { sizeLimit: "4kb" } } };
