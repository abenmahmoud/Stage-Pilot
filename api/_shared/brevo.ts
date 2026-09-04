import { HttpError } from "./auth.js";
import { readJsonApiResponse } from "../../shared/json-api-response.js";

const BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email";
const BREVO_RESPONSE_MAX_BYTES = 256 * 1024;

export type TransactionalEmail = {
  to: { email: string; name?: string };
  subject: string;
  textContent: string;
  htmlContent: string;
  idempotencyKey: string;
  replyTo?: { email: string; name?: string };
  tags?: string[];
};

type BrevoResponse = {
  messageId?: string;
  code?: string;
  message?: string;
};

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function sendTransactionalEmail(
  email: TransactionalEmail
): Promise<{ messageId: string; duplicate: boolean }> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) throw new HttpError(503, "Le service email n'est pas configuré");

  const senderEmail = process.env.SUPPORT_FROM_EMAIL;
  if (!senderEmail) throw new HttpError(503, "L'expéditeur email n'est pas configuré");
  const senderName = process.env.SUPPORT_FROM_NAME ?? "Lycée Blaise Cendrars";
  const response = await fetch(BREVO_ENDPOINT, {
    method: "POST",
    signal: AbortSignal.timeout(15_000),
    headers: {
      accept: "application/json",
      "api-key": apiKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      sender: { email: senderEmail, name: senderName },
      to: [email.to],
      replyTo: email.replyTo ?? { email: senderEmail, name: senderName },
      subject: email.subject,
      textContent: email.textContent,
      htmlContent: email.htmlContent,
      tags: email.tags ?? ["lyceegest-support"],
      headers: { idempotencyKey: email.idempotencyKey },
    }),
  });

  let payload: BrevoResponse = {};
  try {
    payload = await readJsonApiResponse<BrevoResponse>(response, {
      maxBytes: BREVO_RESPONSE_MAX_BYTES,
      requireOk: false,
    });
  } catch {
    payload = {};
  }
  if (response.ok && payload.messageId) {
    return { messageId: payload.messageId, duplicate: false };
  }
  if (payload.code === "duplicate_parameter") {
    return { messageId: `duplicate:${email.idempotencyKey}`, duplicate: true };
  }

  const error = new Error(payload.code || `brevo_http_${response.status}`);
  error.name = response.status >= 400 && response.status < 500 && response.status !== 408
    ? "BrevoRejectedError" : "BrevoError";
  throw error;
}
