import { and, desc, eq, gt } from "drizzle-orm";
import { db } from "../../db/index.js";
import { flashInfoAudiences, flashInfoVersions, flashInfos } from "../../db/schema.js";
import {
  buildPublicFlashAgentContext,
  type PublicFlashAgentContext,
} from "../../shared/public-flash-agent-context.js";
import { selectFlashPublicFeedPage } from "../../shared/flash-public-feed.js";
import {
  FLASH_PUBLIC_AUDIENCE_GROUP_REF,
  selectVisibleFlashVersions,
} from "../../shared/flash-visibility.js";
import type { FlashImportance } from "../../shared/flash-version-diff.js";

const MAX_DATABASE_CANDIDATES = 100;

export async function loadPublicFlashAgentContext(input: {
  institutionId: string;
  query: string;
  now: Date;
}): Promise<PublicFlashAgentContext> {
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
        eq(flashInfoVersions.version, flashInfos.publishedVersion),
        eq(flashInfoVersions.institutionId, input.institutionId)
      )
    )
    .innerJoin(
      flashInfoAudiences,
      and(
        eq(flashInfoAudiences.versionId, flashInfoVersions.id),
        eq(flashInfoAudiences.institutionId, input.institutionId),
        eq(flashInfoAudiences.groupRef, FLASH_PUBLIC_AUDIENCE_GROUP_REF)
      )
    )
    .where(and(
      eq(flashInfos.institutionId, input.institutionId),
      eq(flashInfoVersions.status, "publiee"),
      gt(flashInfoVersions.expiresAt, input.now)
    ))
    .orderBy(desc(flashInfoVersions.publishedAt))
    .limit(MAX_DATABASE_CANDIDATES);

  const candidates = rows.flatMap((row) =>
    row.publishedAt
      ? [{
          ...row,
          publishedAt: row.publishedAt,
          audience: [FLASH_PUBLIC_AUDIENCE_GROUP_REF],
          importance: row.importance as FlashImportance,
        }]
      : []
  );
  const visible = selectVisibleFlashVersions(candidates, {
    now: input.now,
    viewerGroupRefs: null,
  });
  const page = selectFlashPublicFeedPage(visible);
  return buildPublicFlashAgentContext({
    query: input.query,
    items: page.map((row) => ({
      id: row.id,
      title: row.title,
      bodyMarkdown: row.bodyMarkdown,
      importance: row.importance,
      publishedAt: row.publishedAt.toISOString(),
      expiresAt: row.expiresAt.toISOString(),
    })),
  });
}
