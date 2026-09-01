import { randomUUID } from "node:crypto";
import type { VercelRequest } from "@vercel/node";
import { supabaseAdmin, requireRole, type AuthUser, HttpError } from "./auth.js";
import type { SiteContentInput } from "../../shared/site-content.js";
import {
  SITE_EDITOR_ROLES,
  SITE_PUBLISHER_ROLES,
} from "../../shared/site-content-policy.js";

export const SITE_CONTENT_CLEAN_BUCKET = "site-content";
export const SITE_CONTENT_QUARANTINE_BUCKET = "site-content-quarantine";
export async function requireSiteEditor(req: VercelRequest): Promise<AuthUser> {
  return requireRole(req, SITE_EDITOR_ROLES);
}

export async function requireSitePublisher(req: VercelRequest): Promise<AuthUser> {
  return requireRole(req, SITE_PUBLISHER_ROLES);
}

export function inputError(error: unknown): never {
  if (error instanceof HttpError) throw error;
  throw new HttpError(400, error instanceof Error ? error.message : "Les données sont invalides");
}

export function contentSnapshot(
  input: SiteContentInput,
  status: string,
  version: number
): Record<string, unknown> {
  return {
    contentType: input.contentType,
    slug: input.slug,
    title: input.title,
    summary: input.summary,
    bodyMarkdown: input.bodyMarkdown,
    category: input.category,
    audience: input.audience,
    templateId: input.templateId,
    featured: input.featured,
    metaTitle: input.metaTitle,
    metaDescription: input.metaDescription,
    publishAt: input.publishAt?.toISOString() ?? null,
    expiresAt: input.expiresAt?.toISOString() ?? null,
    status,
    assets: input.assets,
    version,
  };
}

export function storagePathForFile(userId: string, originalName: string): string {
  const extension = originalName.includes(".")
    ? originalName.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10)
    : "bin";
  const date = new Date();
  return `${userId}/${date.getUTCFullYear()}/${String(date.getUTCMonth() + 1).padStart(2, "0")}/${randomUUID()}.${extension || "bin"}`;
}

export async function signedAssetUrl(path: string, expiresIn = 900): Promise<string | null> {
  const { data, error } = await supabaseAdmin.storage
    .from(SITE_CONTENT_CLEAN_BUCKET)
    .createSignedUrl(path, expiresIn);
  return error ? null : data.signedUrl;
}

export function redactEditorialText(value: string): string {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[EMAIL_MASQUÉ]")
    .replace(/(?:(?:\+|00)33[\s.-]?(?:\(0\)[\s.-]?)?|0)[1-9](?:[\s.-]?\d{2}){4}/g, "[TÉLÉPHONE_MASQUÉ]")
    .replace(/\b(mot de passe|mdp|password|code secret)\s*[:=]\s*\S+/gi, "$1: [SECRET_MASQUÉ]");
}
