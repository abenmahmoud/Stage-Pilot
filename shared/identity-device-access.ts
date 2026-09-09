export const IDENTITY_DEVICE_CHALLENGE_SECONDS = 10 * 60;
export const IDENTITY_DEVICE_SHARED_SESSION_SECONDS = 12 * 60 * 60;
export const IDENTITY_DEVICE_PERSISTENT_IDLE_SECONDS = 7 * 24 * 60 * 60;
export const IDENTITY_DEVICE_ABSOLUTE_SESSION_SECONDS = 30 * 24 * 60 * 60;
export const IDENTITY_DEVICE_MAX_ATTEMPTS = 5;

export type IdentityDeviceRequestInput = {
  contactType: "email" | "phone";
  contact: string;
  claimedProfile: "student" | "guardian" | "staff";
  claimedFirstName: string;
  claimedLastName: string;
  deviceId: string;
  rememberDevice: boolean;
};

export type IdentityDeviceVerifyInput = {
  code: string;
};

function plainObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("identity_device_input_invalid");
  }
  return value as Record<string, unknown>;
}

function exactFields(value: Record<string, unknown>, fields: readonly string[]): void {
  const keys = Object.keys(value);
  if (keys.length !== fields.length || keys.some((key) => !fields.includes(key))) {
    throw new Error("identity_device_input_invalid");
  }
}

export function normalizeIdentityDeviceEmail(value: unknown): string {
  if (typeof value !== "string") throw new Error("identity_device_email_invalid");
  const normalized = value.normalize("NFKC").trim().toLowerCase();
  if (
    normalized.length < 5 ||
    normalized.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)
  ) {
    throw new Error("identity_device_email_invalid");
  }
  return normalized;
}

export function normalizeIdentityDevicePhone(value: unknown): string {
  if (typeof value !== "string") throw new Error("identity_device_phone_invalid");
  let normalized = value.normalize("NFKC").trim().replace(/[\s.()\-]/g, "");
  if (normalized.startsWith("0033")) normalized = `+33${normalized.slice(4)}`;
  if (/^0\d{9}$/.test(normalized)) normalized = `+33${normalized.slice(1)}`;
  if (!/^\+[1-9]\d{7,14}$/.test(normalized)) {
    throw new Error("identity_device_phone_invalid");
  }
  return normalized;
}

export function normalizeIdentityDeviceClaimName(value: unknown): string {
  if (typeof value !== "string") throw new Error("identity_device_name_invalid");
  const normalized = value.normalize("NFKC").trim().replace(/\s+/g, " ");
  if (normalized.length < 1 || normalized.length > 100 || !/^[\p{L}\p{M}'’ -]+$/u.test(normalized)) {
    throw new Error("identity_device_name_invalid");
  }
  return normalized;
}

function comparableName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, " ")
    .replace(/[^a-zA-Z -]/g, " ")
    .replace(/[-\s]+/g, " ")
    .trim()
    .toLowerCase();
}

export function identityDeviceClaimsMatch(input: {
  claimedProfile: IdentityDeviceRequestInput["claimedProfile"];
  claimedFirstName: string;
  claimedLastName: string;
  personType: "student" | "guardian" | "staff";
  firstName: string;
  lastName: string;
}): boolean {
  if (input.claimedProfile !== input.personType) return false;
  const claimedFirst = comparableName(input.claimedFirstName).split(" ").filter(Boolean);
  const officialFirst = comparableName(input.firstName).split(" ").filter(Boolean);
  const claimedLast = comparableName(input.claimedLastName).replace(/\s/g, "");
  const officialLast = comparableName(input.lastName).replace(/\s/g, "");
  return Boolean(
    claimedFirst.length &&
    officialFirst.length &&
    claimedFirst.some((part) => officialFirst.includes(part)) &&
    claimedLast &&
    claimedLast === officialLast
  );
}

export function normalizeIdentityDeviceId(value: unknown): string {
  if (typeof value !== "string") throw new Error("identity_device_id_invalid");
  const normalized = value.trim();
  if (!/^[A-Za-z0-9-]{16,80}$/.test(normalized)) {
    throw new Error("identity_device_id_invalid");
  }
  return normalized;
}

export function parseIdentityDeviceIdentifyInput(value: unknown): Omit<IdentityDeviceRequestInput, 'contactType' | 'contact'> {
  const input = plainObject(value);
  exactFields(input, ['claimedProfile', 'claimedFirstName', 'claimedLastName', 'deviceId', 'rememberDevice']);
  if (typeof input.rememberDevice !== 'boolean' || !['student', 'guardian', 'staff'].includes(String(input.claimedProfile))) {
    throw new Error('identity_device_input_invalid');
  }
  return {
    claimedProfile: input.claimedProfile as IdentityDeviceRequestInput['claimedProfile'],
    claimedFirstName: normalizeIdentityDeviceClaimName(input.claimedFirstName),
    claimedLastName: normalizeIdentityDeviceClaimName(input.claimedLastName),
    deviceId: normalizeIdentityDeviceId(input.deviceId), rememberDevice: input.rememberDevice,
  };
}

export function parseIdentityDeviceRequestInput(value: unknown): IdentityDeviceRequestInput {
  const input = plainObject(value);
  exactFields(input, [
    "contactType",
    "contact",
    "claimedProfile",
    "claimedFirstName",
    "claimedLastName",
    "deviceId",
    "rememberDevice",
  ]);
  if (typeof input.rememberDevice !== "boolean") {
    throw new Error("identity_device_remember_invalid");
  }
  if (input.contactType !== "email" && input.contactType !== "phone") {
    throw new Error("identity_device_contact_type_invalid");
  }
  if (!['student', 'guardian', 'staff'].includes(String(input.claimedProfile))) {
    throw new Error("identity_device_profile_invalid");
  }
  return {
    contactType: input.contactType,
    contact: input.contactType === "email"
      ? normalizeIdentityDeviceEmail(input.contact)
      : normalizeIdentityDevicePhone(input.contact),
    claimedProfile: input.claimedProfile as IdentityDeviceRequestInput["claimedProfile"],
    claimedFirstName: normalizeIdentityDeviceClaimName(input.claimedFirstName),
    claimedLastName: normalizeIdentityDeviceClaimName(input.claimedLastName),
    deviceId: normalizeIdentityDeviceId(input.deviceId),
    rememberDevice: input.rememberDevice,
  };
}

export function parseIdentityDeviceVerifyInput(value: unknown): IdentityDeviceVerifyInput {
  const input = plainObject(value);
  exactFields(input, ["code"]);
  if (typeof input.code !== "string" || !/^\d{6}$/.test(input.code)) {
    throw new Error("identity_device_code_invalid");
  }
  return { code: input.code };
}

export function identityDeviceFeatureEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.IDENTITY_DEVICE_ACCESS_ENABLED === "true";
}

export type IdentityDevicePublicState = {
  available: boolean;
  status: "checking" | "code_sent" | "needs_contact_update" | "verified" | "unavailable";
  message: string;
  expiresAt?: string;
  personType?: "student" | "guardian" | "staff";
};

export function identityDeviceReadyPayload(expiresAt: Date): IdentityDevicePublicState {
  return {
    available: true,
    status: "checking",
    message: "Recherche de votre identité dans l’annuaire du lycée…",
    expiresAt: expiresAt.toISOString(),
  };
}

export function identityDeviceCodeSentPayload(expiresAt: Date): IdentityDevicePublicState {
  return {
    available: true,
    status: "code_sent",
    message: "Le code a été envoyé au moyen de contact connu du lycée.",
    expiresAt: expiresAt.toISOString(),
  };
}

export function identityDeviceContactUpdatePayload(expiresAt: Date): IdentityDevicePublicState {
  return {
    available: true,
    status: "needs_contact_update",
    message: "Aucun code n’a pu être envoyé. Vérifiez les informations saisies ou demandez l’ajout ou la correction de vos coordonnées.",
    expiresAt: expiresAt.toISOString(),
  };
}
