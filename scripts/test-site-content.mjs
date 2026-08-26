import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeSiteSlug,
  parseSiteAssetInput,
  parseSiteContentAiInput,
  parseSiteContentInput,
} from "../shared/site-content.ts";

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
