import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  MAX_RESPONSE_BYTES,
  MAX_METADATA_ITEMS,
  REQUEST_TIMEOUT_MS,
  SOURCE_ORIGIN,
  compareLegacyCategorySnapshots,
  compareLegacyMediaSnapshots,
  compareLegacySnapshots,
  validateDeclaredCount,
  validateLiveCategoryRows,
  validateLiveMediaRows,
  validateLiveRows,
} from "./check-legacy-wordpress-drift.mjs";

const base = {
  wordpressId: 42,
  wordpressType: "page",
  originalSlug: "formations",
  sourceUrl: `${SOURCE_ORIGIN}/formations/`,
  sourceModifiedAt: "2026-08-30T08:00:00Z",
  title: "Formations",
};

test("confirme un inventaire public identique", () => {
  const result = compareLegacySnapshots([base], [{ ...base }]);
  assert.deepEqual(result, {
    inventoryCount: 1,
    liveCount: 1,
    added: [],
    removed: [],
    changed: [],
    hasDrift: false,
  });
});

test("signale ajouts, retraits et modifications sans les appliquer", () => {
  const removed = { ...base, wordpressId: 43, originalSlug: "cdi", sourceUrl: `${SOURCE_ORIGIN}/cdi/` };
  const added = { ...base, wordpressId: 44, originalSlug: "unss", sourceUrl: `${SOURCE_ORIGIN}/unss/` };
  const changed = { ...base, title: "Toutes les formations" };
  const result = compareLegacySnapshots([base, removed], [changed, added]);
  assert.equal(result.hasDrift, true);
  assert.deepEqual(result.added, [added]);
  assert.deepEqual(result.removed, [removed]);
  assert.equal(result.changed.length, 1);
  assert.equal(result.changed[0].key, "page:42");
});

test("refuse les lignes hors origine, non publiees ou dupliquees", () => {
  const row = {
    id: 42,
    type: "page",
    status: "publish",
    slug: "formations",
    link: `${SOURCE_ORIGIN}/formations/`,
    modified_gmt: "2026-08-30T08:00:00",
    title: { rendered: "Formations" },
  };
  assert.equal(validateLiveRows([row], "page")[0].title, "Formations");
  assert.throws(() => validateLiveRows([{ ...row, link: "https://example.org/formations/" }], "page"), /origine non autorisee/u);
  assert.throws(() => validateLiveRows([{ ...row, status: "draft" }], "page"), /statut inattendu/u);
  assert.throws(() => validateLiveRows([row, row], "page"), /doublon/u);
});

test("refuse une pagination qui masquerait des contenus", () => {
  const validHeaders = new Headers({ "x-wp-total": "1", "x-wp-totalpages": "1" });
  assert.doesNotThrow(() => validateDeclaredCount(validHeaders, [{}], "pages"));
  assert.throws(
    () => validateDeclaredCount(new Headers({ "x-wp-total": "101", "x-wp-totalpages": "2" }), [{}], "pages"),
    /incomplete ou trop grande/u
  );
  assert.throws(() => validateDeclaredCount(new Headers(), [], "pages"), /pagination absente/u);
});

test("conserve explicitement l'ecart 83 medias declares et 81 accessibles", () => {
  const inventoryMedia = [{
    wordpressId: 7,
    parentId: null,
    slug: "document",
    title: "Document",
    mimeType: "application/pdf",
    sourceUrl: `${SOURCE_ORIGIN}/wp-content/uploads/document.pdf`,
    modifiedAt: "2026-08-30T08:00:00Z",
  }];
  const stable = compareLegacyMediaSnapshots(inventoryMedia, [{ ...inventoryMedia[0] }], 3, 3);
  assert.equal(stable.inaccessibleInventory, 2);
  assert.equal(stable.inaccessibleLive, 2);
  assert.equal(stable.hasDrift, false);
  assert.equal(compareLegacyMediaSnapshots(inventoryMedia, [{ ...inventoryMedia[0] }], 3, 4).hasDrift, true);
});

test("valide les medias et categories sans telecharger les fichiers", () => {
  const rawMedia = {
    id: 7,
    parent: 0,
    slug: "document",
    title: { rendered: "Document" },
    mime_type: "application/pdf",
    source_url: `${SOURCE_ORIGIN}/wp-content/uploads/document.pdf`,
    modified_gmt: "2026-08-30T08:00:00",
  };
  const media = validateLiveMediaRows([rawMedia]);
  assert.equal(media[0].parentId, null);
  assert.equal(validateLiveMediaRows([{ ...rawMedia, parent: undefined }])[0].parentId, null);
  assert.throws(
    () => validateLiveMediaRows([{ ...rawMedia, id: 8, source_url: "https://example.org/file.pdf" }]),
    /origine non autorisee/u
  );

  const categories = validateLiveCategoryRows([{ id: 9, slug: "actualites", name: "Actualites", count: 4 }]);
  assert.equal(categories[0].count, 4);
  const changed = compareLegacyCategorySnapshots(categories, [{ ...categories[0], count: 5 }]);
  assert.equal(changed.hasDrift, true);
  assert.equal(compareLegacyCategorySnapshots(categories, categories, 2).hasDrift, true);
});

test("garde le controle strictement borne et en lecture seule", async () => {
  const source = await readFile(new URL("./check-legacy-wordpress-drift.mjs", import.meta.url), "utf8");
  assert.equal(SOURCE_ORIGIN, "https://lycee-blaise-cendrars-sevran.fr");
  assert.ok(REQUEST_TIMEOUT_MS > 0 && REQUEST_TIMEOUT_MS <= 15_000);
  assert.ok(MAX_RESPONSE_BYTES > 0 && MAX_RESPONSE_BYTES <= 1_000_000);
  assert.ok(MAX_METADATA_ITEMS > 0 && MAX_METADATA_ITEMS <= 500);
  assert.match(source, /method: "GET"/u);
  assert.match(source, /redirect: "error"/u);
  assert.match(source, /response\.body\.getReader\(\)/u);
  assert.doesNotMatch(source, /\b(?:writeFile|appendFile|mkdir|rm|unlink)\b/u);
  assert.doesNotMatch(source, /method:\s*["'](?:POST|PUT|PATCH|DELETE)["']/u);
  assert.doesNotMatch(source, /process\.env\.[A-Z_]*ORIGIN/u);
});
