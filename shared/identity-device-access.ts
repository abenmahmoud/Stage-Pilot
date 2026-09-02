export const IDENTITY_DEVICE_CHALLENGE_SECONDS = 10 * 60;
export const IDENTITY_DEVICE_SHARED_SESSION_SECONDS = 12 * 60 * 60;
export const IDENTITY_DEVICE_PERSISTENT_IDLE_SECONDS = 7 * 24 * 60 * 60;
export const IDENTITY_DEVICE_ABSOLUTE_SESSION_SECONDS = 30 * 24 * 60 * 60;
export const IDENTITY_DEVICE_MAX_ATTEMPTS = 5;

export type IdentityDeviceRequestInput = {
  email: string;
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

export function normalizeIdentityDeviceId(value: unknown): string {
  if (typeof value !== "string") throw new Error("identity_device_id_invalid");
  const normalized = value.trim();
  if (!/^[A-Za-z0-9-]{16,80}$/.test(normalized)) {
    throw new Error("identity_device_id_invalid");
  }
  return normalized;
}

export function parseIdentityDeviceRequestInput(value: unknown): IdentityDeviceRequestInput {
  const input = plainObject(value);
  exactFields(input, ["email", "deviceId", "rememberDevice"]);
  if (typeof input.rememberDevice !== "boolean") {
    throw new Error("identity_device_remember_invalid");
  }
  return {
    email: normalizeIdentityDeviceEmail(input.email),
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
  status: "ready" | "verified" | "unavailable";
  message: string;
  expiresAt?: string;
  personType?: "student" | "guardian" | "staff";
};

export function identityDeviceReadyPayload(expiresAt: Date): IdentityDevicePublicState {
  return {
    available: true,
    status: "ready",
    message:
      "Si cette adresse peut être utilisée, un code est envoyé. Saisissez-le ci-dessous. Sinon, le formulaire du lycée reste disponible.",
    expiresAt: expiresAt.toISOString(),
  };
}
