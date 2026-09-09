export const SCHOOL_EMAIL_NAME: string;
export const SCHOOL_PUBLIC_URL: string;
export type SchoolEmailContent = { subject: string; textContent: string; htmlContent: string };
export function schoolEmailSenderName(configured?: string): string;
export function schoolEmailUrl(base: string | undefined, params: Record<string, string>): string;
export function buildIdentityVerificationEmail(input: { firstName?: string; code: string }): SchoolEmailContent;
export function buildSupportRequesterEmail(input: {
  kind: "created" | "reply" | "recovery";
  publicCode: string;
  requesterName?: string;
  requestSubject?: string;
  trackingUrl: string;
  accessCode: string | null;
  bodyText?: string;
  attachmentCount?: number;
}): SchoolEmailContent;
export function buildSupportAgentEmail(input: {
  publicCode: string;
  requesterName: string;
  requestSubject: string;
  serviceName?: string;
  agentUrl: string;
  isMessage: boolean;
}): SchoolEmailContent;
