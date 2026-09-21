export const EQUIPMENT_TYPES = [
  "desktop",
  "laptop",
  "projector",
  "printer",
  "display",
  "network",
  "audio",
  "other",
] as const;

export const EQUIPMENT_IMPACTS = [
  "single_user",
  "several_users",
  "class_blocked",
  "site_service",
] as const;

export const EQUIPMENT_VISIT_STATUSES = [
  "draft",
  "confirmed",
  "completed",
  "cancelled",
] as const;

export type EquipmentType = typeof EQUIPMENT_TYPES[number];
export type EquipmentImpact = typeof EQUIPMENT_IMPACTS[number];
export type EquipmentVisitStatus = typeof EQUIPMENT_VISIT_STATUSES[number];

export const EQUIPMENT_TYPE_LABELS: Record<EquipmentType, string> = {
  desktop: "Ordinateur fixe",
  laptop: "Ordinateur portable",
  projector: "Vidéoprojecteur",
  printer: "Imprimante ou photocopieur",
  display: "Écran ou tableau interactif",
  network: "Réseau ou prise",
  audio: "Son ou équipement audio",
  other: "Autre matériel",
};

export const EQUIPMENT_IMPACT_LABELS: Record<EquipmentImpact, string> = {
  single_user: "Une personne peut difficilement travailler",
  several_users: "Plusieurs personnes sont concernées",
  class_blocked: "Le cours est bloqué",
  site_service: "Un service ou plusieurs salles sont touchés",
};

export type PublicEquipmentVisit = {
  id: string;
  provider: string;
  startsAt: string;
  endsAt: string;
  location: string | null;
  publicNote: string | null;
};

export function isEquipmentType(value: unknown): value is EquipmentType {
  return typeof value === "string" && EQUIPMENT_TYPES.includes(value as EquipmentType);
}

export function isEquipmentImpact(value: unknown): value is EquipmentImpact {
  return typeof value === "string" && EQUIPMENT_IMPACTS.includes(value as EquipmentImpact);
}

export function isEquipmentVisitStatus(value: unknown): value is EquipmentVisitStatus {
  return typeof value === "string" && EQUIPMENT_VISIT_STATUSES.includes(value as EquipmentVisitStatus);
}

function isNullableText(value: unknown, maximum: number): value is string | null {
  return value === null || (typeof value === "string" && value.length > 0 && value.length <= maximum);
}

export function isPublicEquipmentVisit(value: unknown): value is PublicEquipmentVisit {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const visit = value as Record<string, unknown>;
  return Object.keys(visit).length === 6
    && typeof visit.id === "string" && /^[0-9a-f-]{36}$/i.test(visit.id)
    && typeof visit.provider === "string" && visit.provider.length >= 2 && visit.provider.length <= 80
    && typeof visit.startsAt === "string" && Number.isFinite(Date.parse(visit.startsAt))
    && typeof visit.endsAt === "string" && Number.isFinite(Date.parse(visit.endsAt))
    && Date.parse(visit.endsAt) > Date.parse(visit.startsAt)
    && isNullableText(visit.location, 120)
    && isNullableText(visit.publicNote, 300);
}

export function isPublicEquipmentVisitsPayload(value: unknown): value is { visits: PublicEquipmentVisit[] } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const payload = value as Record<string, unknown>;
  return Object.keys(payload).length === 1
    && Array.isArray(payload.visits)
    && payload.visits.length <= 12
    && payload.visits.every(isPublicEquipmentVisit);
}
