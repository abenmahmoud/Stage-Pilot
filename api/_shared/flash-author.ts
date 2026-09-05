// Résolution du nom d'affichage de l'auteur d'une proposition flash, quand
// c'est possible — LOT 3 du plan de publication
// (docs/operations/PLAN_FLASH_PUBLICATION_2026-09-05.md).
//
// Ce schéma n'a PAS d'annuaire générique du personnel : seule la fiche
// `professeurs` porte un nom relié à un compte auth (`auth_user_id`).
// `administration`, `agent`, `proviseur` et `superadmin` (les autres rôles de
// `FLASH_ACTOR_ROLES`) n'ont aucune fiche équivalente dans ce dépôt. Renvoyer
// `null` pour ces comptes est donc la seule réponse honnête : jamais une
// supposition, jamais un nom construit depuis l'email ou l'identifiant.

import { inArray } from "drizzle-orm";
import { db } from "../../db/index.js";
import { professeurs } from "../../db/schema.js";

export type FlashAuthorRow = { nom: string; prenom: string };

/** Fonction pure, testable sans base : compose "Prénom Nom", ou null. */
export function formatFlashAuthorName(row: FlashAuthorRow | null | undefined): string | null {
  if (!row) return null;
  const value = `${row.prenom} ${row.nom}`.trim();
  return value.length > 0 ? value : null;
}

/**
 * Résout autant de noms que possible pour une liste d'identifiants auth
 * (`proposed_by`). Les identifiants sans fiche `professeurs` liée sont
 * simplement absents de la map — jamais une entrée `null`.
 */
export async function resolveFlashAuthorNames(userIds: readonly string[]): Promise<Map<string, string>> {
  const uniqueIds = [...new Set(userIds)];
  if (uniqueIds.length === 0) return new Map();

  const rows = await db
    .select({ authUserId: professeurs.authUserId, nom: professeurs.nom, prenom: professeurs.prenom })
    .from(professeurs)
    .where(inArray(professeurs.authUserId, uniqueIds));

  const names = new Map<string, string>();
  for (const row of rows) {
    if (!row.authUserId) continue;
    const name = formatFlashAuthorName(row);
    if (name) names.set(row.authUserId, name);
  }
  return names;
}
