// POST /api/knowledge/admin/proposals/[id]/decision — LOT 5 du plan de
// connaissance OB1 (2026-09-05).
//
// Ceci EST la seconde validation du plan (bullet 2) : approuver cree
// DIRECTEMENT la source en `knowledge_sources` avec `status: 'published'`
// (jamais `'draft'`) — pas de troisieme etape, pas de passage par
// `sources/[id]/action.ts`. Exige `{ publish: true }` (meme garde que
// `sources/[id]/action.ts` et `documents/[id]/review.ts`) : cette decision,
// et elle seule, rend la proposition utilisable par l'agent.
//
// Une proposition dont le texte a ete retire pour signal de vie privee/secret
// (`privacySignals` non vide) ne peut jamais etre approuvee, seulement
// rejetee — garanti aussi par une contrainte de la migration
// 20260906020000, pas seulement par ce controle applicatif.

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../../../../../db/index.js";
import {
  agentSkillAudit,
  knowledgeSourceProposals,
  knowledgeSources,
} from "../../../../../db/schema.js";
import { parseKnowledgeSourceProposalDecisionInput } from "../../../../../shared/knowledge-source-proposal-policy.js";
import { runKnowledgeFreshnessSweep } from "../../../../_shared/knowledge-freshness-sweep.js";
import { HttpError } from "../../../../_shared/auth.js";
import {
  registryInputError,
  requireKnowledgeManager,
} from "../../../../_shared/knowledge-registry.js";
import { handleApi, methodNotAllowed } from "../../../../_shared/response.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function routeId(req: VercelRequest): string {
  const value = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (!value || !UUID_PATTERN.test(value)) throw new HttpError(400, "Proposition invalide");
  return value;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  return handleApi(res, async () => {
    const context = await requireKnowledgeManager(req, { publish: true });
    const id = routeId(req);
    let input;
    try {
      input = parseKnowledgeSourceProposalDecisionInput(req.body);
    } catch (error) {
      registryInputError(error);
    }

    return db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${id}, 5))`);
      const [proposal] = await tx
        .select()
        .from(knowledgeSourceProposals)
        .where(
          and(
            eq(knowledgeSourceProposals.id, id),
            eq(knowledgeSourceProposals.institutionId, context.institutionId)
          )
        )
        .limit(1);
      if (!proposal) throw new HttpError(404, "Proposition introuvable");
      if (proposal.status !== "pending_review") {
        throw new HttpError(409, "Cette proposition a déjà été traitée");
      }

      const now = new Date();

      if (input.action === "reject") {
        const [rejected] = await tx
          .update(knowledgeSourceProposals)
          .set({
            status: "rejected",
            reviewedBy: context.user.id,
            reviewedAt: now,
            reviewNote: input.note,
          })
          .where(eq(knowledgeSourceProposals.id, id))
          .returning();
        await tx.insert(agentSkillAudit).values({
          institutionId: context.institutionId,
          resourceType: "proposal",
          resourceId: id,
          action: "review_knowledge_proposal",
          actorId: context.user.id,
          summary: { decision: "reject", note: input.note },
        });
        return { proposalId: rejected.id, status: rejected.status, sourceId: null };
      }

      if (proposal.privacySignals.length > 0 || !proposal.proposedText) {
        throw new HttpError(
          409,
          "Cette proposition a été privée de son texte (donnée personnelle ou secret détecté) : elle ne peut être que rejetée"
        );
      }
      if (proposal.validFrom > now || (proposal.expiresAt && proposal.expiresAt <= now)) {
        throw new HttpError(409, "La période de validité de cette proposition est incorrecte");
      }

      const checksum = createHash("sha256").update(proposal.proposedText, "utf8").digest("hex");
      const [source] = await tx
        .insert(knowledgeSources)
        .values({
          institutionId: context.institutionId,
          title: proposal.title,
          sourceType: proposal.origin,
          uri: `internal://knowledge-source-proposals/${proposal.id}`,
          classification: proposal.classification,
          ownerUserId: context.user.id,
          serviceCodes: proposal.serviceCodes,
          validFrom: proposal.validFrom,
          expiresAt: proposal.expiresAt,
          status: "published",
          checksum,
          provenanceStatus: proposal.provenanceStatus,
          usePolicy: proposal.usePolicy,
        })
        .returning();

      const [approved] = await tx
        .update(knowledgeSourceProposals)
        .set({
          status: "approved",
          reviewedBy: context.user.id,
          reviewedAt: now,
          reviewNote: input.note,
          sourceId: source.id,
        })
        .where(eq(knowledgeSourceProposals.id, id))
        .returning();

      await tx.insert(agentSkillAudit).values([
        {
          institutionId: context.institutionId,
          resourceType: "proposal",
          resourceId: id,
          action: "review_knowledge_proposal",
          actorId: context.user.id,
          summary: { decision: "approve", note: input.note, sourceId: source.id },
        },
        {
          institutionId: context.institutionId,
          resourceType: "source",
          resourceId: source.id,
          action: "create",
          actorId: context.user.id,
          summary: { fromProposalId: id, origin: proposal.origin, status: "published" },
        },
      ]);

      // LOT 6 : cette approbation publie directement une source — un
      // contrôle de fraîcheur supplémentaire a lieu immédiatement, sans
      // attendre le prochain créneau planifié.
      await runKnowledgeFreshnessSweep(tx, now, "publication");

      return { proposalId: approved.id, status: approved.status, sourceId: source.id };
    });
  });
}

export const config = { api: { bodyParser: { sizeLimit: "4kb" } } };
