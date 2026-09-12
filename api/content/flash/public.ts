import { requireConfiguredInstitution } from "../../_shared/institution-context.js";
// GET /api/content/flash/public — LOT 2 du plan de visibilité publique
// (docs/operations/PLAN_FLASH_PUBLIC_2026-09-05.md). Route anonyme, sans
// authentification : le site public affiche uniquement les informations
// flash dont l'audience contient FLASH_PUBLIC_AUDIENCE_GROUP_REF
// (shared/flash-visibility.ts, LOT 1) — jamais une audience ciblée.
//
// Le SQL ne fait QUE deux choses non ambiguës : filtrer sur le statut
// `publiee` et sur `expires_at > now()` (borne de performance, comme
// `api/content/public.ts`), et joindre à plat sur la seule ligne d'audience
// publique de la version (jointure directe, jamais de sous-requête corrélée
// : piège déjà payé, voir CLAUDE.md). La décision de visibilité elle-même —
// y compris la borne d'expiration à la seconde près — repasse ensuite par
// `selectVisibleFlashVersions`, seule autorité sur la règle (§4 du plan :
// réutiliser l'existant, ne pas la réécrire ici).
//
// Aucun filtre par établissement : comme `api/content/public.ts`, cette
// route sert le site public d'un seul établissement (voir CLAUDE.md).
//
// Contrat de charge strict (`toPublicFlashItemPayload`) : ni auteur, ni
// valideur, ni audience brute, ni identifiant de proposition.

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, desc, eq, gt } from "drizzle-orm";
import { db } from "../../../db/index.js";
import { flashInfoAudiences, flashInfoVersions, flashInfos } from "../../../db/schema.js";
import { handleApi, methodNotAllowed } from "../../_shared/response.js";
import { toPublicFlashItemPayload } from "../../_shared/flash-response.js";
import { FLASH_PUBLIC_AUDIENCE_GROUP_REF, selectVisibleFlashVersions } from "../../../shared/flash-visibility.js";
import { selectFlashPublicFeedPage } from "../../../shared/flash-public-feed.js";
import type { FlashImportance } from "../../../shared/flash-version-diff.js";

// Borne de la requête SQL, pas de l'affichage : voir FLASH_PUBLIC_FEED_LIMIT
// (shared/flash-public-feed.ts) pour la borne réellement affichée.
const FLASH_PUBLIC_CANDIDATE_QUERY_LIMIT = 200;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return methodNotAllowed(res, ["GET"]);
  }

  return handleApi(res, async () => {
    const now = new Date();
    const institution = await requireConfiguredInstitution();

    const rows = await db
      .select({
        id: flashInfoVersions.id,
        status: flashInfoVersions.status,
        title: flashInfoVersions.title,
        bodyMarkdown: flashInfoVersions.bodyMarkdown,
        importance: flashInfoVersions.importance,
        publishedAt: flashInfoVersions.publishedAt,
        expiresAt: flashInfoVersions.expiresAt,
      })
      .from(flashInfos)
      .innerJoin(
        flashInfoVersions,
        and(
          eq(flashInfoVersions.flashInfoId, flashInfos.id),
          eq(flashInfoVersions.version, flashInfos.publishedVersion)
        )
      )
      .innerJoin(
        flashInfoAudiences,
        and(
          eq(flashInfoAudiences.versionId, flashInfoVersions.id),
          eq(flashInfoAudiences.groupRef, FLASH_PUBLIC_AUDIENCE_GROUP_REF)
        )
      )
      .where(and(eq(flashInfoVersions.institutionId,institution.id),eq(flashInfos.institutionId,institution.id),eq(flashInfoAudiences.institutionId,institution.id),eq(flashInfoVersions.status, "publiee"), gt(flashInfoVersions.expiresAt, now)))
      .orderBy(desc(flashInfoVersions.publishedAt))
      .limit(FLASH_PUBLIC_CANDIDATE_QUERY_LIMIT);

    // La jointure ci-dessus garantit déjà la présence de l'audience publique
    // pour chaque ligne : pas de seconde requête, l'audience est connue sans
    // avoir besoin d'être relue.
    const candidates = rows.flatMap((row) =>
      row.publishedAt
        ? [{ ...row, publishedAt: row.publishedAt, audience: [FLASH_PUBLIC_AUDIENCE_GROUP_REF] }]
        : []
    );

    const visible = selectVisibleFlashVersions(candidates, { now, viewerGroupRefs: null });
    const page = selectFlashPublicFeedPage(
      visible.map((row) => ({ ...row, importance: row.importance as FlashImportance }))
    );

    const items = page.map((row) =>
      toPublicFlashItemPayload({
        id: row.id,
        title: row.title,
        bodyMarkdown: row.bodyMarkdown,
        importance: row.importance,
        publishedAt: row.publishedAt,
        expiresAt: row.expiresAt,
      })
    );

    return { items };
  });
}
