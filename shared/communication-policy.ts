export type CommunicationVisibility = "public" | "internal" | "targeted";
export type CommunicationSourceType =
  | "direct_text"
  | "pdf"
  | "docx"
  | "image"
  | "forwarded_email";

export type CommunicationControlInput = {
  sourceType: CommunicationSourceType;
  sourceFingerprint: string;
  visibility: CommunicationVisibility;
  audienceGroupRefs: string[];
  publishToSite: boolean;
  notifyAudience: boolean;
  publishAt: string | null;
  expiresAt: string | null;
};

const SOURCE_TYPES = new Set<CommunicationSourceType>([
  "direct_text",
  "pdf",
  "docx",
  "image",
  "forwarded_email",
]);
const VISIBILITIES = new Set<CommunicationVisibility>(["public", "internal", "targeted"]);
const ALLOWED_FIELDS = new Set([
  "sourceType",
  "sourceFingerprint",
  "visibility",
  "audienceGroupRefs",
  "publishToSite",
  "notifyAudience",
  "publishAt",
  "expiresAt",
]);
const GROUP_REF_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9:_-]{2,79}$/;

export class CommunicationPolicyError extends Error {
  readonly reason: string;

  constructor(reason: string) {
    super("La communication est invalide");
    this.reason = reason;
  }
}

function optionalIsoDate(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) {
    throw new CommunicationPolicyError(`${field}_invalid`);
  }
  return new Date(value).toISOString();
}

export function parseCommunicationControlInput(
  value: unknown,
  serverNow = new Date()
): CommunicationControlInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new CommunicationPolicyError("input_invalid");
  }
  if (!Number.isFinite(serverNow.getTime())) {
    throw new CommunicationPolicyError("server_time_invalid");
  }
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some((key) => !ALLOWED_FIELDS.has(key))) {
    throw new CommunicationPolicyError("unknown_field");
  }

  if (typeof input.sourceType !== "string" || !SOURCE_TYPES.has(input.sourceType as CommunicationSourceType)) {
    throw new CommunicationPolicyError("source_type_invalid");
  }
  if (typeof input.sourceFingerprint !== "string" || !/^[a-f0-9]{64}$/.test(input.sourceFingerprint)) {
    throw new CommunicationPolicyError("source_fingerprint_invalid");
  }
  const visibility = input.visibility === undefined ? "internal" : input.visibility;
  if (typeof visibility !== "string" || !VISIBILITIES.has(visibility as CommunicationVisibility)) {
    throw new CommunicationPolicyError("visibility_invalid");
  }

  const rawAudience = input.audienceGroupRefs ?? [];
  if (!Array.isArray(rawAudience) || rawAudience.length > 50) {
    throw new CommunicationPolicyError("audience_invalid");
  }
  const audienceGroupRefs = [...new Set(rawAudience.map((groupRef) => {
    if (
      typeof groupRef !== "string" ||
      groupRef.includes("@") ||
      !GROUP_REF_PATTERN.test(groupRef.trim())
    ) {
      throw new CommunicationPolicyError("audience_ref_invalid");
    }
    return groupRef.trim();
  }))].sort();

  const publishToSite = input.publishToSite === true;
  const notifyAudience = input.notifyAudience === true;
  if (input.publishToSite !== undefined && typeof input.publishToSite !== "boolean") {
    throw new CommunicationPolicyError("publish_flag_invalid");
  }
  if (input.notifyAudience !== undefined && typeof input.notifyAudience !== "boolean") {
    throw new CommunicationPolicyError("notify_flag_invalid");
  }
  if (publishToSite && visibility !== "public") {
    throw new CommunicationPolicyError("public_visibility_required");
  }
  if (visibility === "targeted" && audienceGroupRefs.length === 0) {
    throw new CommunicationPolicyError("targeted_audience_required");
  }
  if (notifyAudience && audienceGroupRefs.length === 0) {
    throw new CommunicationPolicyError("notification_audience_required");
  }

  const publishAt = optionalIsoDate(input.publishAt, "publish_at");
  const expiresAt = optionalIsoDate(input.expiresAt, "expires_at");
  const baseline = publishAt ? Date.parse(publishAt) : serverNow.getTime();
  if (expiresAt && Date.parse(expiresAt) <= baseline) {
    throw new CommunicationPolicyError("expiry_before_publication");
  }

  return {
    sourceType: input.sourceType as CommunicationSourceType,
    sourceFingerprint: input.sourceFingerprint,
    visibility: visibility as CommunicationVisibility,
    audienceGroupRefs,
    publishToSite,
    notifyAudience,
    publishAt,
    expiresAt,
  };
}
