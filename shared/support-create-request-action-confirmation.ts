export type SupportCreateRequestActionConfirmation = {
  actionId: string;
  toolKey: "support.create_request";
  status: "succeeded";
  requestPublicCode: string;
  confirmedAt: string;
  confirmationRef: string;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PUBLIC_CODE_PATTERN = /^BC-[0-9]{4}-[0-9]{6}$/;

function exactKeys(value: Record<string, unknown>, expected: string[]): boolean {
  const keys = Object.keys(value).sort();
  return keys.length === expected.length
    && keys.every((key, index) => key === [...expected].sort()[index]);
}

export function verifySupportCreateRequestActionConfirmation(input: {
  expectedPublicCode: string;
  requestCreatedAt: string;
  persistenceConfirmedAt: string;
  confirmation: unknown;
  now?: number;
}): SupportCreateRequestActionConfirmation | null {
  if (!PUBLIC_CODE_PATTERN.test(input.expectedPublicCode)) return null;
  if (!input.confirmation || typeof input.confirmation !== "object" || Array.isArray(input.confirmation)) {
    return null;
  }
  const confirmation = input.confirmation as Record<string, unknown>;
  if (!exactKeys(confirmation, [
    "actionId",
    "toolKey",
    "status",
    "requestPublicCode",
    "confirmedAt",
    "confirmationRef",
  ])) return null;
  if (
    typeof confirmation.actionId !== "string"
    || !UUID_PATTERN.test(confirmation.actionId)
    || confirmation.toolKey !== "support.create_request"
    || confirmation.status !== "succeeded"
    || confirmation.requestPublicCode !== input.expectedPublicCode
    || typeof confirmation.confirmedAt !== "string"
    || confirmation.confirmationRef !== `agent-action:${confirmation.actionId}`
  ) return null;

  const createdAt = Date.parse(input.requestCreatedAt);
  const persistenceConfirmedAt = Date.parse(input.persistenceConfirmedAt);
  const confirmedAt = Date.parse(confirmation.confirmedAt);
  const now = input.now ?? Date.now();
  if (
    !Number.isFinite(createdAt)
    || !Number.isFinite(persistenceConfirmedAt)
    || !Number.isFinite(confirmedAt)
    || !Number.isFinite(now)
    || confirmedAt < createdAt
    || confirmedAt > persistenceConfirmedAt
    || confirmedAt > now + (5 * 60_000)
  ) return null;

  return confirmation as SupportCreateRequestActionConfirmation;
}
