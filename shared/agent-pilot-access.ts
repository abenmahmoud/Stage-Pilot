/** Temporary password-only trial for service accounts; never grants a role. */
export function servicePilotPasswordOnly(role: string, until: string | undefined, now = Date.now()): boolean {
  if (role !== "agent" && role !== "administration") return false;
  if (!until || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(until)) return false;
  const expires = Date.parse(until);
  return Number.isFinite(expires) && Number.isFinite(now) && now < expires;
}
