// GET /api/flash/validation/expired-after-validation — LOT 2 du plan de
// publication flash (T071F). Rend consultable le compte des propositions
// expirées APRÈS validation mais sans avoir jamais été publiées
// (`status = 'expiree_sans_publication'`), séparément du compte des
// propositions jamais validées (`api/flash/validation/expired.ts`,
// T071D) : les deux causes n'appellent pas la même correction
// d'organisation (règle du plan, LOT 2), donc jamais le même compteur.
// Même public que la file de validation (LOT 3, `assertFlashValidationQueueAccess`)
// et même route jumelle : ce sont les mêmes comptes qui doivent voir ce qui
// leur a échappé, jamais un rôle applicatif seul.

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../../../db/index.js";
import { flashInfoVersions, flashInfos } from "../../../db/schema.js";
import { handleApi, methodNotAllowed } from "../../_shared/response.js";
import { HttpError } from "../../_shared/auth.js";
import { assertFlashValidationQueueAccess, requireFlashActor } from "../../_shared/flash-access.js";
import { toFlashVersionPayload } from "../../_shared/flash-response.js";

const FLASH_EXPIRED_AFTER_VALIDATION_LIST_LIMIT = 200;

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
        publishedBy: flashInfoVersions.publishedBy,
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
          eq(flashInfoVersions.status, "expiree_sans_publication")
        )
      )
      .orderBy(desc(flashInfoVersions.expiresAt))
      .limit(FLASH_EXPIRED_AFTER_VALIDATION_LIST_LIMIT + 1);

    if (rows.length > FLASH_EXPIRED_AFTER_VALIDATION_LIST_LIMIT) {
      throw new HttpError(
        409,
        "Trop de propositions expirées après validation pour afficher une liste complète. Aucune liste partielle n'a été affichée."
      );
    }

    return { count: rows.length, items: rows.map(toFlashVersionPayload) };
  });
}
