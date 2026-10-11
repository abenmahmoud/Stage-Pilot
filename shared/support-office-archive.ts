/** Office bookkeeping only: archiving never resolves a request or grants identity. */
export function officeArchiveDate(context: Record<string, unknown> | null | undefined): string | null {
  const value = context?.officeArchive;
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
    && Number.isFinite(Date.parse(value)) ? value : null;
}

export function isOfficeArchived(context: Record<string, unknown> | null | undefined, messages: Array<{ direction: string; createdAt: string }> = []): boolean {
  const date = officeArchiveDate(context);
  return Boolean(date && !messages.some((message) => message.direction === "inbound" && Date.parse(message.createdAt) > Date.parse(date)));
}

export function isOfficeArchiveInput(value: unknown): value is { publicCode: string; archived: boolean; expectedUpdatedAt: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const body = value as Record<string, unknown>;
  return Object.keys(body).length === 3 && typeof body.publicCode === "string"
    && /^BC-\d{4}-\d{6}$/.test(body.publicCode) && typeof body.archived === "boolean"
    && typeof body.expectedUpdatedAt === "string" && body.expectedUpdatedAt.length <= 80
    && Number.isFinite(Date.parse(body.expectedUpdatedAt));
}
