// POST /api/flash/proposals — LOT 2 du plan de persistance flash.
//
// Crée une information flash et sa première version. L'auteur vient
// toujours de la session (`requireFlashActor`), jamais du corps de la
// requête. L'expiration est obligatoire (contrainte déjà portée par la
// migration LOT 1 et revérifiée ici avant d'écrire). Idempotence sur un
// double envoi via l'en-tête `Idempotency-Key`, même motif que
// `api/support/requests/index.ts`.

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq } from "drizzle-orm";
import { db } from "../../../db/index.js";
import { flashInfoAudiences, flashInfoEvents, flashInfoVersions, flashInfos } from "../../../db/schema.js";
import { handleApi, methodNotAllowed } from "../../_shared/response.js";
import { HttpError } from "../../_shared/auth.js";
import { requireFlashActor } from "../../_shared/flash-access.js";
import { flashIdempotencyHash, flashIdempotencyKey } from "../../_shared/flash-idempotency.js";
import { toFlashVersionPayload, type FlashVersionRow } from "../../_shared/flash-response.js";
import { parseFlashProposalInput, FlashProposalInputError } from "../../../shared/flash-proposal-input.js";

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

function isCheckViolation(error: unknown): boolean {
  return Boolean(error) && typeof error === "object" && (error as { code?: string }).code === "23514";
}

function parseInput(body: unknown) {
  try {
    return parseFlashProposalInput(body);
  } catch (error) {
    if (error instanceof FlashProposalInputError) {
      throw new HttpError(400, "Proposition invalide : " + error.reason);
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
    const idempotencyHash = flashIdempotencyHash(flashIdempotencyKey(req));
    const input = parseInput(req.body);

    let outcome: { version: FlashVersionRow; duplicate: boolean };
    try {
      outcome = await db.transaction(async (tx) => {
        const [created] = await tx
          .insert(flashInfos)
          .values({
            institutionId: actor.institutionId,
            createdBy: actor.user.id,
            idempotencyKeyHash: idempotencyHash,
          })
          .onConflictDoNothing({
            target: [flashInfos.institutionId, flashInfos.idempotencyKeyHash],
          })
          .returning({ id: flashInfos.id });

        if (!created) {
          const [existing] = await tx
            .select({ id: flashInfos.id })
            .from(flashInfos)
            .where(
              and(
                eq(flashInfos.institutionId, actor.institutionId),
                eq(flashInfos.idempotencyKeyHash, idempotencyHash),
                eq(flashInfos.createdBy, actor.user.id)
              )
            )
            .limit(1);
          // L'idempotence évite une seconde écriture ; elle ne doit jamais
          // donner accès à la proposition d'un autre auteur.
          if (!existing) {
            throw new HttpError(409, "Cet envoi ne peut pas être repris par ce compte.");
          }
          const [version] = await tx
            .select(VERSION_COLUMNS)
            .from(flashInfoVersions)
            .where(and(eq(flashInfoVersions.flashInfoId, existing.id), eq(flashInfoVersions.version, 1)))
            .limit(1);
          if (!version) {
            throw new HttpError(409, "La proposition existante n'a pas pu être relue.");
          }
          return { version, duplicate: true };
        }

        const [version] = await tx
          .insert(flashInfoVersions)
          .values({
            institutionId: actor.institutionId,
            flashInfoId: created.id,
            version: 1,
            title: input.title,
            bodyMarkdown: input.bodyMarkdown,
            importance: input.importance,
            channels: input.channels,
            expiresAt: input.expiresAt,
            proposedBy: actor.user.id,
          })
          .returning(VERSION_COLUMNS);

        await tx.insert(flashInfoAudiences).values(
          input.groupRefs.map((groupRef) => ({
            institutionId: actor.institutionId,
            versionId: version.id,
            groupRef,
          }))
        );

        await tx.insert(flashInfoEvents).values({
          institutionId: actor.institutionId,
          flashInfoId: created.id,
          resourceType: "version",
          resourceId: version.id,
          eventType: "flash_info.proposed",
          actorUserId: actor.user.id,
          actorType: "user",
          summary: { importance: input.importance, channels: input.channels },
        });

        return { version, duplicate: false };
      });
    } catch (error) {
      if (isCheckViolation(error)) {
        throw new HttpError(400, "Combinaison de canaux et d'importance invalide.");
      }
      throw error;
    }

    res.status(outcome.duplicate ? 200 : 201);
    return { version: toFlashVersionPayload(outcome.version), duplicate: outcome.duplicate };
  });
}

export const config = { api: { bodyParser: { sizeLimit: "64kb" } } };
