export function buildSupportAccessRecoveryEmail(input: {
  publicCode: string;
  trackingUrl: string;
  accessCode: string | null;
}): { subject: string; textContent: string; htmlContent: string };
