import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, count, eq } from "drizzle-orm";
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
      reason = parseIdentityDirectoryDecisionInput(req.body, "approve").justification;
    } catch (error) {
      registryInputError(error);
    }
    const [candidate] = await db
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
    if (candidate.status === "approved") {
      const payload = { import: identityDirectoryActionView(candidate), duplicate: true };
      if (!isIdentityDirectoryActionPayload(payload, id, ["approved"])) {
        throw new HttpError(503, "La confirmation de l’approbation est invalide.");
      }
      return payload;
    }
    if (candidate.status !== "review") {
      throw new HttpError(409, "Le rapport doit être terminé avant l’approbation");
    }
    if (!candidate.rowCount || candidate.rejectedRowCount !== 0) {
      throw new HttpError(409, "Corrigez toutes les lignes refusées avant l’approbation");
    }
    const summary = candidate.validationSummary as Record<string, unknown>;
    const expectedPeople = Number(summary.personCount);
    const [vaultCount] = await db
      .select({ value: count() })
      .from(identityDirectoryPrivateRows)
      .where(eq(identityDirectoryPrivateRows.importId, id));
    if (
      !Number.isSafeInteger(expectedPeople) ||
      expectedPeople < 1 ||
      Number(vaultCount?.value ?? 0) !== expectedPeople ||
      Number(summary.encryptedPersonCount) !== expectedPeople
    ) {
      throw new HttpError(409, "Le coffre chiffré est incomplet ; relancez l’analyse du fichier");
    }

    const [approved] = await db.transaction(async (tx) => {
      const updated = await tx
        .update(identityDirectoryImports)
        .set({
          status: "approved",
          approvedBy: context.user.id,
          approvedAt: new Date(),
        })
        .where(
          and(
            eq(identityDirectoryImports.id, id),
            eq(identityDirectoryImports.institutionId, context.institutionId),
            eq(identityDirectoryImports.status, "review")
          )
        )
        .returning();
      if (!updated[0]) return [];
      await tx.insert(identityDirectoryAudit).values({
        institutionId: context.institutionId,
        resourceType: "import",
        resourceId: id,
        action: "approve",
        actorId: context.user.id,
        summary: {
          justification: reason,
          rowCount: candidate.rowCount,
          encryptedPersonCount: expectedPeople,
        },
      });
      return updated;
    });
    if (!approved) throw new HttpError(409, "Ce rapport a déjà changé");
    const payload = { import: identityDirectoryActionView(approved), duplicate: false };
    if (!isIdentityDirectoryActionPayload(payload, id, ["approved"])) {
      throw new HttpError(503, "La confirmation de l’approbation est invalide.");
    }
    return payload;
  });
}

export const config = { api: { bodyParser: { sizeLimit: "4kb" } } };
