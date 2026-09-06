// POST /api/flash/proposals/[id]/knowledge — « Rendre utilisable par
// l'agent », bullet 2 du LOT 5 (plan de connaissance OB1, 2026-09-05).
//
// Ceci est la PREMIERE des deux decisions humaines du plan : elle cree une
// proposition liee au contenu source, elle ne rend RIEN utilisable. La
// seconde validation vit ailleurs (`api/knowledge/admin/proposals/[id]/
// decision.ts`) et exige une autorisation elevee distincte
// (`requireKnowledgeManager(req, { publish: true })`) — cette route-ci ne la
// demande pas expres, pour que les deux decisions restent deux gestes
// distincts avec des barres d'autorisation differentes, pas juste deux clics
// du meme geste.
//
// N'ecrit jamais dans `flash_notification_dispatches` ni dans aucune table
// de notification : la connaissance et la notification restent deux
// decisions separees (bullet 5 du plan). Voir
// `scripts/test-flash-knowledge-notification-separation.mjs`.
//
// `title`/`bodyMarkdown`/`validFrom`/`expiresAt` viennent de la version flash
// PUBLIEE elle-meme, jamais d'une saisie libre : copier `expiresAt` est ce
// qui garantit qu'une expiration flash retire aussi la connaissance derivee
// (LOT 3 exclut deja toute source expiree), sans code de retrait
// supplementaire.

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../../../../db/index.js";
import {
  agentSkillAudit,
  flashInfoVersions,
  flashInfos,
  knowledgeSourceProposals,
  knowledgeSources,
} from "../../../../db/schema.js";
import {
  detectPersonalOrSecretSignals,
  parseFlashProposalActivationInput,
} from "../../../../shared/knowledge-source-proposal-policy.js";
import { HttpError } from "../../../_shared/auth.js";
import { flashProposalRouteId } from "../../../_shared/flash-access.js";
import {
  registryInputError,
  requireKnowledgeManager,
} from "../../../_shared/knowledge-registry.js";
import { handleApi, methodNotAllowed } from "../../../_shared/response.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  return handleApi(res, async () => {
    const context = await requireKnowledgeManager(req);
    const flashInfoId = flashProposalRouteId(req);
    let input;
    try {
      input = parseFlashProposalActivationInput(req.body);
    } catch (error) {
      registryInputError(error);
    }

    const [current] = await db
      .select({
        versionId: flashInfoVersions.id,
        status: flashInfoVersions.status,
        title: flashInfoVersions.title,
        bodyMarkdown: flashInfoVersions.bodyMarkdown,
        publishedAt: flashInfoVersions.publishedAt,
        expiresAt: flashInfoVersions.expiresAt,
      })
      .from(flashInfoVersions)
      .innerJoin(
        flashInfos,
        and(
          eq(flashInfoVersions.flashInfoId, flashInfos.id),
          eq(flashInfoVersions.version, flashInfos.currentVersion)
        )
      )
      .where(
        and(
          eq(flashInfoVersions.flashInfoId, flashInfoId),
          eq(flashInfoVersions.institutionId, context.institutionId)
        )
      )
      .limit(1);
    if (!current) throw new HttpError(404, "Information flash introuvable.");
    if (current.status !== "publiee" || !current.publishedAt) {
      throw new HttpError(409, "Seule une actualité déjà publiée peut être rendue utilisable par l’agent.");
    }

    // Une seule proposition active a la fois pour une meme actualite. Une
    // proposition rejetee, ou une proposition approuvee dont la source a
    // depuis ete revoquee (ex. par une correction, voir
    // `api/flash/proposals/[id]/correction.ts`), n'empeche pas d'en creer
    // une nouvelle — sinon une actualite corrigee puis re-publiee ne
    // pourrait plus jamais redevenir une connaissance.
    const [existing] = await db
      .select({
        id: knowledgeSourceProposals.id,
        status: knowledgeSourceProposals.status,
        sourceStatus: knowledgeSources.status,
      })
      .from(knowledgeSourceProposals)
      .leftJoin(knowledgeSources, eq(knowledgeSourceProposals.sourceId, knowledgeSources.id))
      .where(
        and(
          eq(knowledgeSourceProposals.institutionId, context.institutionId),
          eq(knowledgeSourceProposals.originFlashInfoId, flashInfoId)
        )
      )
      .orderBy(desc(knowledgeSourceProposals.createdAt))
      .limit(1);
    const existingBlocks = existing
      ? existing.status === "pending_review"
        || (existing.status === "approved" && existing.sourceStatus !== "revoked")
      : false;
    if (existingBlocks) {
      throw new HttpError(409, "Une proposition existe déjà pour cette actualité.");
    }

    const signals = detectPersonalOrSecretSignals(current.bodyMarkdown);

    const [proposal] = await db
      .insert(knowledgeSourceProposals)
      .values({
        institutionId: context.institutionId,
        origin: "flash_publication",
        originFlashInfoId: flashInfoId,
        originFlashVersionId: current.versionId,
        title: current.title,
        proposedText: signals.length === 0 ? current.bodyMarkdown : null,
        privacySignals: signals,
        classification: input.classification,
        serviceCodes: input.serviceCodes,
        validFrom: current.publishedAt,
        expiresAt: current.expiresAt,
        provenanceStatus: input.provenanceStatus,
        usePolicy: input.usePolicy,
        proposedBy: context.user.id,
      })
      .returning();

    await db.insert(agentSkillAudit).values({
      institutionId: context.institutionId,
      resourceType: "proposal",
      resourceId: proposal.id,
      action: "propose_knowledge_source",
      actorId: context.user.id,
      summary: {
        origin: "flash_publication",
        flashInfoId,
        flashVersionId: current.versionId,
        privacySignalCount: signals.length,
      },
    });

    return {
      proposalId: proposal.id,
      status: proposal.status,
      privacySignalCount: signals.length,
    };
  });
}

export const config = { api: { bodyParser: { sizeLimit: "4kb" } } };
