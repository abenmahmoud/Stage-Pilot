export type SupportQueueItem = {
  status: string;
  priority: string;
  assignedTo: string | null;
  slaDueAt: string | null;
  createdAt: string;
};

export type SupportQueueAssessment = {
  needsQualification: boolean;
  unassigned: boolean;
  overdue: boolean;
  closed: boolean;
};

export type SupportQueueFocusMode =
  | "all"
  | "urgent"
  | "overdue"
  | "qualify"
  | "unassigned"
  | "internal"
  | "callbacks"
  | "duplicates";

export type SupportQueueFocusStats = {
  total: number;
  urgent: number;
  overdue: number;
  qualify: number;
  unassigned: number;
  waitingInternal: number;
  callbacks: number;
  duplicates: number;
};

export type SupportQueueNextAction = {
  mode: SupportQueueFocusMode | null;
  count: number;
  headline: string;
  detail: string;
  actionLabel: string | null;
};

const CLOSED_STATUSES = new Set(["resolu", "clos", "indesirable"]);

function timestamp(value: string | null): number {
  if (!value) return Number.POSITIVE_INFINITY;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
}

function priorityRank(priority: string): number {
  return ({ p1: 1, p2: 2, p3: 3, p4: 4 } as Record<string, number>)[priority] ?? 5;
}

export function assessSupportQueueItem(
  item: SupportQueueItem,
  now: string
): SupportQueueAssessment {
  const closed = CLOSED_STATUSES.has(item.status);
  return {
    needsQualification: item.status === "a_qualifier",
    unassigned: !closed && item.assignedTo === null,
    overdue: !closed && item.slaDueAt !== null && timestamp(item.slaDueAt) < timestamp(now),
    closed,
  };
}

export function compareSupportQueueItems(
  left: SupportQueueItem,
  right: SupportQueueItem
): number {
  const priorityDifference = priorityRank(left.priority) - priorityRank(right.priority);
  if (priorityDifference !== 0) return priorityDifference;

  const slaDifference = timestamp(left.slaDueAt) - timestamp(right.slaDueAt);
  if (slaDifference !== 0) return slaDifference;

  return timestamp(left.createdAt) - timestamp(right.createdAt);
}

export function resolveSupportQueueNextAction(
  stats: SupportQueueFocusStats
): SupportQueueNextAction {
  const candidates: Array<{
    mode: Exclude<SupportQueueFocusMode, "all">;
    count: number;
    headline: string;
    detail: string;
    actionLabel: string;
  }> = [
    {
      mode: "urgent",
      count: stats.urgent,
      headline: "Demandes urgentes à traiter",
      detail: "Commencez par les dossiers signalés comme critiques ou urgents.",
      actionLabel: "Voir les urgences",
    },
    {
      mode: "overdue",
      count: stats.overdue,
      headline: "Échéances dépassées",
      detail: "Ces dossiers possèdent une échéance enregistrée qui est dépassée.",
      actionLabel: "Voir les retards",
    },
    {
      mode: "qualify",
      count: stats.qualify,
      headline: "Demandes à classer",
      detail: "Vérifiez le besoin et confirmez le service qui doit répondre.",
      actionLabel: "Classer les demandes",
    },
    {
      mode: "unassigned",
      count: stats.unassigned,
      headline: "Demandes sans agent",
      detail: "Un agent doit prendre en charge ces dossiers dans son périmètre.",
      actionLabel: "Voir les demandes",
    },
    {
      mode: "internal",
      count: stats.waitingInternal,
      headline: "Vérifications internes en attente",
      detail: "Une vérification du lycée est nécessaire avant de répondre.",
      actionLabel: "Voir les vérifications",
    },
    {
      mode: "callbacks",
      count: stats.callbacks,
      headline: "Rappels téléphoniques en attente",
      detail: "Les personnes concernées ont demandé à être rappelées.",
      actionLabel: "Voir les rappels",
    },
    {
      mode: "duplicates",
      count: stats.duplicates,
      headline: "Doublons possibles à vérifier",
      detail: "Comparez les dossiers avant toute décision humaine.",
      actionLabel: "Vérifier les doublons",
    },
  ];
  const next = candidates.find((candidate) => candidate.count > 0);
  if (next) return next;
  if (stats.total > 0) {
    return {
      mode: "all",
      count: stats.total,
      headline: "File courante à poursuivre",
      detail: "Aucun signal prioritaire supplémentaire n'est détecté.",
      actionLabel: "Afficher toute la file",
    };
  }
  return {
    mode: null,
    count: 0,
    headline: "Aucune demande en attente",
    detail: "La file correspondant à votre périmètre est à jour.",
    actionLabel: null,
  };
}
