import { eq, or } from "drizzle-orm";
import { db } from "../../db/index.js";
import { professeurs } from "../../db/schema.js";
import type { AuthUser } from "./auth.js";

type StageAccessRow = {
  professeurReferentId: string | null;
  professeurPrincipalId: string | null;
};

type GrandOralAccessRow = {
  profSpe1Id: string | null;
  profSpe2Id: string | null;
  professeurPrincipalId: string | null;
  eleveAuthUserId?: string | null;
};

export function isGlobalStaff(role: string): boolean {
  return ["superadmin", "administration", "proviseur"].includes(role);
}

export async function getProfesseurIdForUser(
  user: AuthUser
): Promise<string | null> {
  const metadataProfId =
    typeof user.appMetadata.prof_id === "string"
      ? user.appMetadata.prof_id
      : null;

  const [prof] = await db
    .select({ id: professeurs.id })
    .from(professeurs)
    .where(
      metadataProfId
        ? or(
            eq(professeurs.authUserId, user.id),
            eq(professeurs.id, metadataProfId)
          )
        : eq(professeurs.authUserId, user.id)
    )
    .limit(1);

  return prof?.id ?? metadataProfId;
}

export function canReadStageForUser(
  row: StageAccessRow,
  user: AuthUser,
  professeurId: string | null
): boolean {
  if (isGlobalStaff(user.role)) return true;
  if (row.professeurPrincipalId === user.id) return true;
  return Boolean(
    row.professeurReferentId === user.id ||
      (professeurId && row.professeurReferentId === professeurId)
  );
}

export function canReadGrandOralForUser(
  row: GrandOralAccessRow,
  user: AuthUser,
  professeurId: string | null
): boolean {
  if (isGlobalStaff(user.role)) return true;
  if (row.eleveAuthUserId === user.id) return true;
  if (row.professeurPrincipalId === user.id) return true;
  return Boolean(
    row.profSpe1Id === user.id ||
      row.profSpe2Id === user.id ||
      (professeurId &&
        (row.profSpe1Id === professeurId || row.profSpe2Id === professeurId))
  );
}
