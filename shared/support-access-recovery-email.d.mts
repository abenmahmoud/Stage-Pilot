export function buildSupportAccessRecoveryEmail(input: {
  publicCode: string;
  trackingUrl: string;
  accessCode: string | null;
  requesterName?: string;
}): { subject: string; textContent: string; htmlContent: string };
