// GET /api/flash/proposals/mine — LOT 2 du plan de persistance flash.
//
// Les propositions de l'auteur connecté (la session, jamais un identifiant du
// corps ou de la query string), avec l'état de leur version courante.
// `flash_infos.created_by` est immuable (trigger `flash_guard_root`,
// migration LOT 1) : il identifie l'auteur d'origine même après une
// modification ultérieure par le référent numérique ou la DDFPT (LOT 3).

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../../../db/index.js";
import { flashInfoVersions, flashInfos } from "../../../db/schema.js";
import { handleApi, methodNotAllowed } from "../../_shared/response.js";
import { HttpError } from "../../_shared/auth.js";
import { requireFlashActor } from "../../_shared/flash-access.js";
import { toFlashVersionPayload } from "../../_shared/flash-response.js";

const FLASH_PROPOSALS_MINE_LIMIT = 200;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return methodNotAllowed(res, ["GET"]);
  }

  return handleApi(res, async () => {
    const actor = await requireFlashActor(req);

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
      .where(and(eq(flashInfos.institutionId, actor.institutionId), eq(flashInfos.createdBy, actor.user.id)))
      .orderBy(desc(flashInfoVersions.createdAt))
      .limit(FLASH_PROPOSALS_MINE_LIMIT + 1);

    if (rows.length > FLASH_PROPOSALS_MINE_LIMIT) {
      throw new HttpError(
        409,
        "Trop de propositions pour afficher une liste complète. Aucune liste partielle n'a été affichée."
      );
    }

    return { proposals: rows.map((row) => toFlashVersionPayload(row)) };
  });
}
