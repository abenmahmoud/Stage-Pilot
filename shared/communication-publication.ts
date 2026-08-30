import { detectForbiddenSupportSecret } from "./support-secret-policy.js";

export type CommunicationReviewVisibility = "internal" | "public";

const EMAIL_ADDRESS = /\b[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+\b/iu;
const PHONE_NUMBER = /(?<!\d)(?:(?:\+|00)33[\s.-]?(?:\(0\)[\s.-]?)?|0)[1-9](?:[\s.-]?\d{2}){4}(?!\d)/u;

export function parseCommunicationReviewRequest(value: unknown): {
  confirmation: "VERIFIER";
  visibility: CommunicationReviewVisibility;
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("review_request_invalid");
  }
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some((key) => !["confirmation", "visibility"].includes(key))) {
    throw new Error("review_request_invalid");
  }
  if (input.confirmation !== "VERIFIER") throw new Error("review_confirmation_invalid");
  if (input.visibility !== "internal" && input.visibility !== "public") {
    throw new Error("review_visibility_invalid");
  }
  return { confirmation: "VERIFIER", visibility: input.visibility };
}

export function assertCommunicationPublicContent(input: {
  title: string;
  summary: string;
  bodyMarkdown: string;
  openQuestions: unknown;
}): void {
  if (input.summary.length > 600 || input.bodyMarkdown.length > 30_000) {
    throw new Error("public_content_too_long");
  }
  if (!Array.isArray(input.openQuestions)) throw new Error("open_questions_invalid");
  if (input.openQuestions.length > 0) {
    throw new Error("open_questions_remaining");
  }
  const content = `${input.title}\n${input.summary}\n${input.bodyMarkdown}`;
  if (detectForbiddenSupportSecret(content)) throw new Error("secret_forbidden");
  if (EMAIL_ADDRESS.test(content)) throw new Error("email_address_forbidden");
  if (PHONE_NUMBER.test(content)) throw new Error("phone_number_forbidden");
}

export function communicationPublicSlug(title: string, communicationId: string): string {
  const suffix = communicationId.replace(/[^a-z0-9]/gi, "").toLowerCase().slice(-10);
  if (suffix.length < 8) throw new Error("communication_id_invalid");
  const stem = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96)
    .replace(/-+$/g, "") || "information";
  return `${stem}-${suffix}`;
}

export function communicationPublicCategory(category: string): string {
  const labels: Record<string, string> = {
    information: "Information",
    rentree: "Rentrée",
    document: "Document",
    evenement: "Événement",
    urgent: "Urgent",
    rappel: "Rappel",
  };
  return labels[category] ?? "Vie du lycée";
}
