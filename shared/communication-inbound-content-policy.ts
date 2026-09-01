export const COMMUNICATION_INBOUND_CONTENT_LIMITS = {
  objects: 21,
  objectBytes: 10 * 1024 * 1024,
  totalBytes: 26 * 1024 * 1024,
} as const;

export const COMMUNICATION_INBOUND_MEDIA_TYPES = [
  "message/rfc822",
  "text/plain",
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
] as const;

export type CommunicationInboundMediaType = typeof COMMUNICATION_INBOUND_MEDIA_TYPES[number];
export type CommunicationInboundObjectKind = "message_body" | "attachment";

export type CommunicationInboundObjectDescriptor = {
  objectKind: CommunicationInboundObjectKind;
  objectRefHash: string;
  mediaType: CommunicationInboundMediaType;
  sizeBytes: number;
};

export type CommunicationInboundQuarantineConfirmation = {
  institutionId: string;
  inboundId: string;
  objectId: string;
  mediaType: CommunicationInboundMediaType;
  sizeBytes: number;
  sha256: string;
};

export class CommunicationInboundContentPolicyError extends Error {
  readonly reason: string;

  constructor(reason: string) {
    super(reason);
    this.reason = reason;
  }
}

const DESCRIPTOR_FIELDS = ["objectKind", "objectRefHash", "mediaType", "sizeBytes"] as const;
const CONFIRMATION_FIELDS = [
  "institutionId",
  "inboundId",
  "objectId",
  "mediaType",
  "sizeBytes",
  "sha256",
] as const;
const HASH_PATTERN = /^[a-f0-9]{64}$/u;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const MEDIA_TYPES = new Set<string>(COMMUNICATION_INBOUND_MEDIA_TYPES);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasExactFields(value: Record<string, unknown>, fields: readonly string[]): boolean {
  const keys = Object.keys(value).sort();
  const expected = [...fields].sort();
  return keys.length === expected.length && keys.every((key, index) => key === expected[index]);
}

function validSize(value: unknown): value is number {
  return Number.isSafeInteger(value)
    && Number(value) >= 1
    && Number(value) <= COMMUNICATION_INBOUND_CONTENT_LIMITS.objectBytes;
}

function parseDescriptor(value: unknown): CommunicationInboundObjectDescriptor {
  if (!isRecord(value) || !hasExactFields(value, DESCRIPTOR_FIELDS)) {
    throw new CommunicationInboundContentPolicyError("object_descriptor_invalid");
  }
  if (value.objectKind !== "message_body" && value.objectKind !== "attachment") {
    throw new CommunicationInboundContentPolicyError("object_kind_invalid");
  }
  if (typeof value.objectRefHash !== "string" || !HASH_PATTERN.test(value.objectRefHash)) {
    throw new CommunicationInboundContentPolicyError("object_ref_hash_invalid");
  }
  if (typeof value.mediaType !== "string" || !MEDIA_TYPES.has(value.mediaType)) {
    throw new CommunicationInboundContentPolicyError("media_type_invalid");
  }
  if (!validSize(value.sizeBytes)) {
    throw new CommunicationInboundContentPolicyError("object_size_invalid");
  }
  return {
    objectKind: value.objectKind,
    objectRefHash: value.objectRefHash,
    mediaType: value.mediaType as CommunicationInboundMediaType,
    sizeBytes: value.sizeBytes,
  };
}

export function parseCommunicationInboundObjectDescriptors(
  value: unknown
): CommunicationInboundObjectDescriptor[] {
  if (
    !Array.isArray(value)
    || value.length < 1
    || value.length > COMMUNICATION_INBOUND_CONTENT_LIMITS.objects
  ) {
    throw new CommunicationInboundContentPolicyError("object_descriptors_invalid");
  }
  const descriptors = value.map(parseDescriptor);
  if (new Set(descriptors.map((descriptor) => descriptor.objectRefHash)).size !== descriptors.length) {
    throw new CommunicationInboundContentPolicyError("object_ref_hash_duplicate");
  }
  const totalBytes = descriptors.reduce((total, descriptor) => total + descriptor.sizeBytes, 0);
  if (totalBytes > COMMUNICATION_INBOUND_CONTENT_LIMITS.totalBytes) {
    throw new CommunicationInboundContentPolicyError("objects_total_size_invalid");
  }
  return descriptors;
}

export function assertCommunicationInboundObjectAggregate(
  existing: readonly {
    objectKind: string;
    objectRefHash: string;
    mediaType: string;
    sizeBytes: number;
  }[],
  incoming: readonly CommunicationInboundObjectDescriptor[]
): void {
  const existingByRef = new Map(existing.map((item) => [item.objectRefHash, item]));
  if (existingByRef.size !== existing.length) {
    throw new CommunicationInboundContentPolicyError("existing_object_ref_hash_duplicate");
  }

  const additions = incoming.filter((descriptor) => {
    const current = existingByRef.get(descriptor.objectRefHash);
    if (!current) return true;
    if (
      current.objectKind !== descriptor.objectKind
      || current.mediaType !== descriptor.mediaType
      || Number(current.sizeBytes) !== descriptor.sizeBytes
    ) {
      throw new CommunicationInboundContentPolicyError("object_reservation_conflict");
    }
    return false;
  });
  const objectCount = existing.length + additions.length;
  const totalBytes = existing.reduce((total, item) => total + Number(item.sizeBytes), 0)
    + additions.reduce((total, item) => total + item.sizeBytes, 0);
  if (objectCount > COMMUNICATION_INBOUND_CONTENT_LIMITS.objects) {
    throw new CommunicationInboundContentPolicyError("object_aggregate_count_invalid");
  }
  if (!Number.isSafeInteger(totalBytes)
    || totalBytes > COMMUNICATION_INBOUND_CONTENT_LIMITS.totalBytes) {
    throw new CommunicationInboundContentPolicyError("object_aggregate_size_invalid");
  }
}

export function parseCommunicationInboundQuarantineConfirmation(
  value: unknown
): CommunicationInboundQuarantineConfirmation {
  if (!isRecord(value) || !hasExactFields(value, CONFIRMATION_FIELDS)) {
    throw new CommunicationInboundContentPolicyError("quarantine_confirmation_invalid");
  }
  const confirmation = {
    institutionId: value.institutionId,
    inboundId: value.inboundId,
    objectId: value.objectId,
    mediaType: value.mediaType,
    sizeBytes: value.sizeBytes,
    sha256: value.sha256,
  };
  for (const field of ["institutionId", "inboundId", "objectId"] as const) {
    if (typeof confirmation[field] !== "string" || !UUID_PATTERN.test(confirmation[field])) {
      throw new CommunicationInboundContentPolicyError(`${field}_invalid`);
    }
  }
  if (typeof confirmation.mediaType !== "string" || !MEDIA_TYPES.has(confirmation.mediaType)) {
    throw new CommunicationInboundContentPolicyError("media_type_invalid");
  }
  if (!validSize(confirmation.sizeBytes)) {
    throw new CommunicationInboundContentPolicyError("object_size_invalid");
  }
  if (typeof confirmation.sha256 !== "string" || !HASH_PATTERN.test(confirmation.sha256)) {
    throw new CommunicationInboundContentPolicyError("sha256_invalid");
  }
  return confirmation as CommunicationInboundQuarantineConfirmation;
}

export function communicationInboundObjectStoragePath(
  institutionId: string,
  inboundId: string,
  objectId: string
): string {
  for (const [field, value] of [
    ["institution_id", institutionId],
    ["inbound_id", inboundId],
    ["object_id", objectId],
  ] as const) {
    if (!UUID_PATTERN.test(value)) {
      throw new CommunicationInboundContentPolicyError(`${field}_invalid`);
    }
  }
  return `institutions/${institutionId}/inbound/${inboundId}/objects/${objectId}`;
}
