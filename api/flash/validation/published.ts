// GET /api/flash/validation/published — LOT 3 du plan de publication flash
// (docs/operations/PLAN_FLASH_PUBLICATION_2026-09-05.md).
//
// File des versions publiées (`status = 'publiee'`), pour brancher enfin
// `POST /api/flash/proposals/[id]/correction.js` (écrit au LOT 4 du plan de
// persistance, jamais appelé par aucun écran jusqu'ici). Même accès que la
// file de validation (`assertFlashValidationQueueAccess`) : corriger suit la
// même autorisation que valider/publier (§13).
//
// `audience` (les `group_ref` réels de la version courante) est renvoyée en
// plus de la version elle-même : sans elle, l'écran de correction ne peut pas
// préremplir le public actuel et forcerait à le ressaisir entièrement à
// l'aveugle. Récupérée par une seconde requête à plat (jamais une
// sous-requête corrélée Drizzle : piège déjà payé, voir CLAUDE.md) puis
// regroupée en mémoire par version.

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "../../../db/index.js";
import { flashInfoAudiences, flashInfoVersions, flashInfos } from "../../../db/schema.js";
import { handleApi, methodNotAllowed } from "../../_shared/response.js";
import { HttpError } from "../../_shared/auth.js";
import { assertFlashValidationQueueAccess, requireFlashActor } from "../../_shared/flash-access.js";
import { toFlashAudiencePayload, toFlashAuthorNamePayload, toFlashVersionPayload } from "../../_shared/flash-response.js";
import { resolveFlashAuthorNames } from "../../_shared/flash-author.js";

const FLASH_PUBLISHED_LIST_LIMIT = 200;

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
          eq(flashInfoVersions.status, "publiee")
        )
      )
      .orderBy(desc(flashInfoVersions.publishedAt))
      .limit(FLASH_PUBLISHED_LIST_LIMIT + 1);

    if (rows.length > FLASH_PUBLISHED_LIST_LIMIT) {
      throw new HttpError(
        409,
        "Trop de versions publiées pour afficher une liste complète. Aucune liste partielle n'a été affichée."
      );
    }

    const versionIds = rows.map((row) => row.id);
    const audienceRows =
      versionIds.length === 0
        ? []
        : await db
            .select({ versionId: flashInfoAudiences.versionId, groupRef: flashInfoAudiences.groupRef })
            .from(flashInfoAudiences)
            .where(
              and(
                inArray(flashInfoAudiences.versionId, versionIds),
                eq(flashInfoAudiences.institutionId, actor.institutionId)
              )
            );

    const audienceByVersion = new Map<string, string[]>();
    for (const row of audienceRows) {
      const existing = audienceByVersion.get(row.versionId) ?? [];
      existing.push(row.groupRef);
      audienceByVersion.set(row.versionId, existing);
    }

    const authorNames = await resolveFlashAuthorNames(rows.map((row) => row.proposedBy));

    const items = rows.map((row) => ({
      version: toFlashVersionPayload(row),
      audience: toFlashAudiencePayload(audienceByVersion.get(row.id) ?? []),
      proposedByName: toFlashAuthorNamePayload(authorNames.get(row.proposedBy) ?? null),
    }));

    return { count: items.length, items };
  });
}
