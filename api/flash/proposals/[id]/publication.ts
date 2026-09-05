// POST /api/flash/proposals/[id]/publication — LOT 1 du plan de publication
// flash (docs/operations/PLAN_FLASH_PUBLICATION_2026-09-05.md), complétée par
// le LOT 3 du plan de publication publique
// (docs/operations/PLAN_FLASH_PUBLIC_2026-09-05.md).
//
// Transition `validee` -> `publiee`, ouverte par le MÊME service que la
// validation (`assertFlashValidationAccess`, `decideFlashValidationAccess`),
// jamais par le rôle applicatif seul. Décision d'Adel (§13, T071F) : valider
// n'est pas publier, ce sont deux gestes humains distincts.
//
// Depuis le LOT 3 du plan de publication publique, cette route écrit la
// TRACE des envois dans `flash_notification_dispatches` (via le module pur
// `shared/flash-dispatch-plan.ts`, jamais une règle réécrite ici) mais ne
// fait toujours aucun appel externe : chaque ligne naît au statut
// `simulated`, jamais `sent`, tant que les drapeaux d'envoi restent fermés
// (règle commune n°3 du plan). Écrire `sent` ici mentirait sur ce qui a
// réellement notifié quelqu'un et fausserait silencieusement le calcul des
// trois ensembles d'une future correction (shared/flash-audience-correction.ts
// ne compte que `sent`) — c'est le point le plus délicat du LOT 3, prouvé par
// scripts/test-flash-dispatch-plan.mjs et scripts/test-flash-notification-dispatch.mjs.
//
// La légalité de la transition passe par `shared/flash-transitions.ts`, pas
// par une condition écrite ici (règle commune n°4). Un seul cas y échappe
// nécessairement : rester sur `publiee` n'est pas une transition légale selon
// ce graphe (`from === to` est refusé), donc l'idempotence — deux clics ne
// publient qu'une fois, la seconde réponse dit que c'était déjà publié
// plutôt que d'échouer, SANS rejouer l'écriture des lignes d'envoi — est
// traitée avant d'appeler `assertLegalFlashVersionTransition`, pas en
// réinterprétant son refus. Défense en profondeur côté base : deux index
// uniques partiels (migration 20260905150000) refusent toute ligne en double
// même si ce garde applicatif était un jour contourné.
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
import {
  flashInfoAudiences,
  flashInfoEvents,
  flashInfoSmsContacts,
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
import { toFlashValidationAccessPayload, toFlashVersionPayload, type FlashVersionRow } from "../../../_shared/flash-response.js";
import { assertLegalFlashVersionTransition, FlashTransitionError } from "../../../../shared/flash-transitions.js";
import type { FlashValidationDecision } from "../../../../shared/flash-validation-access.js";
import { resolveFlashDispatchPlan } from "../../../../shared/flash-dispatch-plan.js";
import type { FlashNotificationChannel } from "../../../../shared/flash-audience-correction.js";
import type { FlashImportance } from "../../../../shared/flash-version-diff.js";
import { buildFlashCommunicationBridgeRequest } from "../../../../shared/flash-communication-bridge.js";
import { persistFlashCommunicationBridge } from "../../../_shared/flash-communication-bridge-persistence.js";

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

      // LOT 3 du plan de publication publique : écrire la trace des envois,
      // calculée par le module pur (jamais recalculée ici) à partir de
      // l'audience et des contacts SMS RÉELS de cette version — jamais d'une
      // audience redemandée au client.
      const [audienceRows, smsContactRows] = await Promise.all([
        tx
          .select({ groupRef: flashInfoAudiences.groupRef })
          .from(flashInfoAudiences)
          .where(
            and(
              eq(flashInfoAudiences.versionId, current.id),
              eq(flashInfoAudiences.institutionId, actor.institutionId)
            )
          ),
        tx
          .select({ contactRef: flashInfoSmsContacts.contactRef })
          .from(flashInfoSmsContacts)
          .where(
            and(
              eq(flashInfoSmsContacts.versionId, current.id),
              eq(flashInfoSmsContacts.institutionId, actor.institutionId)
            )
          ),
      ]);

      const dispatchPlan = resolveFlashDispatchPlan({
        importance: updated.importance as FlashImportance,
        channels: updated.channels as FlashNotificationChannel[],
        groupRefs: audienceRows.map((row) => row.groupRef),
        smsContactRefs: smsContactRows.map((row) => row.contactRef),
      });

      if (dispatchPlan.length > 0) {
        // État `simulated`, jamais `sent`, tant que les drapeaux d'envoi sont
        // fermés (voir l'en-tête du fichier). `onConflictDoNothing` sans
        // cible retombe sur les deux index uniques partiels de la migration
        // 20260905150000, quel que soit le canal de la ligne.
        await tx
          .insert(flashNotificationDispatches)
          .values(
            dispatchPlan.map((target) => ({
              institutionId: actor.institutionId,
              versionId: current.id,
              channel: target.channel,
              groupRef: target.groupRef,
              contactRef: target.contactRef,
              status: "simulated" as const,
            }))
          )
          .onConflictDoNothing();
      }

      // LOT 4 du plan de publication publique : raccorder le canal email du
      // plan d'envoi a la file durable existante du centre de communication
      // (spec 005), jamais une seconde file (regle commune n4). Reste inerte
      // tant que `communication_settings.module_enabled` est faux (defaut,
      // voir api/_shared/flash-communication-bridge-persistence.ts) — aucun
      // drapeau n'est ouvert par cette route.
      const communicationBridgeRequest = buildFlashCommunicationBridgeRequest({
        flashInfoVersionId: updated.id,
        title: updated.title,
        bodyMarkdown: updated.bodyMarkdown,
        dispatchTargets: dispatchPlan,
      });
      const communicationBridgeOutcome = await persistFlashCommunicationBridge({
        tx,
        institutionId: actor.institutionId,
        actorUserId: actor.user.id,
        request: communicationBridgeRequest,
        idempotencySecret: process.env.FLASH_COMMUNICATION_BRIDGE_HMAC_SECRET,
      });

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
          simulatedDispatchCount: dispatchPlan.length,
          communicationBridgeEnqueued: communicationBridgeOutcome.enqueued,
          communicationBridgeReason: communicationBridgeOutcome.enqueued
            ? null
            : communicationBridgeOutcome.reason,
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
