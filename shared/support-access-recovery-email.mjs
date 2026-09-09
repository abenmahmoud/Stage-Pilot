import { buildSupportRequesterEmail } from "./school-email-templates.mjs";

export function buildSupportAccessRecoveryEmail(input) {
  return buildSupportRequesterEmail({ ...input, kind: "recovery" });
}
