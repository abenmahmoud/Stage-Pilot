import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  filterPublicContentFeed,
  publicContentDateLabel,
  publicContentFeedCategories,
} from "../shared/public-content-feed.ts";

const items = [
  { id: "1", title: "Réunion de rentrée", summary: "Accueil des familles", category: "Rentrée", featured: true, publishedAt: "2026-08-30T08:00:00.000Z" },
  { id: "2", title: "Exposition scientifique", summary: "Travaux des élèves", category: "Événement", featured: false, publishedAt: "2026-08-29T08:00:00.000Z" },
  { id: "3", title: "Document de rentrée", summary: "Informations pratiques", category: "Rentrée", featured: false, publishedAt: null },
];

test("builds a unique French category list", () => {
  assert.deepEqual(publicContentFeedCategories(items), ["Événement", "Rentrée"]);
});

test("filters public metadata without changing the editorial order", () => {
  assert.deepEqual(filterPublicContentFeed(items, "rentree", "all").map((item) => item.id), ["1", "3"]);
  assert.deepEqual(filterPublicContentFeed(items, "eleves", "Événement").map((item) => item.id), ["2"]);
  assert.deepEqual(filterPublicContentFeed(items, "", "Rentrée").map((item) => item.id), ["1", "3"]);
  assert.deepEqual(filterPublicContentFeed(items, "introuvable", "all"), []);
});

test("formats a public date without inventing one", () => {
  assert.match(publicContentDateLabel(items[0].publishedAt), /30 août 2026/);
  assert.equal(publicContentDateLabel(null), "Date non disponible");
  assert.equal(publicContentDateLabel("invalid"), "Date non disponible");
});

test("keeps the public API limited to published, current and non-expired snapshots", async () => {
  const route = await readFile(new URL("../api/content/public.ts", import.meta.url), "utf8");
  assert.match(route, /isNotNull\(siteContentItems\.publishedVersion\)/);
  assert.match(route, /ne\(siteContentItems\.status, "archive"\)/);
  assert.match(route, /isSiteContentPublicAt\(content, now\)/);
  assert.match(route, /orderBy\(desc\(siteContentItems\.featured\), desc\(siteContentItems\.publishedAt\)\)/);
  assert.match(route, /limit\(requestedSlug \? 1 : 100\)/);
  assert.doesNotMatch(route, /communications|communicationVersions|approvedBy|createdBy/);
});

test("adds accessible metadata-only search and responsive controls", async () => {
  const page = await readFile(new URL("../src/pages/prototype/LyceeConnectPrototype.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../src/pages/prototype/lycee-connect.css", import.meta.url), "utf8");
  assert.match(page, /type="search"/);
  assert.match(page, /Filtrer par catégorie/);
  assert.match(page, /aria-live="polite"/);
  assert.match(page, /filterPublicContentFeed\(items, query, category\)/);
  assert.match(page, /publicContentDateLabel\(selected\.publishedAt\)/);
  assert.match(page, /Effacer les filtres/);
  assert.doesNotMatch(page, /filterPublicContentFeed\([^\n]*bodyMarkdown/);
  assert.match(css, /\.lycee-news-controls \{[^}]*grid-template-columns: minmax\(0,1fr\)/);
  assert.match(css, /@media \(max-width: 720px\)[\s\S]*\.lycee-news-controls \{ grid-template-columns: 1fr; \}/);
  assert.match(css, /\.lycee-news-controls input, \.lycee-news-controls select \{[^}]*min-width: 0/);
});
