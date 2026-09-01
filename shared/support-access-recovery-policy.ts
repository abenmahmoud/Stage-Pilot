export type SupportAccessRecoveryInput = { publicCode: string; email: string };

export function parseSupportAccessRecoveryInput(value: unknown): SupportAccessRecoveryInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid_recovery_input");
  const input = value as Record<string, unknown>;
  if (Object.keys(input).length !== 2 || typeof input.publicCode !== "string" || typeof input.email !== "string") {
    throw new Error("invalid_recovery_input");
  }
  if (input.publicCode.length > 30 || input.email.length > 254 || /[\u0000-\u001f\u007f]/.test(input.publicCode + input.email)) {
    throw new Error("invalid_recovery_input");
  }
  const publicCode = input.publicCode.trim().toUpperCase();
  const email = input.email.trim().toLowerCase();
  if (!/^BC-[0-9]{4}-[0-9]{6}$/.test(publicCode) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("invalid_recovery_input");
  }
  return { publicCode, email };
}

export function isSupportAccessRecoveryPayload(value: unknown): value is { accepted: true } {
  return Boolean(value && typeof value === "object" && !Array.isArray(value)
    && Object.keys(value).length === 1 && (value as Record<string, unknown>).accepted === true);
}

export const SUPPORT_ACCESS_RECOVERY_COOLDOWN_SECONDS = 60;
