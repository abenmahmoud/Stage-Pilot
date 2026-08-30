import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const inventory = JSON.parse(
  await readFile(new URL("../content/legacy-site/inventory.json", import.meta.url), "utf8")
);
const report = await readFile(
  new URL("../content/legacy-site/coverage-baseline.md", import.meta.url),
  "utf8"
);
const operationEvidence = await readFile(
  new URL("../docs/operations/LEGACY_IMPORT_PREVIEW_2026-08-28.md", import.meta.url),
  "utf8"
);
const vercel = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8"));

function reportRows() {
  return report
    .split(/\r?\n/u)
    .filter((line) => /^\| `[^`]+` \|/u.test(line))
    .map((line) => {
      const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
      return { slug: cells[0].slice(1, -1), cells, line };
    });
}

test("couvre chaque contenu inventorié exactement une fois", () => {
  const rows = reportRows();
  assert.equal(inventory.contents.length, 28);
  assert.equal(rows.length, inventory.contents.length);
  assert.deepEqual(
    rows.map((row) => row.slug).sort(),
    inventory.contents.map((item) => item.slug).sort()
  );
  assert.equal(new Set(rows.map((row) => row.slug)).size, rows.length);
});

test("conserve une destination versionnée pour chaque ancienne adresse", () => {
  const rows = new Map(reportRows().map((row) => [row.slug, row]));
  const redirects = new Map(vercel.redirects.map((redirect) => [redirect.source, redirect.destination]));

  for (const item of inventory.contents) {
    const row = rows.get(item.slug);
    assert.ok(row, `Ligne absente pour ${item.slug}`);
    assert.equal(row.cells[3], "Oui", `${item.slug} doit rester signalé comme brouillon`);
    if (new URL(item.sourceUrl).pathname === "/") {
      assert.match(row.cells[4], /`\/prototype`/u);
      assert.match(row.cells[4], /`\/site\/accueil-historique`/u);
      continue;
    }
    const source = new URL(item.sourceUrl).pathname.replace(/\/+$/u, "");
    const target = `/site/${item.slug}`;
    assert.equal(redirects.get(source), target, `Redirection absente pour ${source}`);
    assert.match(row.cells[4], new RegExp(`\`${target.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}\``));
  }
});

test("garde les décisions éditoriales et le média bloquant visibles", () => {
  const dispositions = inventory.contents.reduce((counts, item) => {
    counts[item.disposition] = (counts[item.disposition] ?? 0) + 1;
    return counts;
  }, {});
  assert.deepEqual(dispositions, { a_confirmer: 6, archive: 7, durable: 15 });

  const rows = new Map(reportRows().map((row) => [row.slug, row]));
  assert.match(rows.get("london-trip-review").cells[5], /Bloqué/u);
  assert.match(rows.get("london-trip-review").cells[5], /49,8 Mo/u);
  for (const [slug, row] of rows) {
    if (slug !== "london-trip-review") assert.doesNotMatch(row.cells[5], /Bloqué/u);
    assert.match(row.cells[6], /(requise|requis|confirmer|décider|Archiver)/u);
  }
});

test("ne transforme pas la preuve technique en validation ou publication", () => {
  assert.match(operationEvidence, /28 \| 28 \| Brouillons à vérifier/u);
  assert.match(operationEvidence, /`?0`? contenu importé publié/u);
  assert.match(operationEvidence, /78 \| Stockage privé/u);
  assert.match(report, /T018 reste ouverte/u);
  assert.match(report, /ne peut pas être déduite de cette matrice/u);
  assert.doesNotMatch(report, /T018 est terminée/u);
});
