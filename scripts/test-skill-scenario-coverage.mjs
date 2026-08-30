import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

const skillDirectory = new URL(
  "../specs/002-agent-etablissement-adaptatif/skills/",
  import.meta.url
);

const excludedFiles = new Set(["README.md", "SKILL_TEMPLATE.md"]);
const categoryRules = [
  { heading: "### Cas positifs", prefix: "POS", minimum: 5 },
  { heading: "### Cas ambigus", prefix: "AMB", minimum: 3 },
  { heading: "### Cas interdits", prefix: "INT", minimum: 3 },
];

function sectionLines(content, heading) {
  const lines = content.split(/\r?\n/u);
  const start = lines.findIndex((line) => line.trim() === heading);
  assert.notEqual(start, -1, `section manquante: ${heading}`);

  const nextHeading = lines.findIndex(
    (line, index) => index > start && /^###\s/u.test(line)
  );
  return lines.slice(start + 1, nextHeading === -1 ? lines.length : nextHeading);
}

function testSection(content) {
  const lines = content.split(/\r?\n/u);
  const start = lines.findIndex(
    (line) => line.trim() === "## Tests obligatoires"
  );
  assert.notEqual(start, -1, "section manquante: ## Tests obligatoires");

  const nextHeading = lines.findIndex(
    (line, index) => index > start && /^##\s/u.test(line)
  );
  return lines.slice(start, nextHeading === -1 ? lines.length : nextHeading).join("\n");
}

function scenarioEntries(content, rule) {
  return sectionLines(content, rule.heading)
    .filter((line) => /^-\s/u.test(line))
    .map((line) => {
      const match = line.match(/^- `([A-Z]+-\d{2})` : (.+)$/u);
      assert.ok(match, `${rule.heading}: ligne de scénario mal formée: ${line}`);
      return { id: match[1], description: match[2] };
    });
}

const skillFiles = readdirSync(skillDirectory, { withFileTypes: true })
  .filter(
    (entry) =>
      entry.isFile() &&
      entry.name.endsWith(".md") &&
      !excludedFiles.has(entry.name)
  )
  .map((entry) => entry.name)
  .sort();

test("each pilot skill has a complete observable scenario matrix", async (t) => {
  assert.ok(skillFiles.length > 0, "aucune compétence pilote détectée");

  for (const fileName of skillFiles) {
    await t.test(fileName, () => {
      const content = readFileSync(new URL(fileName, skillDirectory), "utf8");
      const section = testSection(content);
      const allIds = [];

      for (const rule of categoryRules) {
        const entries = scenarioEntries(section, rule);
        assert.ok(
          entries.length >= rule.minimum,
          `${rule.heading}: ${entries.length}/${rule.minimum}`
        );

        for (const entry of entries) {
          assert.ok(
            entry.id.startsWith(`${rule.prefix}-`),
            `${entry.id}: préfixe attendu ${rule.prefix}`
          );
          assert.match(
            entry.description,
            /\bAttendu :\s+\S/u,
            `${entry.id}: comportement attendu manquant`
          );
          allIds.push(entry.id);
        }
      }

      assert.equal(
        new Set(allIds).size,
        allIds.length,
        "identifiants de scénario dupliqués"
      );
    });
  }
});
