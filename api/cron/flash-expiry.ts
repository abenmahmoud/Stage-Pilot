// GET|POST /api/cron/flash-expiry — LOT 5 du plan de persistance flash
// (T071D), étendu au LOT 2 du plan de publication (T071F). Détecte deux
// catégories d'échec DISTINCTES, jamais fusionnées dans le même compteur
// (règle du plan, LOT 2, "les deux causes n'appellent pas la même correction
// d'organisation") :
//   - une proposition jamais validée qui expire (`proposee` ->
//     `expiree_sans_validation`, T071D) ;
//   - une proposition déjà validée mais jamais publiée qui expire (`validee`
//     -> `expiree_sans_publication`, T071F). Sans cette seconde transition,
//     la version resterait `validee` pour toujours et serait redétectée à
//     l'identique à chaque exécution de ce cron.
// Dans les deux cas, un avis factuel à l'auteur est enregistré comme
// "à émettre" — jamais émis (aucun envoi, aucun appel externe dans cette
// route). Même avis de fond (elle n'a pas été publiée, personne n'a été
// informé), aucun valideur mis en cause, aucun motif ajouté.
//
// Même motif que `api/cron/knowledge-expiry.ts` (secret de cron, une seule
// transaction, comptage renvoyé). La proposition n'est jamais supprimée :
// seul son statut change (règle du plan, "conservation de la proposition").
//
// La DÉTECTION (`selectExpiredFlashProposals`,
// `selectExpiredValidatedFlashProposals`) et la TRANSITION
// (`assertLegalFlashVersionTransition`) viennent des modules purs déjà
// écrits et testés (shared/flash-expiration.ts, shared/flash-transitions.ts,
// §13) ; cette route ne réimplémente ni l'une ni l'autre (règle commune n°5
// du plan). Le SQL ne filtre que sur le statut (`proposee` puis `validee`,
// index partiels `flash_info_versions_expiration_pending_idx` et
// `flash_info_versions_validee_expiration_pending_idx`) : c'est la fonction
// pure, pas la requête, qui décide "expiré ou pas".

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../../db/index.js";
import { flashInfoVersions, flashInfoEvents } from "../../db/schema.js";
import { secretMatches, HttpError } from "../_shared/auth.js";
import { handleApi, methodNotAllowed } from "../_shared/response.js";
import {
  selectExpiredFlashProposals,
  selectExpiredValidatedFlashProposals,
  buildFlashExpirationAuthorNotice,
  buildFlashValidatedExpirationAuthorNotice,
} from "../../shared/flash-expiration.js";
import { assertLegalFlashVersionTransition } from "../../shared/flash-transitions.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    return methodNotAllowed(res, ["GET", "POST"]);
  }

  return handleApi(res, async () => {
    const authorization = req.headers.authorization;
    const provided = authorization?.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length)
      : undefined;
    if (!secretMatches(process.env.CRON_SECRET, provided)) {
      throw new HttpError(401, "Accès refusé");
    }

    const now = new Date();

    return db.transaction(async (tx) => {
      const pending = await tx
        .select({
          id: flashInfoVersions.id,
          institutionId: flashInfoVersions.institutionId,
          flashInfoId: flashInfoVersions.flashInfoId,
          status: flashInfoVersions.status,
          title: flashInfoVersions.title,
          expiresAt: flashInfoVersions.expiresAt,
          proposedBy: flashInfoVersions.proposedBy,
        })
        .from(flashInfoVersions)
        .where(eq(flashInfoVersions.status, "proposee"))
        .for("update");

      const expired = selectExpiredFlashProposals(pending, now);

      const notices = expired.map((proposal) => ({
        proposal,
        toStatus: assertLegalFlashVersionTransition(proposal.status, "expiree_sans_validation"),
        notice: buildFlashExpirationAuthorNotice({ title: proposal.title, expiresAt: proposal.expiresAt }),
      }));

      if (notices.length > 0) {
        await tx
          .update(flashInfoVersions)
          .set({ status: "expiree_sans_validation" })
          .where(
            and(
              eq(flashInfoVersions.status, "proposee"),
              inArray(
                flashInfoVersions.id,
                notices.map((item) => item.proposal.id)
              )
            )
          );

        await tx.insert(flashInfoEvents).values(
          notices.map((item) => ({
            institutionId: item.proposal.institutionId,
            flashInfoId: item.proposal.flashInfoId,
            resourceType: "version" as const,
            resourceId: item.proposal.id,
            eventType: "version.expired_without_validation",
            actorUserId: null,
            actorType: "system" as const,
            summary: {
              authorId: item.proposal.proposedBy,
              expiresAt: item.proposal.expiresAt.toISOString(),
              toStatus: item.toStatus,
              authorNotice: item.notice,
            },
          }))
        );
      }

      // Deuxième catégorie, distincte (LOT 2, T071F) : des versions déjà
      // VALIDÉES mais jamais publiées avant leur expiration. Même méthode,
      // même transaction, mais jamais le même compteur ni le même
      // `eventType` que la première catégorie ci-dessus — les deux causes
      // n'appellent pas la même correction d'organisation.
      const pendingValidated = await tx
        .select({
          id: flashInfoVersions.id,
          institutionId: flashInfoVersions.institutionId,
          flashInfoId: flashInfoVersions.flashInfoId,
          status: flashInfoVersions.status,
          title: flashInfoVersions.title,
          expiresAt: flashInfoVersions.expiresAt,
          proposedBy: flashInfoVersions.proposedBy,
        })
        .from(flashInfoVersions)
        .where(eq(flashInfoVersions.status, "validee"))
        .for("update");

      const expiredValidated = selectExpiredValidatedFlashProposals(pendingValidated, now);

      const validatedNotices = expiredValidated.map((proposal) => ({
        proposal,
        toStatus: assertLegalFlashVersionTransition(proposal.status, "expiree_sans_publication"),
        notice: buildFlashValidatedExpirationAuthorNotice({ title: proposal.title, expiresAt: proposal.expiresAt }),
      }));

      if (validatedNotices.length > 0) {
        await tx
          .update(flashInfoVersions)
          .set({ status: "expiree_sans_publication" })
          .where(
            and(
              eq(flashInfoVersions.status, "validee"),
              inArray(
                flashInfoVersions.id,
                validatedNotices.map((item) => item.proposal.id)
              )
            )
          );

        await tx.insert(flashInfoEvents).values(
          validatedNotices.map((item) => ({
            institutionId: item.proposal.institutionId,
            flashInfoId: item.proposal.flashInfoId,
            resourceType: "version" as const,
            resourceId: item.proposal.id,
            eventType: "version.expired_after_validation_without_publication",
            actorUserId: null,
            actorType: "system" as const,
            summary: {
              authorId: item.proposal.proposedBy,
              expiresAt: item.proposal.expiresAt.toISOString(),
              toStatus: item.toStatus,
              authorNotice: item.notice,
            },
          }))
        );
      }

      return {
        checkedAt: now.toISOString(),
        expiredCount: notices.length,
        expiredAfterValidationCount: validatedNotices.length,
      };
    });
  });
}

export const config = { maxDuration: 60, api: { bodyParser: false } };
