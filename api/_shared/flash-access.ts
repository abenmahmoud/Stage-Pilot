// Acces serveur a une information flash : qui agit, et avec quel service.
//
// Meme motif que la file support (api/_shared/support-agent-access.ts) :
// l'appartenance de l'acteur a son etablissement (institution_memberships)
// porte les services reellement accordes, jamais le JWT seul ni le corps de
// la requete. La decision de validation elle-meme n'est pas reimplementee
// ici : elle vient de `shared/flash-validation-access.ts`, deja ecrite et
// testee (§13).

import type { VercelRequest } from "@vercel/node";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../../db/index.js";
import { institutionMemberships, institutions } from "../../db/schema.js";
import type { AuthUser } from "./auth.js";
import { HttpError, requireUser } from "./auth.js";
import { requireConfiguredInstitution } from "./institution-context.js";
import {
  decideFlashValidationAccess,
  type FlashValidationDecision,
} from "../../shared/flash-validation-access.js";

/** Comptes susceptibles de proposer ou de valider une information flash. */
export const FLASH_ACTOR_ROLES = [
  "superadmin",
  "administration",
  "agent",
  "proviseur",
  "professeur",
] as const;

export type FlashMembershipRecord = {
  status: string;
  institutionStatus: string;
  serviceCodes: unknown;
};

export type FlashActorContext = {
  user: AuthUser;
  institutionId: string;
  serviceCodes: string[];
};

/**
 * Filtre pur : une appartenance inactive, un etablissement suspendu, ou une
 * colonne mal formee ne donnent aucun service. Ne touche jamais la base, ce
 * qui la rend testable sans pile Supabase.
 */
export function activeFlashServiceCodes(membership: FlashMembershipRecord | null): string[] {
  if (
    !membership ||
    membership.status !== "active" ||
    !["pilot", "active"].includes(membership.institutionStatus) ||
    !Array.isArray(membership.serviceCodes)
  ) {
    return [];
  }
  return membership.serviceCodes.filter((code): code is string => typeof code === "string");
}

export async function requireFlashActor(req: VercelRequest): Promise<FlashActorContext> {
  const user = await requireUser(req);
  if (!(FLASH_ACTOR_ROLES as readonly string[]).includes(user.role)) {
    throw new HttpError(403, "Ce compte n'a pas accès aux informations flash");
  }
  const institution = await requireConfiguredInstitution();

  let membership: FlashMembershipRecord | null;
  try {
    const [row] = await db
      .select({
        status: institutionMemberships.status,
        institutionStatus: institutions.status,
        serviceCodes: institutionMemberships.serviceCodes,
      })
      .from(institutionMemberships)
      .innerJoin(institutions, eq(institutionMemberships.institutionId, institutions.id))
      .where(
        and(
          eq(institutionMemberships.userId, user.id),
          eq(institutions.id, institution.id),
          inArray(institutions.status, ["pilot", "active"])
        )
      )
      .limit(1);
    membership = row ?? null;
  } catch {
    throw new HttpError(
      503,
      "La vérification de l'appartenance à l'établissement est momentanément indisponible."
    );
  }

  if (!membership) {
    throw new HttpError(403, "Aucune appartenance active à cet établissement.");
  }

  return { user, institutionId: institution.id, serviceCodes: activeFlashServiceCodes(membership) };
}

/**
 * Compose l'appartenance deja resolue avec la decision de validation. Reste
 * pur (aucun acces base) : c'est `requireFlashActor` qui a deja fait la
 * lecture, ce qui permet de tester cette regle avec un acteur fabrique a la
 * main plutot qu'avec une base reelle.
 */
export function assertFlashValidationAccess(
  actor: FlashActorContext,
  proposedBy: string
): FlashValidationDecision {
  const decision = decideFlashValidationAccess({
    role: actor.user.role,
    serviceCodes: actor.serviceCodes,
    proposedBy,
    actorId: actor.user.id,
  });
  if (!decision.allowed) {
    throw new HttpError(403, "Cette validation n'est pas ouverte à ce compte.");
  }
  return decision;
}
