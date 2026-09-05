// GET /api/flash/validation/publishable — LOT 3 du plan de publication flash
// (docs/operations/PLAN_FLASH_PUBLICATION_2026-09-05.md).
//
// File des versions validées (`status = 'validee'`), en attente de la
// transition `validee -> publiee` (LOT 1, `POST .../publication`). Jumelle
// exacte de `api/flash/validation/queue.ts` : même accès
// (`assertFlashValidationQueueAccess`), même recalcul par item de
// l'autorisation de DÉCIDER via `decideFlashValidationAccess` — publier suit
// exactement la même règle que valider (§13, même service, jamais le rôle
// applicatif). Sans cette file, aucun écran ne peut jamais afficher le
// bouton de publication du LOT 1 : rien ne permettait jusqu'ici de savoir
// quelles versions attendent une publication.

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, asc, eq } from "drizzle-orm";
import { db } from "../../../db/index.js";
import { flashInfoVersions, flashInfos } from "../../../db/schema.js";
import { handleApi, methodNotAllowed } from "../../_shared/response.js";
import { HttpError } from "../../_shared/auth.js";
import { assertFlashValidationQueueAccess, requireFlashActor } from "../../_shared/flash-access.js";
import { toFlashAuthorNamePayload, toFlashValidationAccessPayload, toFlashVersionPayload } from "../../_shared/flash-response.js";
import { decideFlashValidationAccess } from "../../../shared/flash-validation-access.js";
import { resolveFlashAuthorNames } from "../../_shared/flash-author.js";

const FLASH_PUBLISHABLE_QUEUE_LIMIT = 200;

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
          eq(flashInfoVersions.status, "validee")
        )
      )
      .orderBy(asc(flashInfoVersions.expiresAt))
      .limit(FLASH_PUBLISHABLE_QUEUE_LIMIT + 1);

    if (rows.length > FLASH_PUBLISHABLE_QUEUE_LIMIT) {
      throw new HttpError(
        409,
        "Trop de versions validées pour afficher une file complète. Aucune liste partielle n'a été affichée."
      );
    }

    const authorNames = await resolveFlashAuthorNames(rows.map((row) => row.proposedBy));

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
        proposedByName: toFlashAuthorNamePayload(authorNames.get(row.proposedBy) ?? null),
      };
    });

    return { items };
  });
}
