import { and, desc, eq, isNotNull, ne, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { siteContentItems, siteContentVersions } from '../../db/schema.js';
import { authorizedNews, type PersonalNewsFeed } from '../../shared/personal-news.js';
import type { HomeIdentity, HomeTarget } from './personal-home-service.js';
import { requireConfiguredInstitution, assertLegacySingleInstitutionMode } from './institution-context.js';
import { HttpError } from './auth.js';

export async function readAuthorizedNews(identity: HomeIdentity, targets: HomeTarget[], now: Date, article?: string) {
  const institution = await requireConfiguredInstitution();
  if (identity.institutionId !== institution.id) throw new HttpError(403, 'Information indisponible.');
  await assertLegacySingleInstitutionMode(institution.id);
  const scope = { personType: identity.personType, classRefs: targets.flatMap(t => t.classRef ? [t.classRef] : []) };
  const profile = { student: 'eleves', guardian: 'parents', staff: 'personnels' }[identity.personType];
  const rows = await db.select({ item: siteContentItems, snapshot: siteContentVersions.snapshot }).from(siteContentItems)
    .innerJoin(siteContentVersions, and(eq(siteContentVersions.contentId, siteContentItems.id), eq(siteContentVersions.version, siteContentItems.publishedVersion)))
    .where(and(isNotNull(siteContentItems.publishedVersion), isNotNull(siteContentItems.publishedAt), ne(siteContentItems.status, 'archive'),
      article ? eq(siteContentItems.id, article) : and(
        sql`(${siteContentVersions.snapshot}->>'publishAt' IS NULL OR ${siteContentVersions.snapshot}->>'publishAt' <= ${now.toISOString()})`,
        sql`(${siteContentVersions.snapshot}->>'expiresAt' IS NULL OR ${siteContentVersions.snapshot}->>'expiresAt' > ${now.toISOString()})`,
        sql`(${siteContentVersions.snapshot}->>'audience' = 'tous' OR ${siteContentVersions.snapshot}->>'audience' = ${profile} OR ${siteContentVersions.snapshot}->'targeting'->'profiles' ? ${profile})`,
        sql`(${siteContentVersions.snapshot}->'targeting' IS NULL OR ${siteContentVersions.snapshot}->'targeting' = 'null'::jsonb OR ${siteContentVersions.snapshot}->'targeting'->'classRefs' = '[]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(${siteContentVersions.snapshot}->'targeting'->'classRefs') = 'array' THEN ${siteContentVersions.snapshot}->'targeting'->'classRefs' ELSE '[]'::jsonb END) AS target_class(ref) WHERE target_class.ref IN (SELECT jsonb_array_elements_text(${JSON.stringify(scope.classRefs)}::jsonb))))`,
      )))
    .orderBy(desc(siteContentItems.publishedAt), desc(siteContentItems.id)).limit(article ? 1 : 201);
  if (rows.length > 200) throw new HttpError(503, 'Les informations sont momentanément indisponibles.');
  return rows.flatMap(row => { const entry = authorizedNews(row, scope, now); return entry ? [entry] : []; });
}
export async function readPersonalNewsFeed(identity: HomeIdentity, targets: HomeTarget[], now: Date): Promise<PersonalNewsFeed> {
  const entries = await readAuthorizedNews(identity, targets, now);
  entries.sort((a,b) => Number(b.preview.targeted) - Number(a.preview.targeted) || Number(b.content.featured) - Number(a.content.featured) || b.preview.publishedAt.localeCompare(a.preview.publishedAt));
  const validUntil = new Date(Math.min(now.getTime() + 60_000, identity.expiresAt.getTime(), ...entries.map(e=>e.content.expiresAt?.getTime() ?? Infinity))).toISOString();
  return { status: 'available', items: entries.slice(0,8).map(e=>e.preview), more: entries.length > 8, validUntil };
}
