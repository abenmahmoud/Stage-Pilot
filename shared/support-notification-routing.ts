import {
  SUPPORT_SERVICES,
  supportServiceLabel,
  type SupportService,
} from "./support-agent-access.ts";

export type SupportNotificationTarget = {
  email: string;
  name: string;
  service: SupportService | null;
  source: "service" | "fallback";
};

type NotificationEnvironment = Record<string, string | undefined>;

const SERVICE_EMAIL_ENV: Record<SupportService, string> = {
  referent_numerique: "SUPPORT_AGENT_EMAIL_NUMERIQUE",
  ddfpt: "SUPPORT_AGENT_EMAIL_DDFPT",
  secretariat: "SUPPORT_AGENT_EMAIL_ADMINISTRATION",
  vie_scolaire: "SUPPORT_AGENT_EMAIL_VIE_SCOLAIRE",
  intendance: "SUPPORT_AGENT_EMAIL_ADMINISTRATION",
  direction: "SUPPORT_AGENT_EMAIL_DIRECTION",
  administration: "SUPPORT_AGENT_EMAIL_ADMINISTRATION",
};

function configuredEmail(value: string | undefined): string | null {
  const email = value?.trim().toLowerCase();
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return null;
  }
  return email;
}

function normalizedService(value: string | null): SupportService | null {
  return value && SUPPORT_SERVICES.includes(value as SupportService)
    ? (value as SupportService)
    : null;
}

export function resolveSupportNotificationTarget(
  assignedService: string | null,
  env: NotificationEnvironment
): SupportNotificationTarget | null {
  const service = normalizedService(assignedService);
  const serviceEmail = service ? configuredEmail(env[SERVICE_EMAIL_ENV[service]]) : null;
  if (service && serviceEmail) {
    return {
      email: serviceEmail,
      name: supportServiceLabel(service),
      service,
      source: "service",
    };
  }

  const fallbackEmail = configuredEmail(env.SUPPORT_AGENT_EMAIL);
  if (!fallbackEmail) return null;
  return {
    email: fallbackEmail,
    name: "Superadministration du lycée",
    service,
    source: "fallback",
  };
}
