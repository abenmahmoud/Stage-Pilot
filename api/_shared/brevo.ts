import { HttpError } from "./auth.js";
import { readJsonApiResponse } from "../../shared/json-api-response.js";

const BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email";
const BREVO_SMS_ENDPOINT = "https://api.brevo.com/v3/transactionalSMS/send";
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
  messageId?: string | number;
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

export async function sendTransactionalSms(input: {
  recipient: string;
  content: string;
  tag?: string;
}): Promise<{ messageId: string }> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) throw new HttpError(503, "Le service SMS n'est pas configuré");
  // The old identity sender was configured for PFMP. School messages use their
  // own sender so a legacy stage setting cannot rename the lycée's OTPs.
  const sender = process.env.SCHOOL_SMS_SENDER?.trim() || "LycCendrars";
  if (!sender || !/^[A-Za-z0-9]{3,11}$/.test(sender)) {
    throw new HttpError(503, "L'expéditeur SMS n'est pas configuré");
  }
  const response = await fetch(BREVO_SMS_ENDPOINT, {
    method: "POST",
    signal: AbortSignal.timeout(15_000),
    headers: {
      accept: "application/json",
      "api-key": apiKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      sender,
      recipient: input.recipient.replace(/^\+/, ""),
      content: input.content,
      type: "transactional",
      tag: input.tag ?? "lyceegest-identity",
      unicodeEnabled: true,
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
  if (response.ok && payload.messageId !== undefined) {
    return { messageId: String(payload.messageId) };
  }
  const error = new Error(payload.code || `brevo_sms_http_${response.status}`);
  error.name = response.status >= 400 && response.status < 500 && response.status !== 408
    ? "BrevoRejectedError" : "BrevoError";
  throw error;
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
    return { messageId: String(payload.messageId), duplicate: false };
  }
  if (payload.code === "duplicate_parameter") {
    return { messageId: `duplicate:${email.idempotencyKey}`, duplicate: true };
  }

  const error = new Error(payload.code || `brevo_http_${response.status}`);
  error.name = response.status >= 400 && response.status < 500 && response.status !== 408
    ? "BrevoRejectedError" : "BrevoError";
  throw error;
}
