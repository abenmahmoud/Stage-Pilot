import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../../../../db/index.js";
import {
  communicationEvents,
  communications,
  communicationVersions,
} from "../../../../db/schema.js";
import {
  communicationDraftContentHash,
  parseCommunicationDraftInput,
} from "../../../../shared/communication-draft.js";
import { HttpError } from "../../../_shared/auth.js";
import { requireCommunicationEditor } from "../../../_shared/communications.js";
import { handleApi, methodNotAllowed } from "../../../_shared/response.js";

function routeId(req: VercelRequest): string {
  const value = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (!value) throw new HttpError(400, "Communication manquante");
  return value;
}

function invalidInput(error: unknown): never {
  const reason = error instanceof Error ? error.message : "input_invalid";
  if (reason === "secret_forbidden") {
    throw new HttpError(400, "Retirez tout mot de passe, code d’accès ou secret avant d’enregistrer.");
  }
  throw new HttpError(400, "La nouvelle version est invalide.");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "GET") {
    return handleApi(res, async () => {
      const context = await requireCommunicationEditor(req);
      const id = routeId(req);
      const [communication] = await db
        .select({
          id: communications.id,
          status: communications.status,
          visibility: communications.visibility,
          category: communications.category,
          templateKey: communications.templateKey,
          publicSlug: communications.publicSlug,
          currentVersion: communications.currentVersion,
          publishedAt: communications.publishedAt,
          updatedAt: communications.updatedAt,
          title: communicationVersions.title,
          summary: communicationVersions.summary,
          bodyMarkdown: communicationVersions.bodyMarkdown,
          structuredFacts: communicationVersions.structuredFacts,
          openQuestions: communicationVersions.openQuestions,
        })
        .from(communications)
        .innerJoin(communicationVersions, and(
          eq(communicationVersions.communicationId, communications.id),
          eq(communicationVersions.institutionId, communications.institutionId),
          eq(communicationVersions.version, communications.currentVersion)
        ))
        .where(and(
          eq(communications.id, id),
          eq(communications.institutionId, context.institutionId)
        ))
        .limit(1);
      if (!communication) throw new HttpError(404, "Communication introuvable");
      const versions = await db
        .select({
          id: communicationVersions.id,
          version: communicationVersions.version,
          status: communicationVersions.status,
          createdAt: communicationVersions.createdAt,
          updatedAt: communicationVersions.updatedAt,
        })
        .from(communicationVersions)
        .where(and(
          eq(communicationVersions.communicationId, id),
          eq(communicationVersions.institutionId, context.institutionId)
        ))
        .orderBy(desc(communicationVersions.version))
        .limit(100);
      return { communication, versions };
    });
  }

  if (req.method === "PATCH") {
    return handleApi(res, async () => {
      const context = await requireCommunicationEditor(req);
      const id = routeId(req);
      let input;
      try {
        input = parseCommunicationDraftInput(req.body);
      } catch (error) {
        invalidInput(error);
      }
      const contentHash = communicationDraftContentHash(input);
      const result = await db.transaction(async (tx) => {
        await tx.execute(sql`
          select id from public.communications
          where id = ${id}::uuid and institution_id = ${context.institutionId}::uuid
          for update
        `);
        const [root] = await tx
          .select({
            id: communications.id,
            status: communications.status,
            visibility: communications.visibility,
            sourceType: communications.sourceType,
            currentVersion: communications.currentVersion,
            updatedAt: communications.updatedAt,
          })
          .from(communications)
          .where(and(
            eq(communications.id, id),
            eq(communications.institutionId, context.institutionId)
          ))
          .limit(1);
        if (!root) throw new HttpError(404, "Communication introuvable");
        if (root.sourceType !== "direct_text") {
          throw new HttpError(409, "Cette source doit être corrigée depuis son document d’origine.");
        }
        if (root.status !== "draft") {
          throw new HttpError(409, "Cette communication doit revenir en brouillon avant modification.");
        }
        const [current] = await tx
          .select({
            id: communicationVersions.id,
            version: communicationVersions.version,
            status: communicationVersions.status,
            contentHash: communicationVersions.contentHash,
          })
          .from(communicationVersions)
          .where(and(
            eq(communicationVersions.communicationId, id),
            eq(communicationVersions.institutionId, context.institutionId),
            eq(communicationVersions.version, root.currentVersion)
          ))
          .limit(1);
        if (!current) throw new Error("La version courante est introuvable");
        if (current.contentHash === contentHash) {
          return {
            communication: {
              id: root.id,
              status: root.status,
              visibility: root.visibility,
              currentVersion: root.currentVersion,
              updatedAt: root.updatedAt,
            },
            version: { id: current.id, version: current.version, status: current.status },
            duplicate: true,
          };
        }
        const nextVersion = root.currentVersion + 1;
        if (nextVersion > 10_000) throw new HttpError(409, "Le nombre maximal de versions est atteint.");
        const [version] = await tx
          .insert(communicationVersions)
          .values({
            institutionId: context.institutionId,
            communicationId: id,
            version: nextVersion,
            status: "draft",
            title: input.title,
            summary: input.summary,
            bodyMarkdown: input.bodyMarkdown,
            structuredFacts: input.structuredFacts,
            openQuestions: input.openQuestions,
            contentHash,
            createdBy: context.user.id,
          })
          .returning({
            id: communicationVersions.id,
            version: communicationVersions.version,
            status: communicationVersions.status,
            createdAt: communicationVersions.createdAt,
            updatedAt: communicationVersions.updatedAt,
          });
        const [updated] = await tx
          .update(communications)
          .set({
            currentVersion: nextVersion,
            category: input.category,
            templateKey: input.templateKey,
          })
          .where(and(
            eq(communications.id, id),
            eq(communications.institutionId, context.institutionId),
            eq(communications.status, "draft"),
            eq(communications.currentVersion, root.currentVersion)
          ))
          .returning({
            id: communications.id,
            status: communications.status,
            visibility: communications.visibility,
            currentVersion: communications.currentVersion,
            updatedAt: communications.updatedAt,
          });
        if (!updated) throw new HttpError(409, "La communication a été modifiée par un autre agent.");
        await tx.insert(communicationEvents).values({
          institutionId: context.institutionId,
          communicationId: id,
          resourceType: "version",
          resourceId: version.id,
          eventType: "version.created",
          actorUserId: context.user.id,
          actorType: "user",
          summary: { version: nextVersion, previousVersion: root.currentVersion },
        });
        return { communication: updated, version, duplicate: false };
      });
      res.status(result.duplicate ? 200 : 201);
      return result;
    });
  }

  return methodNotAllowed(res, ["GET", "PATCH"]);
}
