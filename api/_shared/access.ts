import { eq } from "drizzle-orm";
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
  const [prof] = await db
    .select({ id: professeurs.id })
    .from(professeurs)
    .where(eq(professeurs.authUserId, user.id))
    .limit(1);

  return prof?.id ?? null;
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
    professeurId &&
      (row.profSpe1Id === professeurId || row.profSpe2Id === professeurId)
  );
}
