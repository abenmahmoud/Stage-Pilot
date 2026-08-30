import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { institutions } from "../../db/schema.js";
import { HttpError } from "./auth.js";

export const DEFAULT_INSTITUTION_SLUG = "blaise-cendrars-sevran";

export type InstitutionContext = {
  id: string;
  slug: string;
  status: string;
};

export async function requireConfiguredInstitution(): Promise<InstitutionContext> {
  const slug = process.env.SUPPORT_INSTITUTION_SLUG?.trim() || DEFAULT_INSTITUTION_SLUG;
  try {
    const [institution] = await db
      .select({
        id: institutions.id,
        slug: institutions.slug,
        status: institutions.status,
      })
      .from(institutions)
      .where(
        and(
          eq(institutions.slug, slug),
          inArray(institutions.status, ["pilot", "active"])
        )
      )
      .limit(1);
    if (!institution) {
      throw new HttpError(503, "L'établissement du guichet n'est pas disponible.");
    }
    return institution;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(503, "L'établissement du guichet n'est pas disponible.");
  }
}

export async function assertLegacySingleInstitutionMode(
  institutionId: string
): Promise<void> {
  try {
    const [row] = await db
      .select({
        count: sql<number>`count(*)::int`,
        configured: sql<number>`count(*) filter (where ${institutions.id} = ${institutionId})::int`,
      })
      .from(institutions)
      .where(inArray(institutions.status, ["pilot", "active"]));
    if (row?.count !== 1 || row.configured !== 1) {
      throw new HttpError(
        503,
        "Ce traitement attend le cloisonnement complet des tables techniques."
      );
    }
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(
      503,
      "Ce traitement attend le cloisonnement complet des tables techniques."
    );
  }
}
