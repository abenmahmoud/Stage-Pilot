export const MODULE_DESACTIVE = "module_desactive";

export function isStageModuleActive(
  classeNiveau: string | null | undefined,
  stageStatut: string | null | undefined
): boolean {
  if (stageStatut === MODULE_DESACTIVE) return false;
  if (classeNiveau === "seconde") return true;

  // Les imports historiques ont créé un stage vide pour tous les élèves.
  // Hors seconde, seul un statut vraiment engagé signifie activation manuelle.
  return Boolean(stageStatut && stageStatut !== "a_completer");
}

export function stageStatusWhenActivated(
  classeNiveau: string | null | undefined
): string {
  return classeNiveau === "seconde" ? "a_completer" : "en_cours_saisie";
}

export function isGrandOralModuleActive(
  classeNiveau: string | null | undefined,
  goStatut: string | null | undefined
): boolean {
  if (goStatut === MODULE_DESACTIVE) return false;
  if (classeNiveau === "terminale") return true;

  // Hors terminale, une fiche existante non désactivée correspond à un override admin.
  return Boolean(goStatut);
}
