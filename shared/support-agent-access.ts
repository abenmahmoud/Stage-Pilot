export const SUPPORT_SERVICES = [
  "referent_numerique",
  "ddfpt",
  "secretariat",
  "vie_scolaire",
  "intendance",
  "direction",
  "administration",
] as const;

export type SupportService = (typeof SUPPORT_SERVICES)[number];

export type SupportAgentAccess = {
  role: string;
  label: string;
  serviceCodes: SupportService[];
  canViewAll: boolean;
  canRoute: boolean;
  canManageTemplates: boolean;
};

export type InstitutionMembershipAccessRecord = {
  role: string;
  serviceCodes: unknown;
  status: string;
  institutionStatus: string;
};

const ADMINISTRATION_SERVICES: SupportService[] = [
  "secretariat",
  "administration",
  "intendance",
];

const SERVICE_LABELS: Record<SupportService, string> = {
  referent_numerique: "Référent numérique",
  ddfpt: "DDFPT",
  secretariat: "Secrétariat",
  vie_scolaire: "Vie scolaire",
  intendance: "Intendance",
  direction: "Direction",
  administration: "Administration",
};

function isSupportService(value: unknown): value is SupportService {
  return typeof value === "string" && SUPPORT_SERVICES.includes(value as SupportService);
}

function declaredServices(appMetadata: Record<string, unknown>): SupportService[] {
  const value = appMetadata.service_codes ?? appMetadata.support_services;
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(isSupportService))];
}

function persistedServices(value: unknown): SupportService[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(isSupportService))];
}

function scopedLabel(services: SupportService[]): string {
  if (services.length === 1) return `Agent ${SERVICE_LABELS[services[0]]}`;
  return "Agent multi-services";
}

export function resolveSupportAgentAccess(
  role: string,
  appMetadata: Record<string, unknown> = {}
): SupportAgentAccess | null {
  if (role === "superadmin") {
    return {
      role,
      label: "Superadministrateur",
      serviceCodes: [...SUPPORT_SERVICES],
      canViewAll: true,
      canRoute: true,
      canManageTemplates: true,
    };
  }

  if (role === "proviseur") {
    return {
      role,
      label: "Direction",
      serviceCodes: [...SUPPORT_SERVICES],
      canViewAll: true,
      canRoute: true,
      canManageTemplates: true,
    };
  }

  if (role === "administration") {
    return {
      role,
      label: "Agent administration",
      serviceCodes: [...ADMINISTRATION_SERVICES],
      canViewAll: false,
      canRoute: false,
      canManageTemplates: false,
    };
  }

  if (role !== "agent") return null;
  const serviceCodes = declaredServices(appMetadata);
  if (serviceCodes.length === 0) return null;
  return {
    role,
    label: scopedLabel(serviceCodes),
    serviceCodes,
    canViewAll: false,
    canRoute: false,
    canManageTemplates: false,
  };
}

export function resolvePersistedSupportAgentAccess(
  authRole: string,
  membership: InstitutionMembershipAccessRecord | null
): SupportAgentAccess | null {
  if (
    !membership ||
    membership.status !== "active" ||
    !["pilot", "active"].includes(membership.institutionStatus) ||
    !["agent", "service_manager", "admin", "auditor"].includes(membership.role) ||
    membership.role === "auditor"
  ) {
    return null;
  }

  if (authRole === "superadmin" || authRole === "proviseur") {
    if (membership.role !== "admin") return null;
    return resolveSupportAgentAccess(authRole);
  }

  if (authRole !== "agent" && authRole !== "administration") return null;
  const serviceCodes = persistedServices(membership.serviceCodes);
  if (serviceCodes.length === 0) return null;

  return {
    role: authRole,
    label: authRole === "administration" ? "Agent administration" : scopedLabel(serviceCodes),
    serviceCodes,
    canViewAll: false,
    canRoute: false,
    canManageTemplates: false,
  };
}

export function canAccessSupportService(
  access: SupportAgentAccess,
  service: string | null
): boolean {
  if (access.canViewAll) return true;
  return service !== null && access.serviceCodes.includes(service as SupportService);
}

export function canTransferSupportRequest(
  access: SupportAgentAccess,
  currentService: string | null,
  nextService: string | null
): boolean {
  if (currentService === nextService) return canAccessSupportService(access, currentService);
  return access.canRoute;
}

export function supportServiceLabel(service: SupportService): string {
  return SERVICE_LABELS[service];
}
