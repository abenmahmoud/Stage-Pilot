export type SupportRateLimitScope =
  | "assistant_session"
  | "assistant_network"
  | "request_network"
  | "message_session"
  | "magic_token_network"
  | "content_ai_user"
  | "agent_translation_user"
  | "request_device_burst"
  | "request_device_daily"
  | "request_contact_burst"
  | "request_contact_daily"
  | "request_behavior_repeat"
  | "request_invalid_device"
  | "attachment_reserve_session"
  | "attachment_confirm_session"
  | "agent_write_user";

export type SupportRateLimitPolicy = {
  scope: SupportRateLimitScope;
  limit: number;
  windowSeconds: number;
  message: string;
};

const REQUEST_LIMIT_MESSAGE =
  "Plusieurs envois rapprochés ont été détectés. Votre première demande reste disponible dans Mes demandes. Réessayez plus tard ou contactez directement le lycée si la situation ne peut pas attendre.";

export const SUPPORT_RATE_LIMIT_POLICIES = {
  assistantDeviceDaily: {
    scope: "assistant_session",
    limit: 24,
    windowSeconds: 24 * 60 * 60,
    message:
      "La limite quotidienne de l’assistant est atteinte sur cet appareil. Vous pouvez toujours envoyer le formulaire au lycée ou reprendre plus tard.",
  },
  assistantNetworkGuard: {
    scope: "assistant_network",
    limit: 20_000,
    windowSeconds: 60 * 60,
    message: "L’assistant reçoit momentanément trop de trafic. Le formulaire classique reste disponible.",
  },
  requestNetworkGuard: {
    scope: "request_network",
    limit: 10_000,
    windowSeconds: 10 * 60,
    message: "Le service reçoit momentanément trop de trafic. Réessayez dans quelques minutes.",
  },
  magicTokenNetworkGuard: {
    scope: "magic_token_network",
    limit: 10_000,
    windowSeconds: 10 * 60,
    message: "Le suivi reçoit momentanément trop de trafic. Réessayez dans quelques minutes.",
  },
  requestDeviceBurst: {
    scope: "request_device_burst",
    limit: 8,
    windowSeconds: 30 * 60,
    message: REQUEST_LIMIT_MESSAGE,
  },
  requestDeviceDaily: {
    scope: "request_device_daily",
    limit: 20,
    windowSeconds: 24 * 60 * 60,
    message: REQUEST_LIMIT_MESSAGE,
  },
  requestContactBurst: {
    scope: "request_contact_burst",
    limit: 6,
    windowSeconds: 30 * 60,
    message: REQUEST_LIMIT_MESSAGE,
  },
  requestContactDaily: {
    scope: "request_contact_daily",
    limit: 20,
    windowSeconds: 24 * 60 * 60,
    message: REQUEST_LIMIT_MESSAGE,
  },
  requestRepeatedBehavior: {
    scope: "request_behavior_repeat",
    limit: 6,
    windowSeconds: 24 * 60 * 60,
    message: REQUEST_LIMIT_MESSAGE,
  },
  requestInvalidDevice: {
    scope: "request_invalid_device",
    limit: 15,
    windowSeconds: 10 * 60,
    message: "Trop de formulaires invalides ont été envoyés depuis cet appareil. Réessayez plus tard.",
  },
  messageSessionBurst: {
    scope: "message_session",
    limit: 60,
    windowSeconds: 10 * 60,
    message: "Trop de messages ont été envoyés. Attendez quelques minutes avant de continuer.",
  },
  attachmentReservationSession: {
    scope: "attachment_reserve_session",
    limit: 30,
    windowSeconds: 10 * 60,
    message: "Trop de dépôts de fichiers ont été préparés. Réessayez dans quelques minutes.",
  },
  attachmentConfirmationSession: {
    scope: "attachment_confirm_session",
    limit: 30,
    windowSeconds: 10 * 60,
    message: "Trop de fichiers ont été contrôlés. Réessayez dans quelques minutes.",
  },
  agentWriteAccount: {
    scope: "agent_write_user",
    limit: 300,
    windowSeconds: 60 * 60,
    message: "Ce compte a effectué trop d’actions rapprochées. Attendez quelques minutes puis recommencez.",
  },
} as const satisfies Record<string, SupportRateLimitPolicy>;

export function normalizedSupportDeviceId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const clean = value.trim();
  return /^[a-zA-Z0-9-]{16,80}$/.test(clean) ? clean : null;
}

export function normalizedSupportBehaviorText(value: string): string {
  return value.toLocaleLowerCase("fr-FR").replace(/\s+/g, " ").trim();
}
