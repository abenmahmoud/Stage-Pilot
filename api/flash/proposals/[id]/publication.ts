// POST /api/flash/proposals/[id]/publication — LOT 1 du plan de publication
// flash (docs/operations/PLAN_FLASH_PUBLICATION_2026-09-05.md).
//
// Transition `validee` -> `publiee`, ouverte par le MÊME service que la
// validation (`assertFlashValidationAccess`, `decideFlashValidationAccess`),
// jamais par le rôle applicatif seul. Décision d'Adel (§13, T071F) : valider
// n'est pas publier, ce sont deux gestes humains distincts. Cette route
// n'écrit donc jamais `flash_notification_dispatches` et ne fait aucun appel
// externe ; les drapeaux d'envoi restent fermés (règle commune n°3 du plan).
//
// La légalité de la transition passe par `shared/flash-transitions.ts`, pas
// par une condition écrite ici (règle commune n°4). Un seul cas y échappe
// nécessairement : rester sur `publiee` n'est pas une transition légale selon
// ce graphe (`from === to` est refusé), donc l'idempotence — deux clics ne
// publient qu'une fois, la seconde réponse dit que c'était déjà publié
// plutôt que d'échouer — est traitée avant d'appeler
// `assertLegalFlashVersionTransition`, pas en réinterprétant son refus.
//
// Verrou : même motif que decision.ts et correction.ts, un seul
// `SELECT ... FOR UPDATE` protège contre deux publications simultanées ; la
// seconde transaction, une fois le verrou relâché, relit un statut déjà
// `publiee` et prend la branche idempotente au lieu d'échouer.
//
// `published_by` (migration 20260905130000) enregistre qui publie,
// distinctement de `validated_by` qui enregistre qui a validé.

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq } from "drizzle-orm";
import { db } from "../../../../db/index.js";
import { flashInfoEvents, flashInfoVersions, flashInfos } from "../../../../db/schema.js";
import { handleApi, methodNotAllowed } from "../../../_shared/response.js";
import { HttpError } from "../../../_shared/auth.js";
import {
  assertFlashValidationAccess,
  flashProposalRouteId,
  requireFlashActor,
} from "../../../_shared/flash-access.js";
import { toFlashValidationAccessPayload, toFlashVersionPayload, type FlashVersionRow } from "../../../_shared/flash-response.js";
import { assertLegalFlashVersionTransition, FlashTransitionError } from "../../../../shared/flash-transitions.js";
import type { FlashValidationDecision } from "../../../../shared/flash-validation-access.js";

const VERSION_COLUMNS = {
  id: flashInfoVersions.id,
  flashInfoId: flashInfoVersions.flashInfoId,
  version: flashInfoVersions.version,
  status: flashInfoVersions.status,
  title: flashInfoVersions.title,
  bodyMarkdown: flashInfoVersions.bodyMarkdown,
  importance: flashInfoVersions.importance,
  channels: flashInfoVersions.channels,
  expiresAt: flashInfoVersions.expiresAt,
  proposedBy: flashInfoVersions.proposedBy,
  validatedBy: flashInfoVersions.validatedBy,
  validatedAt: flashInfoVersions.validatedAt,
  publishedAt: flashInfoVersions.publishedAt,
  publishedBy: flashInfoVersions.publishedBy,
  createdAt: flashInfoVersions.createdAt,
  updatedAt: flashInfoVersions.updatedAt,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return methodNotAllowed(res, ["POST"]);
  }

  return handleApi(res, async () => {
    const actor = await requireFlashActor(req);
    const flashInfoId = flashProposalRouteId(req);

    const outcome = await db.transaction(async (tx) => {
      const [current] = await tx
        .select(VERSION_COLUMNS)
        .from(flashInfoVersions)
        .innerJoin(
          flashInfos,
          and(
            eq(flashInfoVersions.flashInfoId, flashInfos.id),
            eq(flashInfoVersions.version, flashInfos.currentVersion)
          )
        )
        .where(
          and(eq(flashInfoVersions.flashInfoId, flashInfoId), eq(flashInfoVersions.institutionId, actor.institutionId))
        )
        .limit(1)
        .for("update");

      if (!current) {
        throw new HttpError(404, "Information flash introuvable.");
      }

      const access = assertFlashValidationAccess(actor, current.proposedBy);

      if (current.status === "publiee") {
        return { version: current as FlashVersionRow, access, alreadyPublished: true };
      }

      try {
        assertLegalFlashVersionTransition(current.status, "publiee");
      } catch (error) {
        if (error instanceof FlashTransitionError) {
          throw new HttpError(409, "Transition refusée : " + error.reason);
        }
        throw error;
      }

      const now = new Date();
      // On ne publie pas une information périmée (règle du plan, LOT 1).
      if (current.expiresAt.getTime() <= now.getTime()) {
        throw new HttpError(409, "Cette information a expiré ; elle ne peut plus être publiée.");
      }

      const [updated] = await tx
        .update(flashInfoVersions)
        .set({ status: "publiee", publishedBy: actor.user.id, publishedAt: now })
        .where(
          and(
            eq(flashInfoVersions.id, current.id),
            eq(flashInfoVersions.institutionId, actor.institutionId),
            eq(flashInfoVersions.status, "validee")
          )
        )
        .returning(VERSION_COLUMNS);

      if (!updated) {
        // Le verrou `for update` rend ce cas improbable en pratique ; gardé
        // comme filet, jamais comme seule protection contre la concurrence
        // (même motif que decision.ts et correction.ts).
        throw new HttpError(409, "Cette information vient d'être publiée par quelqu'un d'autre.");
      }

      await tx.insert(flashInfoEvents).values({
        institutionId: actor.institutionId,
        flashInfoId: current.flashInfoId,
        resourceType: "version",
        resourceId: current.id,
        eventType: "flash_info.published",
        actorUserId: actor.user.id,
        actorType: "user",
        summary: {
          selfValidated: access.selfValidated,
          grantedByService: access.grantedByService,
          validatedBy: current.validatedBy,
        },
      });

      return { version: updated as FlashVersionRow, access, alreadyPublished: false };
    });

    return respond(outcome);
  });
}

function respond(outcome: { version: FlashVersionRow; access: FlashValidationDecision; alreadyPublished: boolean }) {
  return {
    version: toFlashVersionPayload(outcome.version),
    access: toFlashValidationAccessPayload(outcome.access),
    alreadyPublished: outcome.alreadyPublished,
  };
}

// Aucun contenu attendu dans le corps : publier ne prend pas de paramètres,
// seul l'identifiant de route compte. Même motif que les autres commandes
// sans payload de l'API (parseur HTTP désactivé plutôt qu'une limite de
// taille inutile).
export const config = { api: { bodyParser: false } };
