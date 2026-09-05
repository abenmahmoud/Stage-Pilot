// GET /api/flash/validation/expired — LOT 5 du plan de persistance flash
// (T071D). Rend consultable le compte des propositions expirées sans
// validation (`status = 'expiree_sans_validation'`), pour ajuster ensuite les
// délais ou le nombre de valideurs. Même public que la file de validation
// (LOT 3, `assertFlashValidationQueueAccess`) : ce sont les mêmes comptes qui
// doivent voir ce qui leur a échappé, jamais un rôle applicatif seul.

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../../../db/index.js";
import { flashInfoVersions, flashInfos } from "../../../db/schema.js";
import { handleApi, methodNotAllowed } from "../../_shared/response.js";
import { HttpError } from "../../_shared/auth.js";
import { assertFlashValidationQueueAccess, requireFlashActor } from "../../_shared/flash-access.js";
import { toFlashVersionPayload } from "../../_shared/flash-response.js";

const FLASH_EXPIRED_LIST_LIMIT = 200;

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
          eq(flashInfoVersions.status, "expiree_sans_validation")
        )
      )
      .orderBy(desc(flashInfoVersions.expiresAt))
      .limit(FLASH_EXPIRED_LIST_LIMIT + 1);

    if (rows.length > FLASH_EXPIRED_LIST_LIMIT) {
      throw new HttpError(
        409,
        "Trop de propositions expirées pour afficher une liste complète. Aucune liste partielle n'a été affichée."
      );
    }

    return { count: rows.length, items: rows.map(toFlashVersionPayload) };
  });
}
