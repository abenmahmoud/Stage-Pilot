import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  renderLegacyEditorialReviewMarkdown,
  reviewLegacyEditorialQuality,
} from "../shared/legacy-editorial-quality.ts";

const inventory = JSON.parse(await readFile(
  new URL("../content/legacy-site/inventory.json", import.meta.url),
  "utf8"
));
const committedReport = await readFile(
  new URL("../content/legacy-site/editorial-review.md", import.meta.url),
  "utf8"
);

test("detects conversion, language, accessibility and decision issues", () => {
  const review = reviewLegacyEditorialQuality([{
    slug: "https-formulaire-trop-long-et-incomprehensible-pour-une-adresse-publique-du-lycee-blaise-cendrars",
    originalSlug: "planning-2024",
    title: "Présentation Lycée 2025",
    summary: "Baccalauréat Générale et 2ème édition",
    bodyMarkdown: "#\n\n## [http://example.test](http://example.test)\n\n[En savoir plus ActualitéContinuer](http://example.test)\n\n[Voir plus](http://example.test)\n\n![image](http://example.test/a.png)",
    disposition: "a_confirmer",
    sourceModifiedAt: "2025-01-01T00:00:00Z",
  }]);
  const codes = new Set(review.items[0].issues.map((issue) => issue.code));
  for (const expected of [
    "conversion.empty_heading",
    "conversion.concatenated_call_to_action",
    "conversion.raw_url_heading",
    "language.ordinal_typography",
    "language.baccalaureat_agreement",
    "accessibility.generic_link_label",
    "accessibility.generic_image_alt",
    "links.insecure_http",
    "language.title_wording",
    "routing.opaque_slug",
    "freshness.slug_title_year_mismatch",
    "decision.current_facts_required",
  ]) assert.equal(codes.has(expected), true, expected);
});

test("reviews every inventoried content and keeps evidence bounded", () => {
  const review = reviewLegacyEditorialQuality(inventory.contents);
  assert.equal(review.contentsReviewed, 28);
  assert.equal(review.items.length, 28);
  assert.equal(new Set(review.items.map((item) => item.slug)).size, 28);
  assert.equal(review.items.every((item) => item.issues.some((issue) => issue.field === "decision")), true);
  assert.equal(review.items.flatMap((item) => item.issues).every((issue) => issue.evidence.length <= 146), true);
  assert.equal(review.items.some((item) => item.issues.some((issue) => issue.code === "conversion.concatenated_call_to_action")), true);
  assert.equal(review.items.some((item) => item.issues.some((issue) => issue.code === "routing.opaque_slug")), true);
});

test("keeps the committed report synchronized with the inventory", () => {
  const review = reviewLegacyEditorialQuality(inventory.contents);
  assert.equal(
    committedReport,
    renderLegacyEditorialReviewMarkdown(review, inventory.generatedAt)
  );
  assert.match(committedReport, /Contenus analysés : \*\*28\*\*/);
  assert.match(committedReport, /trois médias refusés/);
  assert.doesNotMatch(committedReport, /<script|javascript:/i);
});

test("rejects duplicate slugs and oversized inventories", () => {
  const base = {
    slug: "page",
    originalSlug: "page",
    title: "Page",
    summary: "Résumé",
    bodyMarkdown: "Contenu",
    disposition: "durable",
    sourceModifiedAt: null,
  };
  assert.throws(() => reviewLegacyEditorialQuality([base, base]), /dupliqué/);
  assert.throws(
    () => reviewLegacyEditorialQuality(Array.from({ length: 101 }, (_, index) => ({ ...base, slug: `page-${index}` }))),
    /100/
  );
  assert.throws(
    () => reviewLegacyEditorialQuality([{ ...base, disposition: "public", hidden: true }]),
    /inattendus/
  );
  assert.throws(
    () => renderLegacyEditorialReviewMarkdown(
      reviewLegacyEditorialQuality([base]),
      "2026-08-28"
    ),
    /Date/
  );
});
