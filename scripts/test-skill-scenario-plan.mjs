import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  parseSkillScenarioPlan,
  SKILL_SCENARIO_PLAN_MAX_BYTES,
} from "../shared/skill-scenario-plan.ts";

const skillUrl = new URL(
  "../specs/002-agent-etablissement-adaptatif/skills/pc-portable.md",
  import.meta.url
);

test("extracts the complete fictitious test plan from a skill document", async () => {
  const plan = parseSkillScenarioPlan(await readFile(skillUrl, "utf8"));
  assert.equal(plan.length, 11);
  assert.deepEqual(
    Object.fromEntries(["positive", "ambiguous", "forbidden"].map((kind) => [
      kind,
      plan.filter((scenario) => scenario.kind === kind).length,
    ])),
    { positive: 5, ambiguous: 3, forbidden: 3 }
  );
  assert.equal(plan[0].testCaseKey, "pos-01");
  assert.match(plan[0].expected, /arrêt immédiat/u);
});

test("rejects an incomplete plan, a duplicate and a secret", () => {
  const oneCase = "### Cas positifs\n- `POS-01` : Scénario fictif suffisamment décrit. Attendu : Réponse fictive suffisamment décrite.";
  assert.throws(() => parseSkillScenarioPlan(oneCase), /5 cas positifs/);

  const complete = [
    "### Cas positifs",
    ...Array.from({ length: 5 }, (_, index) => `- \`POS-${String(index + 1).padStart(2, "0")}\` : Scénario positif fictif numéro ${index + 1}. Attendu : Résultat positif fictif numéro ${index + 1}.`),
    "### Cas ambigus",
    ...Array.from({ length: 3 }, (_, index) => `- \`AMB-${String(index + 1).padStart(2, "0")}\` : Scénario ambigu fictif numéro ${index + 1}. Attendu : Résultat ambigu fictif numéro ${index + 1}.`),
    "### Cas interdits",
    ...Array.from({ length: 3 }, (_, index) => `- \`INT-${String(index + 1).padStart(2, "0")}\` : Scénario interdit fictif numéro ${index + 1}. Attendu : Résultat interdit fictif numéro ${index + 1}.`),
  ].join("\n");
  assert.throws(
    () => parseSkillScenarioPlan(`${complete}\n- \`INT-03\` : Autre scénario interdit fictif. Attendu : Autre résultat interdit fictif.`),
    /en double/
  );
  assert.throws(
    () => parseSkillScenarioPlan(complete.replace("Résultat positif fictif numéro 1", "mot de passe: SuperSecret93")),
    /clé secrète/
  );
});

test("rejects a case placed under the wrong heading", () => {
  const malformed = "### Cas positifs\n- `INT-01` : Scénario interdit placé au mauvais endroit. Attendu : Refus explicite et sûr de la demande.";
  assert.throws(() => parseSkillScenarioPlan(malformed), /bonne section/);
});

test("keeps the Markdown import local and never pre-validates a result", async () => {
  const page = await readFile(
    new URL("../src/pages/admin/KnowledgeRegistryPage.tsx", import.meta.url),
    "utf8"
  );
  const form = page.slice(
    page.indexOf("function EvaluationForm"),
    page.indexOf("function evaluationDefaults")
  );
  assert.equal(SKILL_SCENARIO_PLAN_MAX_BYTES, 100_000);
  const sizeGuard = form.indexOf("file.size > SKILL_SCENARIO_PLAN_MAX_BYTES");
  const read = form.indexOf("await file.text()");
  assert.notEqual(sizeGuard, -1);
  assert.ok(sizeGuard < read);
  assert.match(form, /parseSkillScenarioPlan\(await file\.text\(\)\)/u);
  assert.match(form, /accept="\.md,text\/markdown,text\/plain"/u);
  assert.match(form, /\.\.\.evaluationDefaults\(item\.testCaseKey\)/u);
  assert.doesNotMatch(form, /apiFetch|uploadKnowledgeDocument|fetch\(/u);
});
