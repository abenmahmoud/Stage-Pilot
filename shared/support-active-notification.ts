const SUPPORT_PUBLIC_CODE_PATTERN = /^BC-\d{4}-\d{6}$/u;
const MESSAGE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

const SUPPORT_STATUSES = new Set([
  "nouveau",
  "a_qualifier",
  "assigne",
  "en_cours",
  "attente_demandeur",
  "attente_interne",
  "resolu",
  "clos",
  "indesirable",
]);

export type ActiveSupportNotificationSnapshot = {
  publicCode: string;
  status: string;
  updatedAt: string;
  latestAgentMessageId: string | null;
};

export type ActiveSupportNotification = {
  title: string;
  body: string;
  tag: string;
  destination: "/prototype?view=requests";
  reason: "agent_message" | "status_change";
};

export type ActiveSupportNotificationReconciliation = {
  snapshot: ActiveSupportNotificationSnapshot | null;
  notification: ActiveSupportNotification | null;
};

function validSnapshot(value: ActiveSupportNotificationSnapshot): boolean {
  return SUPPORT_PUBLIC_CODE_PATTERN.test(value.publicCode) &&
    SUPPORT_STATUSES.has(value.status) &&
    Number.isFinite(Date.parse(value.updatedAt)) &&
    (value.latestAgentMessageId === null || MESSAGE_ID_PATTERN.test(value.latestAgentMessageId));
}

function statusBody(status: string): string {
  if (status === "attente_demandeur") return "Le lycée attend votre réponse dans le suivi sécurisé.";
  if (status === "resolu") return "Votre demande a été marquée comme résolue.";
  if (status === "clos") return "Votre demande a été fermée. Le détail reste disponible dans le suivi.";
  return "Le suivi de votre demande a été mis à jour.";
}

export function reconcileActiveSupportNotification(
  previous: ActiveSupportNotificationSnapshot | null | undefined,
  next: ActiveSupportNotificationSnapshot
): ActiveSupportNotificationReconciliation {
  if (!validSnapshot(next)) {
    return { snapshot: previous && validSnapshot(previous) ? previous : null, notification: null };
  }
  if (!previous || !validSnapshot(previous)) {
    return { snapshot: next, notification: null };
  }
  if (Date.parse(next.updatedAt) < Date.parse(previous.updatedAt)) {
    return { snapshot: previous, notification: null };
  }

  const base = {
    title: "Mise à jour de votre demande",
    tag: `support-request-${next.publicCode}`,
    destination: "/prototype?view=requests" as const,
  };
  if (
    next.latestAgentMessageId &&
    next.latestAgentMessageId !== previous.latestAgentMessageId
  ) {
    return {
      snapshot: next,
      notification: {
        ...base,
        body: "Une réponse du lycée est disponible dans votre suivi sécurisé.",
        reason: "agent_message",
      },
    };
  }
  if (next.status !== previous.status) {
    return {
      snapshot: next,
      notification: {
        ...base,
        body: statusBody(next.status),
        reason: "status_change",
      },
    };
  }
  return { snapshot: next, notification: null };
}
