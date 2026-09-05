// POST /api/flash/proposals/[id]/correction — LOT 4 du plan de persistance flash.
//
// Corrige une information flash DÉJÀ PUBLIÉE (seule transition légale depuis
// `publiee` : `flash_guard_version`/`shared/flash-transitions.ts` mènent à
// `modifiee`, un état terminal). Comme "valider avec modifications" au LOT 3,
// la correction mute le contenu de la MÊME ligne (title/body/importance/
// channels/expiresAt ne sont pas des colonnes immuables du trigger) et fait
// suivre son statut ; elle ne crée pas de seconde version.
//
// Les trois ensembles (maintenus/retirés/ajoutés) et l'éligibilité des canaux
// sont calculés côté serveur par `resolveFlashAudienceTreatment`
// (shared/flash-audience-correction.ts, §13) à partir de l'audience RÉELLE des
// deux contenus et de la trace RÉELLE de `flash_notification_dispatches`
// filtrée sur `status = 'sent'` — jamais depuis l'importance déclarée. Cette
// trace est ce qui permet à une flash urgente déjà notifiée, puis ramenée à
// "normale", de rester corrigible (cas du 5 septembre 2026, voir le module).
// L'écart (décisif/forme) vient de `analyzeFlashVersionGap`
// (shared/flash-version-diff.ts). Aucune de ces deux règles n'est réécrite ici
// (règle commune n°5 du plan).
//
// Aucun envoi : cette route n'écrit jamais dans `flash_notification_dispatches`
// et ne fait aucun appel externe. Elle enregistre la décision humaine de
// correction (`flash_correction_decisions`) comme confirmée par l'auteur de la
// requête, qui a déjà l'autorisation de validation de cette information (même
// vérification qu'au LOT 3, `assertFlashValidationAccess`) : la ligne doit
// naître "en_attente" (trigger d'insertion), puis est immédiatement transitée
// vers "confirmee" dans la même transaction, ce que le trigger de mise à jour
// autorise explicitement depuis "en_attente".

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq } from "drizzle-orm";
import { db } from "../../../../db/index.js";
import {
  flashCorrectionDecisions,
  flashInfoAudiences,
  flashInfoEvents,
  flashInfoVersions,
  flashInfos,
  flashNotificationDispatches,
} from "../../../../db/schema.js";
import { handleApi, methodNotAllowed } from "../../../_shared/response.js";
import { HttpError } from "../../../_shared/auth.js";
import {
  assertFlashValidationAccess,
  flashProposalRouteId,
  requireFlashActor,
} from "../../../_shared/flash-access.js";
import {
  toFlashAudienceTreatmentPayload,
  toFlashVersionPayload,
  type FlashVersionRow,
} from "../../../_shared/flash-response.js";
import { parseFlashProposalInput, FlashProposalInputError } from "../../../../shared/flash-proposal-input.js";
import { analyzeFlashVersionGap, type FlashGapKind } from "../../../../shared/flash-version-diff.js";
import { resolveFlashAudienceTreatment, type FlashAudienceTreatment } from "../../../../shared/flash-audience-correction.js";
import { assertLegalFlashVersionTransition, FlashTransitionError } from "../../../../shared/flash-transitions.js";

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
    return parseFlashProposalInput(body);
  } catch (error) {
    if (error instanceof FlashProposalInputError) {
      throw new HttpError(400, "Correction invalide : " + error.reason);
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

      // Même vérification qu'au LOT 3 : voir/corriger reste ouvert par le
      // service détenu par l'acteur, jamais par un rôle applicatif.
      assertFlashValidationAccess(actor, current.proposedBy);

      try {
        assertLegalFlashVersionTransition(current.status, "modifiee");
      } catch (error) {
        if (error instanceof FlashTransitionError) {
          throw new HttpError(409, "Transition refusée : " + error.reason);
        }
        throw error;
      }

      const previousAudienceRows = await tx
        .select({ groupRef: flashInfoAudiences.groupRef })
        .from(flashInfoAudiences)
        .where(
          and(
            eq(flashInfoAudiences.versionId, current.id),
            eq(flashInfoAudiences.institutionId, actor.institutionId)
          )
        );

      const previousChannelRows = await tx
        .selectDistinct({ channel: flashNotificationDispatches.channel })
        .from(flashNotificationDispatches)
        .where(
          and(
            eq(flashNotificationDispatches.versionId, current.id),
            eq(flashNotificationDispatches.institutionId, actor.institutionId),
            eq(flashNotificationDispatches.status, "sent")
          )
        );

      const gap = analyzeFlashVersionGap(
        { title: current.title, bodyMarkdown: current.bodyMarkdown, importance: current.importance },
        { title: input.title, bodyMarkdown: input.bodyMarkdown, importance: input.importance }
      );

      // Jamais depuis l'importance déclarée : `previousNotifiedChannels` vient
      // de la trace réelle des envois, pas du champ `importance` de la
      // version précédente (§13, cas du 5 septembre).
      const treatment = resolveFlashAudienceTreatment({
        previousAudience: previousAudienceRows.map((row) => row.groupRef),
        nextAudience: input.groupRefs,
        previousNotifiedChannels: previousChannelRows.map((row) => row.channel),
        nextImportance: input.importance,
      });

      const now = new Date();

      const [updated] = await tx
        .update(flashInfoVersions)
        .set({
          status: "modifiee",
          title: input.title,
          bodyMarkdown: input.bodyMarkdown,
          importance: input.importance,
          channels: input.channels,
          expiresAt: input.expiresAt,
          supersededAt: now,
        })
        .where(
          and(
            eq(flashInfoVersions.id, current.id),
            eq(flashInfoVersions.institutionId, actor.institutionId),
            eq(flashInfoVersions.status, "publiee")
          )
        )
        .returning(VERSION_COLUMNS);

      if (!updated) {
        // Le verrou `for update` rend ce cas improbable en pratique ; gardé
        // comme filet, jamais comme seule protection contre la concurrence
        // (même motif que decision.ts, LOT 3).
        throw new HttpError(409, "Cette information vient d'être corrigée par quelqu'un d'autre.");
      }

      await tx.delete(flashInfoAudiences).where(eq(flashInfoAudiences.versionId, current.id));
      await tx.insert(flashInfoAudiences).values(
        input.groupRefs.map((groupRef) => ({
          institutionId: actor.institutionId,
          versionId: current.id,
          groupRef,
        }))
      );

      const [correction] = await tx
        .insert(flashCorrectionDecisions)
        .values({
          institutionId: actor.institutionId,
          flashInfoId: current.flashInfoId,
          versionId: current.id,
          gapKind: gap.kind,
          initiatedBy: "human",
          requestedBy: actor.user.id,
          maintainedCount: treatment.maintained.length,
          removedCount: treatment.removed.length,
          addedCount: treatment.added.length,
          eligibleChannels: treatment.eligibleChannels,
        })
        .returning({ id: flashCorrectionDecisions.id });

      // La ligne doit naître "en_attente" (garde d'insertion) ; l'acteur ayant
      // déjà l'autorisation de validation de cette information, sa décision
      // de corriger est immédiatement confirmée dans la même transaction.
      await tx
        .update(flashCorrectionDecisions)
        .set({ decision: "confirmee", decidedBy: actor.user.id, decidedAt: now })
        .where(
          and(
            eq(flashCorrectionDecisions.id, correction.id),
            eq(flashCorrectionDecisions.institutionId, actor.institutionId)
          )
        );

      await tx.insert(flashInfoEvents).values({
        institutionId: actor.institutionId,
        flashInfoId: current.flashInfoId,
        resourceType: "correction_decision",
        resourceId: correction.id,
        eventType: "flash_info.corrected",
        actorUserId: actor.user.id,
        actorType: "user",
        summary: {
          gapKind: gap.kind,
          importanceChanged: gap.importanceChanged,
          normalizedTextChanged: gap.normalizedTextChanged,
          correctionPossible: treatment.correctionPossible,
          maintainedCount: treatment.maintained.length,
          removedCount: treatment.removed.length,
          addedCount: treatment.added.length,
          eligibleChannels: treatment.eligibleChannels,
          before: {
            title: current.title,
            bodyMarkdown: current.bodyMarkdown,
            importance: current.importance,
            channels: current.channels,
            expiresAt: current.expiresAt.toISOString(),
          },
          after: {
            title: input.title,
            bodyMarkdown: input.bodyMarkdown,
            importance: input.importance,
            channels: input.channels,
            expiresAt: input.expiresAt.toISOString(),
          },
        },
      });

      return { version: updated as FlashVersionRow, treatment, gapKind: gap.kind as FlashGapKind };
    });

    return respond(outcome);
  });
}

function respond(outcome: { version: FlashVersionRow; treatment: FlashAudienceTreatment; gapKind: FlashGapKind }) {
  return {
    version: toFlashVersionPayload(outcome.version),
    audienceTreatment: toFlashAudienceTreatmentPayload(outcome.treatment),
    gapKind: outcome.gapKind,
  };
}

export const config = { api: { bodyParser: { sizeLimit: "64kb" } } };
