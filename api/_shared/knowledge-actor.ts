import type { VercelRequest } from "@vercel/node";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "../../db/index.js";
import {
  identityDirectoryImports,
  institutionMemberships,
  institutions,
  schoolIdentities,
} from "../../db/schema.js";
import {
  resolveKnowledgeActor,
  resolveSchoolIdentityRole,
} from "../../shared/knowledge-actor-policy.js";
import type { KnowledgeActor } from "../../shared/skill-registry-policy.js";
import {
  getAuthenticatorLevelFromRequest,
  getUserFromRequest,
} from "./auth.js";

const DEFAULT_INSTITUTION_SLUG = "blaise-cendrars-sevran";

export async function resolveKnowledgeActorFromRequest(
  req: VercelRequest
): Promise<KnowledgeActor | null> {
  const slug = process.env.SUPPORT_INSTITUTION_SLUG?.trim() || DEFAULT_INSTITUTION_SLUG;
  try {
    const [institution] = await db
      .select({ id: institutions.id })
      .from(institutions)
      .where(
        and(
          eq(institutions.slug, slug),
          inArray(institutions.status, ["pilot", "active"])
        )
      )
      .limit(1);
    if (!institution) return null;

    const user = await getUserFromRequest(req);
    if (!user) {
      return resolveKnowledgeActor({
        institutionId: institution.id,
        authenticated: false,
        emailConfirmed: false,
        schoolRecordMatched: false,
        membership: null,
      });
    }

    const now = new Date();
    const [[membership], schoolIdentityRows] = await Promise.all([
      db
        .select({
          institutionId: institutionMemberships.institutionId,
          role: institutionMemberships.role,
          serviceCodes: institutionMemberships.serviceCodes,
          status: institutionMemberships.status,
        })
        .from(institutionMemberships)
        .where(
          and(
            eq(institutionMemberships.institutionId, institution.id),
            eq(institutionMemberships.userId, user.id),
            eq(institutionMemberships.status, "active")
          )
        )
        .limit(1),
      db
        .select({
          institutionId: schoolIdentities.institutionId,
          sourceInstitutionId: identityDirectoryImports.institutionId,
          sourceStatus: identityDirectoryImports.status,
          personType: schoolIdentities.personType,
          assuranceLevel: schoolIdentities.assuranceLevel,
          verifiedBy: schoolIdentities.verifiedBy,
          verifiedAt: schoolIdentities.verifiedAt,
          revokedAt: schoolIdentities.revokedAt,
        })
        .from(schoolIdentities)
        .innerJoin(identityDirectoryImports, and(
          eq(identityDirectoryImports.id, schoolIdentities.sourceImportId),
          eq(identityDirectoryImports.institutionId, schoolIdentities.institutionId)
        ))
        .where(and(
          eq(schoolIdentities.institutionId, institution.id),
          eq(schoolIdentities.userId, user.id),
          isNull(schoolIdentities.revokedAt),
          eq(identityDirectoryImports.status, "active")
        ))
        .limit(2),
    ]);

    const schoolRole = resolveSchoolIdentityRole({
      institutionId: institution.id,
      rows: schoolIdentityRows.map((identity) => ({
        ...identity,
        verifiedAt: identity.verifiedAt.toISOString(),
        revokedAt: identity.revokedAt?.toISOString() ?? null,
      })),
      now: now.toISOString(),
    });
    const authenticatorLevel = membership
      ? await getAuthenticatorLevelFromRequest(req)
      : "aal1";

    return resolveKnowledgeActor({
      institutionId: institution.id,
      authenticated: true,
      emailConfirmed: user.emailConfirmedAt !== null,
      schoolRecordMatched: schoolRole !== null,
      schoolRole,
      authenticatorLevel,
      membership: membership ?? null,
    });
  } catch {
    return null;
  }
}
