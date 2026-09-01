export type SupportAccessCodeInput = {
  publicCode: string;
  code: string;
};

const INPUT_FIELDS = new Set(["publicCode", "code"]);

export function parseSupportAccessCodeInput(value: unknown): SupportAccessCodeInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("support_access_code_input_invalid");
  }
  const input = value as Record<string, unknown>;
  if (
    Object.keys(input).length !== INPUT_FIELDS.size
    || Object.keys(input).some((field) => !INPUT_FIELDS.has(field))
    || typeof input.publicCode !== "string"
    || typeof input.code !== "string"
  ) {
    throw new Error("support_access_code_input_invalid");
  }

  const publicCode = input.publicCode.trim().toUpperCase();
  const code = input.code.trim();
  if (!/^BC-[0-9]{4}-[0-9]{6}$/.test(publicCode) || !/^[0-9]{6}$/.test(code)) {
    throw new Error("support_access_code_input_invalid");
  }
  return { publicCode, code };
}
