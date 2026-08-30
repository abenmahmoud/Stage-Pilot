import { Buffer } from "node:buffer";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_CURSOR_LENGTH = 512;
export const PUBLIC_CONTENT_PAGE_SIZE = 100;
export type PublicContentScope = "current" | "expired";

export type PublicContentCursor = {
  scope: PublicContentScope;
  featured: boolean;
  publishedAt: Date;
  id: string;
};

export function parsePublicContentScope(value: unknown): PublicContentScope {
  if (value === undefined || value === "") return "current";
  if (Array.isArray(value) || value !== "expired") throw new Error("scope_invalid");
  return value;
}

function cursorObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("cursor_invalid");
  }
  return value as Record<string, unknown>;
}

export function parsePublicContentPageSize(value: string | undefined): number {
  if (value === undefined || value === "") return PUBLIC_CONTENT_PAGE_SIZE;
  if (!/^\d{1,3}$/.test(value)) throw new Error("limit_invalid");
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1 || limit > PUBLIC_CONTENT_PAGE_SIZE) {
    throw new Error("limit_invalid");
  }
  return limit;
}

export function encodePublicContentCursor(input: PublicContentCursor): string {
  if ((input.scope !== "current" && input.scope !== "expired")
    || !UUID_PATTERN.test(input.id)
    || Number.isNaN(input.publishedAt.getTime())) {
    throw new Error("cursor_invalid");
  }
  return Buffer.from(JSON.stringify({
    scope: input.scope,
    featured: input.featured,
    publishedAt: input.publishedAt.toISOString(),
    id: input.id,
  }), "utf8").toString("base64url");
}

export function parsePublicContentCursor(value: string | undefined): PublicContentCursor | null {
  if (!value) return null;
  if (value.length > MAX_CURSOR_LENGTH || !/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new Error("cursor_invalid");
  }
  let decoded: unknown;
  try {
    decoded = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
  } catch {
    throw new Error("cursor_invalid");
  }
  const input = cursorObject(decoded);
  if (
    Object.keys(input).sort().join(",") !== "featured,id,publishedAt,scope" ||
    (input.scope !== "current" && input.scope !== "expired") ||
    typeof input.featured !== "boolean" ||
    typeof input.publishedAt !== "string" ||
    typeof input.id !== "string" ||
    !UUID_PATTERN.test(input.id)
  ) {
    throw new Error("cursor_invalid");
  }
  const publishedAt = new Date(input.publishedAt);
  if (Number.isNaN(publishedAt.getTime()) || publishedAt.toISOString() !== input.publishedAt) {
    throw new Error("cursor_invalid");
  }
  return { scope: input.scope, featured: input.featured, publishedAt, id: input.id };
}
