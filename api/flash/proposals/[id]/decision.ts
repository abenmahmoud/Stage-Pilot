// POST /api/flash/proposals/[id]/decision — LOT 3 du plan de persistance flash.
//
// Valide, refuse, ou valide avec des modifications ("modifier" n'est pas un
// troisième statut : voir shared/flash-decision-input.ts). Un seul verrou
// transactionnel (`SELECT ... FOR UPDATE`) protège contre deux décisions
// simultanées sur la même proposition ; l'UPDATE final reste conditionné à
// `status = 'proposee'` pour ne jamais écraser une décision déjà prise
// pendant la même fenêtre. Ce lot ne publie pas (transition `validee` ->
// `publiee`) : voir le compte rendu, "Ce qui reste supposé, pas prouvé".

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq } from "drizzle-orm";
import { db } from "../../../../db/index.js";
import { flashInfoAudiences, flashInfoEvents, flashInfoVersions, flashInfos } from "../../../../db/schema.js";
import { handleApi, methodNotAllowed } from "../../../_shared/response.js";
import { HttpError } from "../../../_shared/auth.js";
import {
  assertFlashValidationAccess,
  flashProposalRouteId,
  requireFlashActor,
} from "../../../_shared/flash-access.js";
import { toFlashValidationAccessPayload, toFlashVersionPayload, type FlashVersionRow } from "../../../_shared/flash-response.js";
import { parseFlashDecisionInput, FlashDecisionInputError } from "../../../../shared/flash-decision-input.js";
import { assertLegalFlashVersionTransition, FlashTransitionError } from "../../../../shared/flash-transitions.js";
import { checkFlashProposalExpiration } from "../../../../shared/flash-expiration.js";
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
  createdAt: flashInfoVersions.createdAt,
  updatedAt: flashInfoVersions.updatedAt,
};

function parseInput(body: unknown) {
  try {
    return parseFlashDecisionInput(body);
  } catch (error) {
    if (error instanceof FlashDecisionInputError) {
      throw new HttpError(400, "Décision invalide : " + error.reason);
    }
    throw error;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return methodNotAllowed(res, ["POST"]);
  }

  return handleApi(res, async () => {
    const actor = await requireFlashActor(req);
    const flashInfoId = flashProposalRouteId(req);
    const input = parseInput(req.body);

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

      // La légalité de la transition (y compris "déjà décidée", puisque rester
      // sur place ou repartir d'un état terminal n'est jamais légale) est
      // tranchée par `flash-transitions.ts`, pas par une condition écrite ici
      // (règle du plan, LOT 3).
      try {
        assertLegalFlashVersionTransition(current.status, input.decision);
      } catch (error) {
        if (error instanceof FlashTransitionError) {
          throw new HttpError(409, "Transition refusée : " + error.reason);
        }
        throw error;
      }

      const now = new Date();
      const expiration = checkFlashProposalExpiration({
        status: current.status,
        expiresAt: current.expiresAt,
        now,
      });
      if (expiration.isExpiredWithoutValidation) {
        throw new HttpError(409, "Cette proposition a expiré ; elle ne peut plus être décidée ici.");
      }

      const edits = input.content;

      const [updated] = await tx
        .update(flashInfoVersions)
        .set({
          status: input.decision,
          validatedBy: actor.user.id,
          validatedAt: now,
          ...(edits
            ? {
                title: edits.title,
                bodyMarkdown: edits.bodyMarkdown,
                importance: edits.importance,
                channels: edits.channels,
                expiresAt: edits.expiresAt,
              }
            : {}),
        })
        .where(
          and(
            eq(flashInfoVersions.id, current.id),
            eq(flashInfoVersions.institutionId, actor.institutionId),
            eq(flashInfoVersions.status, "proposee")
          )
        )
        .returning(VERSION_COLUMNS);

      if (!updated) {
        // Le verrou `for update` rend ce cas improbable en pratique ; gardé
        // comme filet, jamais comme seule protection contre la concurrence.
        throw new HttpError(409, "Cette proposition vient d'être décidée par quelqu'un d'autre.");
      }

      if (edits) {
        await tx.delete(flashInfoAudiences).where(eq(flashInfoAudiences.versionId, current.id));
        await tx.insert(flashInfoAudiences).values(
          edits.groupRefs.map((groupRef) => ({
            institutionId: actor.institutionId,
            versionId: current.id,
            groupRef,
          }))
        );
      }

      const eventType =
        input.decision === "refusee"
          ? "flash_info.refused"
          : edits
            ? "flash_info.validated_with_changes"
            : "flash_info.validated";

      await tx.insert(flashInfoEvents).values({
        institutionId: actor.institutionId,
        flashInfoId: current.flashInfoId,
        resourceType: "version",
        resourceId: current.id,
        eventType,
        actorUserId: actor.user.id,
        actorType: "user",
        summary: {
          selfValidated: access.selfValidated,
          grantedByService: access.grantedByService,
          ...(edits
            ? {
                before: {
                  title: current.title,
                  bodyMarkdown: current.bodyMarkdown,
                  importance: current.importance,
                  channels: current.channels,
                  expiresAt: current.expiresAt.toISOString(),
                },
                after: {
                  title: edits.title,
                  bodyMarkdown: edits.bodyMarkdown,
                  importance: edits.importance,
                  channels: edits.channels,
                  expiresAt: edits.expiresAt.toISOString(),
                },
              }
            : {}),
        },
      });

      return { version: updated as FlashVersionRow, access };
    });

    return respond(outcome);
  });
}

function respond(outcome: { version: FlashVersionRow; access: FlashValidationDecision }) {
  return {
    version: toFlashVersionPayload(outcome.version),
    access: toFlashValidationAccessPayload(outcome.access),
  };
}

export const config = { api: { bodyParser: { sizeLimit: "64kb" } } };
