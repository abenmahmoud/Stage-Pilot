import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { applyLegacyPreviewEditorialCorrections } from "../shared/legacy-editorial-corrections.ts";
import { reviewLegacyEditorialQuality } from "../shared/legacy-editorial-quality.ts";

const inventory = JSON.parse(
  await readFile(new URL("../content/legacy-site/inventory.json", import.meta.url), "utf8")
);

const automaticallyResolvedCodes = new Set([
  "accessibility.generic_link_label",
  "conversion.concatenated_call_to_action",
  "conversion.empty_heading",
  "conversion.raw_url_heading",
  "language.baccalaureat_agreement",
  "language.heading_capitalization",
  "language.ordinal_typography",
  "language.title_wording",
  "links.insecure_http",
]);

function correctedInventory() {
  return inventory.contents.map((content) => {
    const result = applyLegacyPreviewEditorialCorrections({
      title: content.title,
      summary: content.summary,
      bodyMarkdown: content.bodyMarkdown,
    });
    return {
      original: content,
      corrected: { ...content, ...result.draft },
      corrections: result.corrections,
    };
  });
}

test("applies only the twenty-one deterministic corrections in the fixed inventory", () => {
  const corrected = correctedInventory();
  const occurrences = corrected.flatMap((item) => item.corrections)
    .reduce((total, correction) => total + correction.occurrences, 0);
  assert.equal(occurrences, 21);
  assert.equal(corrected.filter((item) => item.corrections.length > 0).length, 6);

  for (const item of corrected) {
    assert.equal(item.corrected.slug, item.original.slug);
    assert.equal(item.corrected.sourceUrl, item.original.sourceUrl);
    assert.equal(item.corrected.sourceModifiedAt, item.original.sourceModifiedAt);
    assert.equal(item.corrected.disposition, item.original.disposition);
    assert.equal(item.corrected.referencedMedia, item.original.referencedMedia);
  }
});

test("removes only auto-correctable findings and keeps human decisions open", () => {
  const corrected = correctedInventory();
  const review = reviewLegacyEditorialQuality(corrected.map((item) => item.corrected));
  const remainingCodes = new Set(review.items.flatMap((item) => item.issues.map((issue) => issue.code)));

  for (const code of automaticallyResolvedCodes) assert.equal(remainingCodes.has(code), false, code);
  assert.equal(remainingCodes.has("accessibility.generic_image_alt"), true);
  assert.equal(remainingCodes.has("content.empty_body"), true);
  assert.equal(remainingCodes.has("decision.current_facts_required"), true);
  assert.equal(remainingCodes.has("decision.business_review_required"), true);
  assert.equal(remainingCodes.has("freshness.slug_title_year_mismatch"), true);
  assert.equal(remainingCodes.has("routing.opaque_slug"), true);
  assert.equal(review.contentsReviewed, 28);
  assert.deepEqual(review.issueCounts, { blocking: 1, major: 8, review: 30 });
});

test("keeps source values immutable and rejects malformed drafts", () => {
  const source = Object.freeze({
    title: "Présentation Lycée",
    summary: "Accès Rapides",
    bodyMarkdown: "#\nVoir la 2ème édition.",
  });
  const result = applyLegacyPreviewEditorialCorrections(source);
  assert.deepEqual(source, {
    title: "Présentation Lycée",
    summary: "Accès Rapides",
    bodyMarkdown: "#\nVoir la 2ème édition.",
  });
  assert.equal(result.draft.title, "Présentation du lycée");
  assert.equal(result.draft.summary, "Accès rapides");
  assert.equal(result.draft.bodyMarkdown, "Voir la 2e édition.");

  assert.throws(
    () => applyLegacyPreviewEditorialCorrections({ ...source, extra: "refusé" }),
    /Champs éditoriaux inattendus/
  );
  assert.throws(
    () => applyLegacyPreviewEditorialCorrections({ ...source, title: "" }),
    /Titre éditorial manquant/
  );
});

test("keeps unknown or unsafe destinations unchanged", () => {
  const result = applyLegacyPreviewEditorialCorrections({
    title: "Essai",
    summary: "",
    bodyMarkdown: [
      "## [http://example.test](http://example.test)",
      "[Voir plus](https://example.test/ressource)",
      "![Photo](http://example.test/photo.jpg)",
    ].join("\n"),
  });
  assert.equal(result.corrections.length, 0);
  assert.match(result.draft.bodyMarkdown, /http:\/\/example\.test/);
  assert.match(result.draft.bodyMarkdown, /\[Voir plus\]\(https:\/\/example\.test/);
});

test("records correction codes in the import without publishing the draft", async () => {
  const route = await readFile(new URL("../api/content/admin/legacy-import.ts", import.meta.url), "utf8");
  assert.match(route, /applyLegacyPreviewEditorialCorrections/);
  assert.match(route, /editorialCorrections: editorial\.corrections/);
  assert.match(route, /needsReview: true/);
  assert.match(route, /status: "brouillon"/);
  assert.doesNotMatch(route, /needsReview: false/);
});
