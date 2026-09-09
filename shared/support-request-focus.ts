export type SupportWorkSection = "reply" | "management" | "history" | "notes";

export function latestRequesterMessage<T extends { direction: string; createdAt: string }>(messages: readonly T[]): T | null {
  let latest: T | null = null;
  for (const message of messages) {
    if (message.direction !== "inbound") continue;
    if (!latest || Date.parse(message.createdAt) >= Date.parse(latest.createdAt)) latest = message;
  }
  return latest;
}

// Navigation advice only: opening a section never changes or sends a request.
export function supportRequestFocus(input: {
  status: string;
  needsIdentity: boolean;
  duplicatePending: boolean;
  callbackPending: boolean;
  assigned: boolean;
}): { title: string; detail: string; label: string; section: SupportWorkSection } {
  if (input.status === "clos") return {
    title: "Dossier clôturé", detail: "Consultez le motif de clôture. Une réouverture reste possible si le besoin persiste.",
    label: "Voir la clôture", section: "notes",
  };
  if (input.needsIdentity) return {
    title: "Identité à vérifier", detail: "Confirmez l’identité scolaire avant de transmettre une information ou un document personnel.",
    label: "Vérifier l’identité", section: "management",
  };
  if (input.duplicatePending) return {
    title: "Deux demandes à comparer", detail: "Un rapprochement est proposé. Vérifiez les deux dossiers avant de décider s’il s’agit du même besoin.",
    label: "Examiner le rapprochement", section: "management",
  };
  if (input.callbackPending) return {
    title: "Rappel téléphonique à suivre", detail: "Consultez la prise en charge du rappel et consignez le résultat de l’appel.",
    label: "Voir le rappel", section: "management",
  };
  if (input.status === "resolu") return {
    title: "Résolution à finaliser", detail: "Relisez les échanges avant de clôturer le dossier avec le motif de résolution.",
    label: "Préparer la clôture", section: "notes",
  };
  if (!input.assigned) return {
    title: "Demande à prendre en charge", detail: "Attribuez la demande pour que les autres services sachent qui la traite.",
    label: "Voir l’attribution", section: "management",
  };
  if (["attente_demandeur", "attente_interne"].includes(input.status)) return {
    title: "Faire le point sur l’attente", detail: "Relisez les derniers échanges pour savoir ce qui manque et reprendre le traitement.",
    label: "Relire les échanges", section: "history",
  };
  return {
    title: "Préparer la réponse", detail: "Répondez au besoin précis avec les informations validées du lycée.",
    label: "Écrire la réponse", section: "reply",
  };
}
