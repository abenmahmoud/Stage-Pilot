import type { SupportOperationsPayload } from "./support-operations-payload.js";

export type SupportIncidentGuidance = {
  state: "nominal" | "attention";
  title: string;
  description: string;
  steps: Array<{
    id: "monitor" | "failed_jobs" | "email_chain" | "attachment_scan" | "attachment_removal" | "preserve";
    title: string;
    detail: string;
  }>;
  technicalReport: string;
};

export function buildSupportIncidentGuidance(
  payload: SupportOperationsPayload
): SupportIncidentGuidance {
  const { summary } = payload;
  const needsAttention =
    summary.failuresWaiting > 0 ||
    summary.jobFailures24h > 0 ||
    summary.webhookAlerts24h > 0 ||
    summary.deliveryAlerts24h > 0 ||
    summary.attachmentsWaiting > 0 ||
    summary.attachmentRemovalsWaiting > 0;

  const steps: SupportIncidentGuidance["steps"] = [];
  if (summary.failuresWaiting > 0 || summary.jobFailures24h > 0) {
    steps.push({
      id: "failed_jobs",
      title: "Examiner les opérations en échec",
      detail: "Relancez uniquement les notifications proposées par l’écran. Une opération technique reste en intervention manuelle.",
    });
  }
  if (summary.webhookAlerts24h > 0 || summary.deliveryAlerts24h > 0) {
    steps.push({
      id: "email_chain",
      title: "Contrôler la chaîne de messagerie",
      detail: "Vérifiez le service de réception et de livraison, puis conservez l’incident tant que le retour normal n’est pas confirmé.",
    });
  }
  if (summary.attachmentsWaiting > 0) {
    steps.push({
      id: "attachment_scan",
      title: "Contrôler la file antivirus",
      detail: "Ne libérez aucun document en attente et ne contournez pas la quarantaine. Faites vérifier le worker par la personne habilitée.",
    });
  }
  if (summary.attachmentRemovalsWaiting > 0) {
    steps.push({
      id: "attachment_removal",
      title: "Faire reprendre les retraits interrompus",
      detail: "L’agent propriétaire reprend le retrait depuis le dossier. Aucune suppression directe dans le stockage n’est attendue.",
    });
  }
  if (needsAttention) {
    steps.push({
      id: "preserve",
      title: "Conserver la preuve avant escalade",
      detail: "Copiez le résumé technique ci-dessous. Il contient seulement des compteurs et l’heure du relevé, jamais le contenu des dossiers.",
    });
  } else {
    steps.push({
      id: "monitor",
      title: "Poursuivre la surveillance",
      detail: "Aucune action immédiate n’est nécessaire. Actualisez cet écran après une intervention ou un changement de service.",
    });
  }

  const technicalReport = [
    "LyceeGest - résumé technique de santé",
    `Relevé serveur : ${payload.generatedAt}`,
    `État : ${needsAttention ? "vérification requise" : "nominal"}`,
    `Échecs en attente : ${summary.failuresWaiting}`,
    `Échecs observés sur 24 h : ${summary.jobFailures24h}`,
    `Alertes de réception sur 24 h : ${summary.webhookAlerts24h}`,
    `Alertes de livraison sur 24 h : ${summary.deliveryAlerts24h}`,
    `Fichiers en attente : ${summary.attachmentsWaiting}`,
    `Retraits à reprendre : ${summary.attachmentRemovalsWaiting}`,
    "Ce résumé ne contient ni identité, ni numéro de dossier, ni message, ni nom de fichier.",
  ].join("\n");

  return {
    state: needsAttention ? "attention" : "nominal",
    title: needsAttention ? "Vérification requise" : "Surveillance nominale",
    description: needsAttention
      ? "Suivez uniquement les étapes correspondant aux signaux visibles. Aucune réparation automatique n’est lancée."
      : "Les files surveillées ne présentent aucun signal nécessitant une intervention immédiate.",
    steps,
    technicalReport,
  };
}
