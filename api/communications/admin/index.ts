import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../../../db/index.js";
import {
  communicationEvents,
  communications,
  communicationVersions,
} from "../../../db/schema.js";
import {
  communicationDraftContentHash,
  communicationDraftSourceFingerprint,
  parseCommunicationDraftInput,
} from "../../../shared/communication-draft.js";
import { HttpError } from "../../_shared/auth.js";
import { requireCommunicationEditor } from "../../_shared/communications.js";
import { handleApi, methodNotAllowed } from "../../_shared/response.js";

function invalidInput(error: unknown): never {
  if (error instanceof HttpError) throw error;
  const reason = error instanceof Error ? error.message : "input_invalid";
  if (reason === "secret_forbidden") {
    throw new HttpError(400, "Retirez tout mot de passe, code d’accès ou secret avant d’enregistrer.");
  }
  throw new HttpError(400, "Le brouillon est invalide.");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "GET") {
    return handleApi(res, async () => {
      const context = await requireCommunicationEditor(req);
      const rows = await db
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
          structuredFacts: communicationVersions.structuredFacts,
          openQuestions: communicationVersions.openQuestions,
        })
        .from(communications)
        .innerJoin(
          communicationVersions,
          and(
            eq(communicationVersions.communicationId, communications.id),
            eq(communicationVersions.institutionId, communications.institutionId),
            eq(communicationVersions.version, communications.currentVersion)
          )
        )
        .where(eq(communications.institutionId, context.institutionId))
        .orderBy(desc(communications.updatedAt))
        .limit(100);
      return { communications: rows };
    });
  }

  if (req.method === "POST") {
    return handleApi(res, async () => {
      const context = await requireCommunicationEditor(req);
      let input;
      try {
        input = parseCommunicationDraftInput(req.body);
      } catch (error) {
        invalidInput(error);
      }
      const sourceFingerprint = communicationDraftSourceFingerprint(input);
      const contentHash = communicationDraftContentHash(input);

      const result = await db.transaction(async (tx) => {
        const [created] = await tx
          .insert(communications)
          .values({
            institutionId: context.institutionId,
            sourceType: input.sourceType,
            sourceFingerprint,
            sourceLabel: "Saisie directe",
            status: "draft",
            visibility: "internal",
            category: input.category,
            templateKey: input.templateKey,
            currentVersion: 1,
            createdBy: context.user.id,
          })
          .onConflictDoNothing({
            target: [communications.institutionId, communications.sourceFingerprint],
          })
          .returning({
            id: communications.id,
            status: communications.status,
            visibility: communications.visibility,
            currentVersion: communications.currentVersion,
            updatedAt: communications.updatedAt,
          });

        if (!created) {
          const [existing] = await tx
            .select({
              id: communications.id,
              status: communications.status,
              visibility: communications.visibility,
              currentVersion: communications.currentVersion,
              updatedAt: communications.updatedAt,
            })
            .from(communications)
            .where(and(
              eq(communications.institutionId, context.institutionId),
              eq(communications.sourceFingerprint, sourceFingerprint)
            ))
            .limit(1);
          if (!existing) throw new Error("Communication draft race could not be recovered");
          return { communication: existing, duplicate: true };
        }

        const [version] = await tx
          .insert(communicationVersions)
          .values({
            institutionId: context.institutionId,
            communicationId: created.id,
            version: 1,
            status: "draft",
            title: input.title,
            summary: input.summary,
            bodyMarkdown: input.bodyMarkdown,
            structuredFacts: input.structuredFacts,
            openQuestions: input.openQuestions,
            contentHash,
            createdBy: context.user.id,
          })
          .returning({ id: communicationVersions.id, version: communicationVersions.version });

        await tx.insert(communicationEvents).values({
          institutionId: context.institutionId,
          communicationId: created.id,
          resourceType: "communication",
          resourceId: created.id,
          eventType: "communication.created",
          actorUserId: context.user.id,
          actorType: "user",
          summary: { version: 1, sourceType: "direct_text", visibility: "internal" },
        });

        return { communication: created, version, duplicate: false };
      });

      res.status(result.duplicate ? 200 : 201);
      return result;
    });
  }

  return methodNotAllowed(res, ["GET", "POST"]);
}

export const config = { api: { bodyParser: { sizeLimit: "512kb" } } };
