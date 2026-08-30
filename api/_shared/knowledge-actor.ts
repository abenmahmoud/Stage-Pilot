import type { VercelRequest } from "@vercel/node";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../../db/index.js";
import {
  eleves,
  institutionMemberships,
  institutions,
  professeurs,
} from "../../db/schema.js";
import { resolveKnowledgeActor } from "../../shared/knowledge-actor-policy.js";
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

    const [[membership], [student], [teacher]] = await Promise.all([
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
        .select({ id: eleves.id })
        .from(eleves)
        .where(eq(eleves.authUserId, user.id))
        .limit(1),
      db
        .select({ id: professeurs.id })
        .from(professeurs)
        .where(eq(professeurs.authUserId, user.id))
        .limit(1),
    ]);

    const schoolRole = student ? "student" : teacher ? "staff" : null;
    const authenticatorLevel = membership
      ? await getAuthenticatorLevelFromRequest(req)
      : "aal1";

    return resolveKnowledgeActor({
      institutionId: institution.id,
      authenticated: true,
      emailConfirmed: user.emailConfirmedAt !== null,
      schoolRecordMatched: Boolean(student || teacher),
      schoolRole,
      authenticatorLevel,
      membership: membership ?? null,
    });
  } catch {
    return null;
  }
}
