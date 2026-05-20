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

type GrandOralSignRow = GrandOralAccessRow & {
  statut: string | null;
  signeProf1At?: Date | string | null;
  signeProf2At?: Date | string | null;
};

export type GrandOralUserRole = "prof_spe1" | "prof_spe2" | null;

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

function matchesProfessorReference(
  value: string | null,
  user: AuthUser,
  professeurId: string | null
): boolean {
  return Boolean(value && (value === user.id || value === professeurId));
}

export function getGrandOralRoleForUser(
  row: Pick<GrandOralAccessRow, "profSpe1Id" | "profSpe2Id">,
  user: AuthUser,
  professeurId: string | null
): GrandOralUserRole {
  if (matchesProfessorReference(row.profSpe1Id, user, professeurId)) {
    return "prof_spe1";
  }
  if (matchesProfessorReference(row.profSpe2Id, user, professeurId)) {
    return "prof_spe2";
  }
  return null;
}

export function canSignGrandOralForUser(
  row: GrandOralSignRow,
  user: AuthUser,
  professeurId: string | null
): boolean {
  const role = getGrandOralRoleForUser(row, user, professeurId);
  return (
    (role === "prof_spe1" &&
      row.statut === "soumis_prof1" &&
      !row.signeProf1At) ||
    (role === "prof_spe2" &&
      row.statut === "soumis_prof2" &&
      !row.signeProf2At)
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
  return Boolean(getGrandOralRoleForUser(row, user, professeurId));
}
