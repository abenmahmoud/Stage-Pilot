import { readFile, writeFile } from "node:fs/promises";
import {
  renderLegacyEditorialReviewMarkdown,
  reviewLegacyEditorialQuality,
} from "../shared/legacy-editorial-quality.ts";

const inventoryUrl = new URL("../content/legacy-site/inventory.json", import.meta.url);
const reportUrl = new URL("../content/legacy-site/editorial-review.md", import.meta.url);
const inventory = JSON.parse(await readFile(inventoryUrl, "utf8"));
const review = reviewLegacyEditorialQuality(inventory.contents);
const report = renderLegacyEditorialReviewMarkdown(review, inventory.generatedAt);

await writeFile(reportUrl, report, "utf8");
console.log(JSON.stringify({
  report: "content/legacy-site/editorial-review.md",
  contentsReviewed: review.contentsReviewed,
  issueCounts: review.issueCounts,
}));
