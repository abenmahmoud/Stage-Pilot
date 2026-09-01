export type CommunicationWorkflowStatus =
  | "draft"
  | "review"
  | "approved"
  | "published"
  | "archived"
  | "cancelled";

export type CommunicationWorkflowVisibility = "internal" | "public" | "targeted";
export type CommunicationWorkflowStepState = "current" | "complete" | "pending" | "stopped";

export type CommunicationWorkflowStep = {
  id: "deposit" | "review" | "publish";
  number: 1 | 2 | 3;
  title: string;
  description: string;
  state: CommunicationWorkflowStepState;
};

function finalStepDescription(
  status: CommunicationWorkflowStatus,
  visibility: CommunicationWorkflowVisibility,
  publicationEnabled: boolean
): string {
  if (status === "published") return "Page publiée · diffusion fermée";
  if (status === "archived") return "Communication archivée";
  if (status === "cancelled") return "Parcours annulé";
  if (status === "approved" && visibility !== "public") {
    return visibility === "targeted"
      ? "Version ciblée validée · diffusion fermée"
      : "Version interne validée · diffusion fermée";
  }
  if (status === "approved") {
    return publicationEnabled ? "Prête à publier" : "Validation terminée · activation requise";
  }
  if (visibility === "targeted") return "Diffusion ciblée non activée";
  if (visibility === "internal") return "Parcours interne · diffusion fermée";
  return publicationEnabled ? "Après validation" : "Activation requise";
}

export function buildCommunicationWorkflow(
  status: CommunicationWorkflowStatus,
  visibility: CommunicationWorkflowVisibility,
  publicationEnabled: boolean
): CommunicationWorkflowStep[] {
  const stopped = status === "archived" || status === "cancelled";
  const reviewComplete = status === "approved" || status === "published";

  return [
    {
      id: "deposit",
      number: 1,
      title: "Déposer",
      description: status === "draft" ? "Saisie privée en cours" : stopped ? "Parcours arrêté" : "Brouillon enregistré",
      state: stopped ? "stopped" : status === "draft" ? "current" : "complete",
    },
    {
      id: "review",
      number: 2,
      title: "Vérifier",
      description: status === "review" ? "Relecture humaine" : stopped ? "Parcours arrêté" : reviewComplete ? "Version validée" : "Après le dépôt",
      state: stopped ? "stopped" : status === "review" ? "current" : reviewComplete ? "complete" : "pending",
    },
    {
      id: "publish",
      number: 3,
      title: "Publier et informer",
      description: finalStepDescription(status, visibility, publicationEnabled),
      state: stopped ? "stopped" : status === "approved" || status === "published" ? "current" : "pending",
    },
  ];
}
