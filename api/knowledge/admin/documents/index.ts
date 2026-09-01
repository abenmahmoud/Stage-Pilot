import type { VercelRequest, VercelResponse } from "@vercel/node";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "../../../../db/index.js";
import {
  agentSkillAudit,
  knowledgeDocuments,
  knowledgeSourceExcerpts,
} from "../../../../db/schema.js";
import { maskKnowledgeDocumentListMetadata } from "../../../../shared/knowledge-document-governance.js";
import {
  projectKnowledgeDocumentPayload,
  projectKnowledgeDocumentReservation,
} from "../../../../shared/knowledge-document-admin-payload.js";
import { parseKnowledgeDocumentInput } from "../../../../shared/knowledge-document-input.js";
import { supabaseAdmin } from "../../../_shared/auth.js";
import {
  KNOWLEDGE_DOCUMENT_BUCKET,
  knowledgeDocumentStoragePath,
} from "../../../_shared/knowledge-documents.js";
import {
  registryInputError,
  requireKnowledgeManager,
} from "../../../_shared/knowledge-registry.js";
import { handleApi, methodNotAllowed } from "../../../_shared/response.js";

type ReviewProposal = {
  overview: string;
  keyPoints: string[];
  rules: string[];
  prohibitions: string[];
  datedStatements: string[];
  conflicts: Array<{ first: string; second: string }>;
  questions: string[];
  instructionSignals: string[];
};

function proposalText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const clean = value.replace(/[\u0000-\u001F\u007F]/g, "").trim();
  return clean ? clean.slice(0, maxLength) : null;
}

function proposalList(value: unknown, maxItems = 6): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.flatMap((item) => proposalText(item, 320) ?? []))]
    .slice(0, maxItems);
}

function reviewProposal(value: unknown): ReviewProposal | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const overview = proposalText(input.overview, 640);
  const conflicts = Array.isArray(input.conflicts)
    ? input.conflicts.flatMap((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return [];
        const conflict = item as Record<string, unknown>;
        const first = proposalText(conflict.first, 320);
        const second = proposalText(conflict.second, 320);
        return first && second ? [{ first, second }] : [];
      }).slice(0, 4)
    : [];
  const allowedSignals = new Set([
    "reserved_prompt_marker",
    "instruction_override",
    "system_prompt_request",
    "role_impersonation",
  ]);
  const result = {
    overview: overview ?? "",
    keyPoints: proposalList(input.keyPoints),
    rules: proposalList(input.rules),
    prohibitions: proposalList(input.prohibitions),
    datedStatements: proposalList(input.datedStatements),
    conflicts,
    questions: proposalList(input.questions),
    instructionSignals: proposalList(input.instructionSignals, 4).filter((signal) => allowedSignals.has(signal)),
  };
  return result.overview || Object.values(result).some((item) => Array.isArray(item) && item.length > 0)
    ? result
    : null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "GET") {
    return handleApi(res, async () => {
      const context = await requireKnowledgeManager(req);
      const documents = await db
        .select({
          id: knowledgeDocuments.id,
          title: knowledgeDocuments.title,
          purposeDescription: knowledgeDocuments.purposeDescription,
          sourceType: knowledgeDocuments.sourceType,
          classification: knowledgeDocuments.classification,
          ownerServiceCode: knowledgeDocuments.ownerServiceCode,
          serviceCodes: knowledgeDocuments.serviceCodes,
          validFrom: knowledgeDocuments.validFrom,
          reviewDueAt: knowledgeDocuments.reviewDueAt,
          originalName: knowledgeDocuments.originalName,
          mimeType: knowledgeDocuments.mimeType,
          sizeBytes: knowledgeDocuments.sizeBytes,
          status: knowledgeDocuments.status,
          retentionPolicyKey: knowledgeDocuments.retentionPolicyKey,
          retentionUntil: knowledgeDocuments.retentionUntil,
          purgeStatus: knowledgeDocuments.purgeStatus,
          purgedAt: knowledgeDocuments.purgedAt,
          analysisSummary: knowledgeDocuments.analysisSummary,
          analysisError: knowledgeDocuments.analysisError,
          reviewProposalJson: sql<unknown>`${knowledgeDocuments.proposedKnowledge}->'reviewProposal'`,
          sourceId: knowledgeDocuments.sourceId,
          excerptCount: sql<number>`(
            select count(*)::integer
            from ${knowledgeSourceExcerpts}
            where ${knowledgeSourceExcerpts.documentId} = ${knowledgeDocuments.id}
              and ${knowledgeSourceExcerpts.institutionId} = ${knowledgeDocuments.institutionId}
          )`,
          createdAt: knowledgeDocuments.createdAt,
          uploadedAt: knowledgeDocuments.uploadedAt,
          analyzedAt: knowledgeDocuments.analyzedAt,
          reviewedAt: knowledgeDocuments.reviewedAt,
        })
        .from(knowledgeDocuments)
        .where(eq(knowledgeDocuments.institutionId, context.institutionId))
        .orderBy(desc(knowledgeDocuments.createdAt))
        .limit(200);
      return {
        documents: documents.map(({ reviewProposalJson, ...document }) =>
          projectKnowledgeDocumentPayload(maskKnowledgeDocumentListMetadata({
            ...document,
            reviewProposal: reviewProposal(reviewProposalJson),
          }))
        ),
      };
    });
  }

  if (req.method === "POST") {
    return handleApi(res, async () => {
      const context = await requireKnowledgeManager(req);
      let input;
      try {
        input = parseKnowledgeDocumentInput(req.body);
      } catch (error) {
        registryInputError(error);
      }

      const storagePath = knowledgeDocumentStoragePath(
        context.institutionId,
        context.user.id,
        input.originalName
      );
      const { data: upload, error: uploadError } = await supabaseAdmin.storage
        .from(KNOWLEDGE_DOCUMENT_BUCKET)
        .createSignedUploadUrl(storagePath);
      if (uploadError || !upload) {
        throw new Error("Le dépôt privé est momentanément indisponible");
      }

      const [document] = await db
        .insert(knowledgeDocuments)
        .values({
          institutionId: context.institutionId,
          ...input,
          reviewDueAt: new Date(input.reviewDueAt),
          storageBucket: KNOWLEDGE_DOCUMENT_BUCKET,
          storagePath,
          uploadedBy: context.user.id,
          status: "reserved",
        })
        .returning();
      await db.insert(agentSkillAudit).values({
        institutionId: context.institutionId,
        resourceType: "document",
        resourceId: document.id,
        action: "reserve_upload",
        actorId: context.user.id,
        summary: {
          classification: document.classification,
          mimeType: document.mimeType,
          sizeBytes: document.sizeBytes,
        },
      });
      return {
        document: projectKnowledgeDocumentReservation(document),
        upload: {
          bucket: KNOWLEDGE_DOCUMENT_BUCKET,
          path: upload.path,
          token: upload.token,
        },
      };
    });
  }

  return methodNotAllowed(res, ["GET", "POST"]);
}

export const config = { api: { bodyParser: { sizeLimit: "16kb" } } };
