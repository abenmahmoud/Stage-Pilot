import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  encodePublicContentCursor,
  parsePublicContentCursor,
  parsePublicContentPageSize,
  parsePublicContentScope,
} from "../api/_shared/public-content-pagination.ts";
import {
  requestQueryValue,
  requestSearchParams,
} from "../api/_shared/request-url.ts";
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

test("round-trips a bounded opaque cursor and rejects malformed pagination", () => {
  const cursor = encodePublicContentCursor({
    scope: "current",
    featured: true,
    publishedAt: new Date("2026-08-30T08:00:00.000Z"),
    id: "55c4f7ca-2cdb-4a9d-8b9a-24f422e7dc2d",
  });
  assert.doesNotMatch(cursor, /55c4f7ca/);
  assert.deepEqual(parsePublicContentCursor(cursor), {
    scope: "current",
    featured: true,
    publishedAt: new Date("2026-08-30T08:00:00.000Z"),
    id: "55c4f7ca-2cdb-4a9d-8b9a-24f422e7dc2d",
  });
  assert.equal(parsePublicContentCursor(undefined), null);
  assert.equal(parsePublicContentPageSize(undefined), 100);
  assert.equal(parsePublicContentPageSize("25"), 25);
  assert.equal(parsePublicContentScope(undefined), "current");
  assert.equal(parsePublicContentScope("expired"), "expired");
  assert.throws(() => parsePublicContentScope("all"), /scope_invalid/);
  assert.throws(() => parsePublicContentScope(["expired", "expired"]), /scope_invalid/);
  assert.throws(() => encodePublicContentCursor({
    scope: "all",
    featured: false,
    publishedAt: new Date("2026-08-30T08:00:00.000Z"),
    id: "55c4f7ca-2cdb-4a9d-8b9a-24f422e7dc2d",
  }), /cursor_invalid/);
  assert.throws(() => parsePublicContentCursor("cursor-falsifie"), /cursor_invalid/);
  assert.throws(() => parsePublicContentPageSize("101"), /limit_invalid/);
  assert.throws(() => parsePublicContentPageSize("1.5"), /limit_invalid/);
});

test("reads public query parameters without the deprecated Vercel query getter", () => {
  const params = requestSearchParams("/api/content/public?limit=25&archive=expired&archive=current");
  assert.equal(requestQueryValue(params, "limit"), "25");
  assert.deepEqual(requestQueryValue(params, "archive"), ["expired", "current"]);
  assert.equal(requestQueryValue(params, "missing"), undefined);
});

test("keeps the public API limited to published snapshots in the requested time scope", async () => {
  const route = await readFile(new URL("../api/content/public.ts", import.meta.url), "utf8");
  assert.match(route, /isNotNull\(siteContentItems\.publishedVersion\)/);
  assert.match(route, /isNotNull\(siteContentItems\.publishedAt\)/);
  assert.match(route, /ne\(siteContentItems\.status, "archive"\)/);
  assert.match(route, /eq\(siteContentItems\.audience, "tous"\)/);
  assert.match(route, /lte\(siteContentItems\.publishAt, now\)/);
  assert.match(route, /gt\(siteContentItems\.expiresAt, now\)/);
  assert.match(route, /parsePublicContentScope\(requestQueryValue\(searchParams, "archive"\)\)/);
  assert.match(route, /requestSearchParams\(req\.url\)/);
  assert.doesNotMatch(route, /req\.query/);
  assert.match(route, /and\(isNotNull\(siteContentItems\.expiresAt\), lte\(siteContentItems\.expiresAt, now\)\)/);
  assert.match(route, /cursor\.scope !== scope/);
  assert.match(route, /scope === "expired"/);
  assert.match(route, /content\.expiresAt <= now/);
  assert.match(route, /isSiteContentPublicAt\(content, now\)/);
  assert.match(route, /desc\(siteContentItems\.featured\)/);
  assert.match(route, /desc\(siteContentItems\.publishedAt\)/);
  assert.match(route, /desc\(siteContentItems\.id\)/);
  assert.match(route, /limit\(requestedSlug \? 1 : pageSize \+ 1\)/);
  assert.match(route, /return \{ items, nextCursor, scope \}/);
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
  assert.match(page, /Charger plus d’informations/);
  assert.match(page, /knownIds\.has\(item\.id\)/);
  assert.match(page, /loadingMoreRef\.current/);
  assert.match(page, /role="group"/);
  assert.match(page, /aria-pressed=\{scope === "expired"\}/);
  assert.match(page, /archive=expired/);
  assert.match(page, /Les publications retirées par la direction ne sont jamais affichées ici/);
  assert.doesNotMatch(page, /filterPublicContentFeed\([^\n]*bodyMarkdown/);
  assert.match(css, /\.lycee-news-controls \{[^}]*grid-template-columns: minmax\(0,1fr\)/);
  assert.match(css, /@media \(max-width: 720px\)[\s\S]*\.lycee-news-controls \{ grid-template-columns: 1fr; \}/);
  assert.match(css, /\.lycee-news-controls input, \.lycee-news-controls select \{[^}]*min-width: 0/);
  assert.match(css, /\.lycee-news-load-more button \{[^}]*min-height: 44px/);
});
