import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  isSiteContentPublicAt,
  normalizeSiteSlug,
  parseSiteAssetInput,
  parseSiteContentAiInput,
  parseSiteContentInput,
} from "../shared/site-content.ts";
import {
  hasPublicSiteContentVersion,
  rolesForSiteContentAction,
  siteContentStatusAllowsAction,
} from "../shared/site-content-policy.ts";
import { roleIsAllowed } from "../shared/role-access.ts";

const validContent = {
  contentType: "article",
  slug: "rentree-2026",
  title: "Rentrée 2026",
  summary: "Les informations essentielles.",
  bodyMarkdown: "## Horaires\n\nAccueil à 8 h.",
  category: "Rentrée",
  audience: "tous",
  templateId: null,
  featured: true,
  metaTitle: "Rentrée 2026 au lycée",
  metaDescription: "Horaires et informations pratiques.",
  publishAt: "2026-08-27T06:00:00.000Z",
  expiresAt: "2026-09-30T21:59:00.000Z",
  assets: [],
};

test("normalizes a readable French slug", () => {
  assert.equal(normalizeSiteSlug("À la rentrée : informations !"), "a-la-rentree-informations");
});

test("parses a complete editorial draft", () => {
  const parsed = parseSiteContentInput(validContent);
  assert.equal(parsed.contentType, "article");
  assert.equal(parsed.featured, true);
  assert.equal(parsed.publishAt?.toISOString(), "2026-08-27T06:00:00.000Z");
});

test("rejects an expiration before publication", () => {
  assert.throws(() => parseSiteContentInput({ ...validContent, expiresAt: "2026-08-26T06:00:00.000Z" }), /postérieure/);
});

test("requires an accessible description for images", () => {
  assert.throws(() => parseSiteAssetInput({ originalName: "photo.webp", mimeType: "image/webp", sizeBytes: 1000, title: "Le lycée", altText: "" }), /Décrivez l’image/);
});

test("rejects files above 10 MB", () => {
  assert.throws(() => parseSiteAssetInput({ originalName: "dossier.pdf", mimeType: "application/pdf", sizeBytes: 11 * 1024 * 1024, title: "Dossier", altText: null }), /moins de 10 Mo/);
});

test("limits editorial AI instructions", () => {
  assert.throws(() => parseSiteContentAiInput({ action: "ameliorer", contentType: "article", title: "Titre", summary: "", bodyMarkdown: "", instructions: "x".repeat(1001) }), /1000 caractères/);
});

test("rejects invalid editorial values and oversized content", () => {
  assert.throws(() => parseSiteContentInput({ ...validContent, contentType: "script" }), /Type est invalide/);
  assert.throws(() => parseSiteContentInput({ ...validContent, audience: "internet" }), /Public est invalide/);
  assert.throws(() => parseSiteContentInput({ ...validContent, title: "x".repeat(181) }), /180 caractères/);
  assert.throws(() => parseSiteContentInput({ ...validContent, bodyMarkdown: "x".repeat(30_001) }), /30000 caractères/);
  assert.throws(() => parseSiteContentInput({ ...validContent, assets: Array.from({ length: 21 }) }), /liste des fichiers/);
});

test("separates editorial and publishing roles", () => {
  const editRoles = rolesForSiteContentAction("submit_review");
  const publishRoles = rolesForSiteContentAction("publish");
  assert.equal(roleIsAllowed("administration", editRoles), true);
  assert.equal(roleIsAllowed("administration", publishRoles), false);
  assert.equal(roleIsAllowed("proviseur", publishRoles), true);
  assert.equal(roleIsAllowed("superadmin", publishRoles), true);
  assert.equal(roleIsAllowed("professeur", editRoles), false);
});

test("blocks review and publication while content is archived", () => {
  assert.equal(siteContentStatusAllowsAction("archive", "submit_review"), false);
  assert.equal(siteContentStatusAllowsAction("archive", "publish"), false);
  assert.equal(siteContentStatusAllowsAction("archive", "restore"), true);
  assert.equal(siteContentStatusAllowsAction("brouillon", "submit_review"), true);
  assert.equal(siteContentStatusAllowsAction("a_valider", "publish"), true);
});

test("keeps restricted audiences out of the public site", () => {
  const content = parseSiteContentInput({ ...validContent, audience: "parents" });
  assert.equal(isSiteContentPublicAt(content, new Date("2026-08-28T06:00:00.000Z")), false);
});

test("publishes only inside the configured date window", () => {
  const content = parseSiteContentInput(validContent);
  assert.equal(isSiteContentPublicAt(content, new Date("2026-08-26T06:00:00.000Z")), false);
  assert.equal(isSiteContentPublicAt(content, new Date("2026-08-28T06:00:00.000Z")), true);
  assert.equal(isSiteContentPublicAt(content, new Date("2026-10-01T06:00:00.000Z")), false);
});

test("keeps never-published drafts out of the public API", async () => {
  assert.equal(hasPublicSiteContentVersion({ status: "brouillon", publishedVersion: null }), false);
  assert.equal(hasPublicSiteContentVersion({ status: "a_valider", publishedVersion: null }), false);
  assert.equal(hasPublicSiteContentVersion({ status: "publie", publishedVersion: 1 }), true);
  assert.equal(hasPublicSiteContentVersion({ status: "archive", publishedVersion: 1 }), false);
  assert.equal(
    hasPublicSiteContentVersion({ status: "brouillon", publishedVersion: 2 }),
    true,
    "La dernière version publiée reste servie pendant la préparation d'un nouveau brouillon"
  );

  const source = await readFile(new URL("../api/content/public.ts", import.meta.url), "utf8");
  assert.match(source, /isNotNull\(siteContentItems\.publishedVersion\)/);
  assert.match(source, /hasPublicSiteContentVersion\(row\.item\)/);
  assert.match(source, /eq\(siteContentVersions\.version, siteContentItems\.publishedVersion\)/);
});
