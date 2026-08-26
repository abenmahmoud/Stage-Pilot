import { HttpError } from "./auth.js";

const BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email";

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

  const payload = (await response.json().catch(() => ({}))) as BrevoResponse;
  if (response.ok && payload.messageId) {
    return { messageId: payload.messageId, duplicate: false };
  }
  if (payload.code === "duplicate_parameter") {
    return { messageId: `duplicate:${email.idempotencyKey}`, duplicate: true };
  }

  const error = new Error(payload.code || `brevo_http_${response.status}`);
  error.name = "BrevoError";
  throw error;
}
