import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, count, eq, sql } from "drizzle-orm";
import { db } from "../../../../../db/index.js";
import {
  identityDirectoryImports,
  personAttributeEvents,
  personAttributeImports,
  personAttributeRows,
} from "../../../../../db/schema.js";
import { parseIdentityDirectoryDecisionInput } from "../../../../../shared/identity-directory-admin-input.js";
import { isPersonAttributeActionPayload } from "../../../../../shared/person-attribute-admin-payload-policy.js";
import { HttpError } from "../../../../_shared/auth.js";
import { requireIdentityDirectoryManager } from "../../../../_shared/identity-directory.js";
import { registryInputError } from "../../../../_shared/knowledge-registry.js";
import { personAttributeImportView } from "../../../../_shared/person-attribute-view.js";
import { handleApi, methodNotAllowed } from "../../../../_shared/response.js";

function routeId(req: VercelRequest): string {
  const value = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (!value || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new HttpError(400, "Import invalide");
  }
  return value;
}

export async function activatePersonAttributeImport(input: {
  institutionId: string;
  actorId: string;
  importId: string;
  justification: string;
}) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`
      select pg_advisory_xact_lock(hashtextextended(${input.institutionId}::text, 827164))
    `);
    const [candidate] = await tx
      .select()
      .from(personAttributeImports)
      .where(and(
        eq(personAttributeImports.id, input.importId),
        eq(personAttributeImports.institutionId, input.institutionId)
      ))
      .limit(1);
    if (!candidate) throw new HttpError(404, "Import introuvable");
    if (candidate.status === "active") return { import: candidate, duplicate: true };
    if (candidate.status !== "review") {
      throw new HttpError(409, "Cet import ne peut pas être activé");
    }
    const [activeDirectory] = await tx
      .select({ id: identityDirectoryImports.id })
      .from(identityDirectoryImports)
      .where(and(
        eq(identityDirectoryImports.institutionId, input.institutionId),
        eq(identityDirectoryImports.status, "active")
      ))
      .limit(1);
    if (!activeDirectory || activeDirectory.id !== candidate.directoryImportId) {
      throw new HttpError(409, "L’annuaire actif a changé ; régénérez ce fichier d’attributs");
    }
    const [stored] = await tx
      .select({ value: count() })
      .from(personAttributeRows)
      .where(and(
        eq(personAttributeRows.institutionId, input.institutionId),
        eq(personAttributeRows.importId, input.importId)
      ));
    if (Number(stored?.value ?? 0) !== candidate.rowCount) {
      throw new HttpError(409, "L’import chiffré est incomplet ; activation refusée");
    }
    const previous = await tx
      .select({ id: personAttributeImports.id })
      .from(personAttributeImports)
      .where(and(
        eq(personAttributeImports.institutionId, input.institutionId),
        eq(personAttributeImports.status, "active")
      ));
    if (previous.length) {
      await tx
        .update(personAttributeImports)
        .set({ status: "superseded" })
        .where(and(
          eq(personAttributeImports.institutionId, input.institutionId),
          eq(personAttributeImports.status, "active")
        ));
      await tx.insert(personAttributeEvents).values(previous.map((entry) => ({
        institutionId: input.institutionId,
        importId: entry.id,
        action: "supersede",
        actorId: input.actorId,
        summary: { replacementImportId: input.importId },
      })));
    }
    const now = new Date();
    const [updated] = await tx
      .update(personAttributeImports)
      .set({ status: "active", approvedBy: input.actorId, approvedAt: now })
      .where(and(
        eq(personAttributeImports.id, input.importId),
        eq(personAttributeImports.institutionId, input.institutionId),
        eq(personAttributeImports.status, "review")
      ))
      .returning();
    if (!updated) throw new HttpError(409, "Cet import a déjà changé");
    await tx.insert(personAttributeEvents).values({
      institutionId: input.institutionId,
      importId: input.importId,
      action: "activate",
      actorId: input.actorId,
      summary: { justification: input.justification, replacedCount: previous.length, rowCount: updated.rowCount },
    });
    return { import: updated, duplicate: false };
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  return handleApi(res, async () => {
    const context = await requireIdentityDirectoryManager(req);
    const id = routeId(req);
    let justification: string;
    try {
      justification = parseIdentityDirectoryDecisionInput(req.body, "activate").justification;
    } catch (error) {
      registryInputError(error);
    }
    const result = await activatePersonAttributeImport({
      institutionId: context.institutionId,
      actorId: context.user.id,
      importId: id,
      justification,
    });
    const payload = {
      import: personAttributeImportView(result.import),
      duplicate: result.duplicate,
    };
    if (!isPersonAttributeActionPayload(payload, id)) {
      throw new HttpError(503, "La confirmation d’activation est invalide");
    }
    return payload;
  });
}

export const config = { api: { bodyParser: { sizeLimit: "4kb" } } };
