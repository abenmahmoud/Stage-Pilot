import { createHash, timingSafeEqual } from "node:crypto";

export function isCommunicationWebhookSecret(value: string | undefined): value is string {
  return typeof value === "string" &&
    value.length >= 32 &&
    value.length <= 512 &&
    !/[\s\u0000-\u001f\u007f,]/u.test(value);
}

export function verifyCommunicationWebhookBearerHeader(
  authorization: string | string[] | undefined,
  expectedSecret: string | undefined
): boolean {
  if (typeof authorization !== "string" || !isCommunicationWebhookSecret(expectedSecret)) {
    return false;
  }
  const match = /^Bearer ([\x21-\x7e]{32,512})$/u.exec(authorization);
  if (!match || match[1].includes(",")) return false;
  const expected = createHash("sha256").update(expectedSecret).digest();
  const provided = createHash("sha256").update(match[1]).digest();
  return timingSafeEqual(expected, provided);
}
