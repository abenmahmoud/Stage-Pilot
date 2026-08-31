import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, count, eq, sql } from "drizzle-orm";
import { db } from "../../../../../db/index.js";
import {
  identityDirectoryAudit,
  identityDirectoryImports,
  identityDirectoryPrivateRows,
} from "../../../../../db/schema.js";
import { parseIdentityDirectoryDecisionInput } from "../../../../../shared/identity-directory-admin-input.js";
import { isIdentityDirectoryActionPayload } from "../../../../../shared/identity-directory-admin-payload-policy.js";
import { HttpError } from "../../../../_shared/auth.js";
import { requireIdentityDirectoryManager } from "../../../../_shared/identity-directory.js";
import { identityDirectoryActionView } from "../../../../_shared/identity-directory-view.js";
import { registryInputError } from "../../../../_shared/knowledge-registry.js";
import { handleApi, methodNotAllowed } from "../../../../_shared/response.js";

function routeId(req: VercelRequest): string {
  const value = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (!value || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new HttpError(400, "Import invalide");
  }
  return value;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  return handleApi(res, async () => {
    const context = await requireIdentityDirectoryManager(req);
    const id = routeId(req);
    let reason;
    try {
      reason = parseIdentityDirectoryDecisionInput(req.body, "activate").justification;
    } catch (error) {
      registryInputError(error);
    }
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
      if (candidate.status === "active") {
        return { import: candidate, duplicate: true };
      }
      if (candidate.status !== "approved") {
        throw new HttpError(409, "Cette version doit d’abord être approuvée");
      }
      const summary = candidate.validationSummary as Record<string, unknown>;
      const expectedPeople = Number(summary.personCount);
      const [vaultCount] = await tx
        .select({ value: count() })
        .from(identityDirectoryPrivateRows)
        .where(eq(identityDirectoryPrivateRows.importId, id));
      if (
        !Number.isSafeInteger(expectedPeople) ||
        expectedPeople < 1 ||
        Number(vaultCount?.value ?? 0) !== expectedPeople ||
        Number(summary.encryptedPersonCount) !== expectedPeople
      ) {
        throw new HttpError(409, "Le coffre chiffré est incomplet ; activation refusée");
      }
      const previous = await tx
        .select({ id: identityDirectoryImports.id })
        .from(identityDirectoryImports)
        .where(
          and(
            eq(identityDirectoryImports.institutionId, context.institutionId),
            eq(identityDirectoryImports.status, "active")
          )
        );
      if (previous.length > 0) {
        await tx
          .update(identityDirectoryImports)
          .set({ status: "superseded" })
          .where(
            and(
              eq(identityDirectoryImports.institutionId, context.institutionId),
              eq(identityDirectoryImports.status, "active")
            )
          );
        await tx.insert(identityDirectoryAudit).values(
          previous.map((entry) => ({
            institutionId: context.institutionId,
            resourceType: "import" as const,
            resourceId: entry.id,
            action: "supersede" as const,
            actorId: context.user.id,
            summary: { replacementImportId: id },
          }))
        );
      }
      const [updated] = await tx
        .update(identityDirectoryImports)
        .set({ status: "active", activatedAt: new Date() })
        .where(
          and(
            eq(identityDirectoryImports.id, id),
            eq(identityDirectoryImports.institutionId, context.institutionId),
            eq(identityDirectoryImports.status, "approved")
          )
        )
        .returning();
      if (!updated) throw new HttpError(409, "Cette version a déjà changé");
      await tx.insert(identityDirectoryAudit).values({
        institutionId: context.institutionId,
        resourceType: "import",
        resourceId: id,
        action: "activate",
        actorId: context.user.id,
        summary: {
          justification: reason,
          replacedCount: previous.length,
          encryptedPersonCount: expectedPeople,
        },
      });
      return { import: updated, duplicate: false };
    });
    const payload = {
      import: identityDirectoryActionView(result.import),
      duplicate: result.duplicate,
    };
    if (!isIdentityDirectoryActionPayload(payload, id, ["active"])) {
      throw new HttpError(503, "La confirmation de l’activation est invalide.");
    }
    return payload;
  });
}

export const config = { api: { bodyParser: { sizeLimit: "4kb" } } };
