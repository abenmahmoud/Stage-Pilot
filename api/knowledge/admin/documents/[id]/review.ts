import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createHash } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "../../../../../db/index.js";
import {
  agentSkillAudit,
  knowledgeDocuments,
  knowledgeSourceExcerpts,
  knowledgeSources,
} from "../../../../../db/schema.js";
import { compileKnowledgeExcerpts } from "../../../../../shared/knowledge-excerpts.js";
import { HttpError, supabaseAdmin } from "../../../../_shared/auth.js";
import { requireKnowledgeManager } from "../../../../_shared/knowledge-registry.js";
import { handleApi, methodNotAllowed } from "../../../../_shared/response.js";

function routeId(req: VercelRequest): string {
  const value = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (!value || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new HttpError(400, "Document invalide");
  }
  return value;
}

function reviewInput(value: unknown): { action: "approve" | "reject"; note: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(400, "Décision invalide");
  }
  const body = value as Record<string, unknown>;
  if (!['approve', 'reject'].includes(String(body.action))) {
    throw new HttpError(400, "Décision invalide");
  }
  const note = typeof body.note === "string" ? body.note.trim() : "";
  if (note.length < 10 || note.length > 1000) {
    throw new HttpError(400, "La note de validation doit contenir entre 10 et 1 000 caractères");
  }
  return { action: body.action as "approve" | "reject", note };
}

function sourceType(value: string): "internal_document" | "procedure" | "calendar" {
  if (value === "procedure" || value === "calendar") return value;
  return "internal_document";
}

function compileApprovedDocument(document: {
  classification: string;
  proposedKnowledge: unknown;
}) {
  if (!["public", "internal"].includes(document.classification)) return [];
  if (
    !document.proposedKnowledge ||
    typeof document.proposedKnowledge !== "object" ||
    Array.isArray(document.proposedKnowledge)
  ) return [];
  const proposal = document.proposedKnowledge as Record<string, unknown>;
  if (
    proposal.state !== "extracted" ||
    typeof proposal.extractedText !== "string" ||
    (Array.isArray(proposal.privacySignals) && proposal.privacySignals.length > 0)
  ) return [];
  return compileKnowledgeExcerpts(proposal.extractedText);
}

function minimizedProposal(value: unknown, excerptCount: number) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { schemaVersion: 2, state: "manual_review", excerptCount: 0 };
  }
  const proposal = value as Record<string, unknown>;
  return {
    schemaVersion: 2,
    state: typeof proposal.state === "string" ? proposal.state : "manual_review",
    reason: typeof proposal.reason === "string" ? proposal.reason : null,
    privacySignals: Array.isArray(proposal.privacySignals)
      ? proposal.privacySignals.filter((signal): signal is string => typeof signal === "string").slice(0, 20)
      : [],
    truncated: proposal.truncated === true,
    excerptCount,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  return handleApi(res, async () => {
    const context = await requireKnowledgeManager(req, { publish: true });
    const id = routeId(req);
    const input = reviewInput(req.body);

    if (input.action === "reject") {
      const [document] = await db
        .select()
        .from(knowledgeDocuments)
        .where(
          and(
            eq(knowledgeDocuments.id, id),
            eq(knowledgeDocuments.institutionId, context.institutionId),
            inArray(knowledgeDocuments.status, ["review", "failed"])
          )
        )
        .limit(1);
      if (!document) throw new HttpError(409, "Ce document ne peut pas être refusé");
      const { error } = await supabaseAdmin.storage
        .from(document.storageBucket)
        .remove([document.storagePath]);
      if (error) throw new Error("Le document privé n’a pas pu être retiré du stockage");
      const [rejected] = await db.transaction(async (tx) => {
        const updated = await tx
          .update(knowledgeDocuments)
          .set({
            status: "rejected",
            proposedKnowledge: {},
            analysisError: "Document refusé lors de la validation humaine.",
            reviewedBy: context.user.id,
            reviewedAt: new Date(),
          })
          .where(
            and(
              eq(knowledgeDocuments.id, id),
              eq(knowledgeDocuments.institutionId, context.institutionId),
              inArray(knowledgeDocuments.status, ["review", "failed"])
            )
          )
          .returning();
        if (!updated[0]) return [];
        await tx.insert(agentSkillAudit).values({
          institutionId: context.institutionId,
          resourceType: "document",
          resourceId: id,
          action: "review_document",
          actorId: context.user.id,
          summary: { decision: "reject", note: input.note, storageRemoved: true },
        });
        return updated;
      });
      if (!rejected) throw new HttpError(409, "Le document a déjà été traité");
      return { document: rejected };
    }

    return db.transaction(async (tx) => {
      await tx.execute(sql`
        select pg_advisory_xact_lock(hashtextextended(${id}, 0))
      `);
      const [document] = await tx
        .select()
        .from(knowledgeDocuments)
        .where(
          and(
            eq(knowledgeDocuments.id, id),
            eq(knowledgeDocuments.institutionId, context.institutionId)
          )
        )
        .limit(1);
      if (!document) throw new HttpError(404, "Document introuvable");
      if (document.status === "ready" && document.sourceId) {
        return { document, sourceId: document.sourceId, duplicate: true };
      }
      if (document.status !== "review" || !document.checksum) {
        throw new HttpError(409, "Le document doit d’abord terminer son analyse locale");
      }

      const [source] = await tx
        .insert(knowledgeSources)
        .values({
          institutionId: context.institutionId,
          title: document.title,
          sourceType: sourceType(document.sourceType),
          uri: `private://knowledge-documents/${document.id}`,
          classification: document.classification,
          ownerUserId: context.user.id,
          serviceCodes: document.serviceCodes,
          validFrom: new Date(`${document.validFrom}T00:00:00.000Z`),
          expiresAt: document.reviewDueAt,
          status: "draft",
          checksum: document.checksum,
        })
        .returning();
      const excerpts = compileApprovedDocument(document);
      if (excerpts.length > 0) {
        await tx.insert(knowledgeSourceExcerpts).values(
          excerpts.map((excerpt) => ({
            institutionId: context.institutionId,
            sourceId: source.id,
            documentId: document.id,
            ordinal: excerpt.ordinal,
            excerptText: excerpt.text,
            contentHash: createHash("sha256").update(excerpt.text, "utf8").digest("hex"),
          }))
        );
      }
      const [ready] = await tx
        .update(knowledgeDocuments)
        .set({
          status: "ready",
          sourceId: source.id,
          reviewedBy: context.user.id,
          reviewedAt: new Date(),
          analysisError: null,
          proposedKnowledge: minimizedProposal(document.proposedKnowledge, excerpts.length),
        })
        .where(
          and(
            eq(knowledgeDocuments.id, id),
            eq(knowledgeDocuments.institutionId, context.institutionId),
            eq(knowledgeDocuments.status, "review")
          )
        )
        .returning();
      if (!ready) throw new HttpError(409, "Le document a déjà été traité");
      await tx.insert(agentSkillAudit).values([
        {
          institutionId: context.institutionId,
          resourceType: "document",
          resourceId: id,
          action: "review_document",
          actorId: context.user.id,
          summary: {
            decision: "approve",
            note: input.note,
            sourceId: source.id,
            excerptCount: excerpts.length,
            extractedTextRemoved: true,
          },
        },
        {
          institutionId: context.institutionId,
          resourceType: "source",
          resourceId: source.id,
          action: "create",
          actorId: context.user.id,
          summary: { fromDocumentId: id, status: "draft" },
        },
      ]);
      return { document: ready, source, duplicate: false };
    });
  });
}

export const config = { api: { bodyParser: { sizeLimit: "4kb" } } };
