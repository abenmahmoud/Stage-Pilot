// LOT 5 du plan de connaissance OB1 (2026-09-05) : file de validation des
// propositions de connaissance. GET liste la file (reutilise le meme role de
// gestion des connaissances que le reste du registre) ; POST cree une
// proposition « issue d'une discussion » (bullet 1 du plan). Une proposition
// issue d'une actualite publiee se cree depuis
// `api/flash/proposals/[id]/knowledge.ts`, pas ici.
//
// Note de portee, documentee au lieu d'etre masquee : contrairement aux
// autres payloads d'administration du registre
// (`shared/knowledge-document-admin-payload.ts`), cette route ne fait pas
// suivre sa propre projection d'un second parseur miroir. Le present lot n'a
// pas eu le temps de repliquer cette defense en profondeur ; a faire avant
// une mise en production reelle.

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../../../../db/index.js";
import { agentSkillAudit, knowledgeSourceProposals } from "../../../../db/schema.js";
import {
  detectPersonalOrSecretSignals,
  parseConversationProposalInput,
} from "../../../../shared/knowledge-source-proposal-policy.js";
import { HttpError } from "../../../_shared/auth.js";
import {
  registryInputError,
  requireKnowledgeManager,
} from "../../../_shared/knowledge-registry.js";
import { handleApi, methodNotAllowed } from "../../../_shared/response.js";
import { idempotencyKey, sha256 } from "../../../_shared/support.js";

function proposalPayload(row: typeof knowledgeSourceProposals.$inferSelect) {
  const exposeText = row.privacySignals.length === 0;
  return {
    id: row.id,
    origin: row.origin,
    originConversationId: row.originConversationId,
    originFlashInfoId: row.originFlashInfoId,
    originFlashVersionId: row.originFlashVersionId,
    title: row.title,
    // Jamais expose si un signal de vie privee/secret a ete detecte : le
    // texte est alors NULL en base (voir la contrainte de la migration).
    proposedText: exposeText ? row.proposedText : null,
    privacySignalCount: row.privacySignals.length,
    classification: row.classification,
    serviceCodes: row.serviceCodes,
    validFrom: row.validFrom.toISOString(),
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    provenanceStatus: row.provenanceStatus,
    usePolicy: row.usePolicy,
    status: row.status,
    reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : null,
    reviewNote: row.reviewNote,
    sourceId: row.sourceId,
    createdAt: row.createdAt.toISOString(),
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "GET") {
    return handleApi(res, async () => {
      const context = await requireKnowledgeManager(req);
      const rows = await db
        .select()
        .from(knowledgeSourceProposals)
        .where(eq(knowledgeSourceProposals.institutionId, context.institutionId))
        .orderBy(desc(knowledgeSourceProposals.createdAt))
        .limit(200);
      return { proposals: rows.map(proposalPayload) };
    });
  }

  if (req.method === "POST") {
    return handleApi(res, async () => {
      const context = await requireKnowledgeManager(req);
      const idempotencyHash = sha256(idempotencyKey(req));
      let input;
      try {
        input = parseConversationProposalInput(req.body);
      } catch (error) {
        registryInputError(error);
      }

      const signals = detectPersonalOrSecretSignals(input.candidateText);
      if (signals.length > 0 && input.usePolicy !== "requires_human_confirmation" && input.usePolicy !== "do_not_inject_automatically") {
        // Garde-fou redondant avec la contrainte de base (une proposition
        // sans texte ne peut jamais etre approuvee) : refuse ici la
        // combinaison plutot que de laisser une proposition inutilisable
        // entrer en file sous une politique qui laisserait croire qu'elle
        // pourrait un jour etre injectee automatiquement.
        throw new HttpError(
          422,
          "Le texte proposé contient une donnée personnelle ou un secret : retirez-la avant de le soumettre à nouveau."
        );
      }

      // Idempotence sur un double envoi (en-tête `Idempotency-Key`, jamais le
      // corps) : même motif que `api/flash/proposals/index.ts`. Comparer le
      // corps aurait échoué dès qu'un signal de vie privée retire le texte
      // avant stockage (`proposedText` devient alors NULL).
      const { proposal, duplicate } = await db.transaction(async (tx) => {
        const [created] = await tx
          .insert(knowledgeSourceProposals)
          .values({
            institutionId: context.institutionId,
            origin: "conversation",
            originConversationId: input.conversationId,
            title: input.title,
            proposedText: signals.length === 0 ? input.candidateText : null,
            privacySignals: signals,
            classification: input.classification,
            serviceCodes: input.serviceCodes,
            validFrom: input.validFrom,
            expiresAt: input.expiresAt,
            provenanceStatus: input.provenanceStatus,
            usePolicy: input.usePolicy,
            proposedBy: context.user.id,
            idempotencyKeyHash: idempotencyHash,
          })
          .onConflictDoNothing({
            target: [knowledgeSourceProposals.institutionId, knowledgeSourceProposals.idempotencyKeyHash],
          })
          .returning();

        if (created) {
          await tx.insert(agentSkillAudit).values({
            institutionId: context.institutionId,
            resourceType: "proposal",
            resourceId: created.id,
            action: "propose_knowledge_source",
            actorId: context.user.id,
            summary: { origin: "conversation", privacySignalCount: signals.length },
          });
          return { proposal: created, duplicate: false };
        }

        const [existing] = await tx
          .select()
          .from(knowledgeSourceProposals)
          .where(
            and(
              eq(knowledgeSourceProposals.institutionId, context.institutionId),
              eq(knowledgeSourceProposals.idempotencyKeyHash, idempotencyHash),
              eq(knowledgeSourceProposals.proposedBy, context.user.id)
            )
          )
          .limit(1);
        // L'idempotence évite une seconde écriture ; elle ne doit jamais
        // donner accès à la proposition d'un autre auteur.
        if (!existing) {
          throw new HttpError(409, "Cet envoi ne peut pas être repris par ce compte.");
        }
        return { proposal: existing, duplicate: true };
      });

      return { proposal: proposalPayload(proposal), duplicate };
    });
  }

  return methodNotAllowed(res, ["GET", "POST"]);
}

export const config = { api: { bodyParser: { sizeLimit: "16kb" } } };
