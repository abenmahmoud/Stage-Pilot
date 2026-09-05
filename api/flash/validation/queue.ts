// GET /api/flash/validation/queue — LOT 3 du plan de persistance flash.
//
// File des propositions en attente (`status = 'proposee'`), ouverte par le
// service `referent_numerique`/`ddfpt` (ou superadmin), jamais par le rôle
// applicatif (§13, `assertFlashValidationQueueAccess`). Pour chaque
// proposition, l'autorisation de DÉCIDER (`FlashValidationAccessPayload`,
// LOT 1) est recalculée par proposition : voir une proposition dans la file
// ne veut pas dire pouvoir la décider (auto-validation éventuellement fermée).

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, asc, eq } from "drizzle-orm";
import { db } from "../../../db/index.js";
import { flashInfoVersions, flashInfos } from "../../../db/schema.js";
import { handleApi, methodNotAllowed } from "../../_shared/response.js";
import { HttpError } from "../../_shared/auth.js";
import { assertFlashValidationQueueAccess, requireFlashActor } from "../../_shared/flash-access.js";
import { toFlashValidationAccessPayload, toFlashVersionPayload } from "../../_shared/flash-response.js";
import { decideFlashValidationAccess } from "../../../shared/flash-validation-access.js";

const FLASH_VALIDATION_QUEUE_LIMIT = 200;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return methodNotAllowed(res, ["GET"]);
  }

  return handleApi(res, async () => {
    const actor = await requireFlashActor(req);
    assertFlashValidationQueueAccess(actor);

    const rows = await db
      .select({
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
      })
      .from(flashInfos)
      .innerJoin(
        flashInfoVersions,
        and(
          eq(flashInfoVersions.flashInfoId, flashInfos.id),
          eq(flashInfoVersions.version, flashInfos.currentVersion)
        )
      )
      .where(
        and(
          eq(flashInfos.institutionId, actor.institutionId),
          eq(flashInfoVersions.status, "proposee")
        )
      )
      .orderBy(asc(flashInfoVersions.expiresAt))
      .limit(FLASH_VALIDATION_QUEUE_LIMIT + 1);

    if (rows.length > FLASH_VALIDATION_QUEUE_LIMIT) {
      throw new HttpError(
        409,
        "Trop de propositions en attente pour afficher une file complète. Aucune liste partielle n'a été affichée."
      );
    }

    const items = rows.map((row) => {
      const access = decideFlashValidationAccess({
        role: actor.user.role,
        serviceCodes: actor.serviceCodes,
        proposedBy: row.proposedBy,
        actorId: actor.user.id,
      });
      return {
        version: toFlashVersionPayload(row),
        access: toFlashValidationAccessPayload(access),
      };
    });

    return { items };
  });
}
