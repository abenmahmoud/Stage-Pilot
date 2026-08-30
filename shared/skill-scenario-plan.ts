import { detectForbiddenSupportSecret } from "./support-secret-policy.js";

export type SkillScenarioPlanItem = {
  testCaseKey: string;
  kind: "positive" | "ambiguous" | "forbidden";
  scenario: string;
  expected: string;
};

const MAX_MARKDOWN_LENGTH = 100_000;
const MAX_SCENARIOS = 100;
const SECTION_KIND = new Map<string, SkillScenarioPlanItem["kind"]>([
  ["### Cas positifs", "positive"],
  ["### Cas ambigus", "ambiguous"],
  ["### Cas interdits", "forbidden"],
]);

export function parseSkillScenarioPlan(markdown: string): SkillScenarioPlanItem[] {
  if (typeof markdown !== "string" || markdown.length === 0 || markdown.length > MAX_MARKDOWN_LENGTH) {
    throw new Error("Le document de compétence est vide ou trop volumineux");
  }
  if (detectForbiddenSupportSecret(markdown)) {
    throw new Error("Le document contient un mot de passe, un code ou une clé secrète");
  }

  const scenarios: SkillScenarioPlanItem[] = [];
  let currentKind: SkillScenarioPlanItem["kind"] | null = null;
  for (const rawLine of markdown.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (SECTION_KIND.has(line)) {
      currentKind = SECTION_KIND.get(line) ?? null;
      continue;
    }
    if (/^#{1,3}\s/u.test(line)) {
      currentKind = null;
      continue;
    }
    if (!currentKind || !line.startsWith("- `")) continue;
    const match = line.match(/^- `([A-Z]+-\d{2})`\s*:\s*(.+?)\s+Attendu\s*:\s*(.+)$/u);
    if (!match) throw new Error(`Scénario mal formé : ${line.slice(0, 120)}`);
    const prefix = currentKind === "positive" ? "POS" : currentKind === "ambiguous" ? "AMB" : "INT";
    if (!match[1].startsWith(`${prefix}-`)) {
      throw new Error(`Le scénario ${match[1]} n’appartient pas à la bonne section`);
    }
    const scenario = match[2].trim();
    const expected = match[3].trim();
    if (scenario.length < 10 || scenario.length > 1_500 || expected.length < 10 || expected.length > 1_500) {
      throw new Error(`Le scénario ${match[1]} dépasse les limites autorisées`);
    }
    scenarios.push({
      testCaseKey: match[1].toLocaleLowerCase("fr-FR"),
      kind: currentKind,
      scenario,
      expected,
    });
    if (scenarios.length > MAX_SCENARIOS) throw new Error("Le document contient trop de scénarios");
  }

  if (new Set(scenarios.map((scenario) => scenario.testCaseKey)).size !== scenarios.length) {
    throw new Error("Le document contient des identifiants de scénario en double");
  }
  const required: Record<SkillScenarioPlanItem["kind"], number> = {
    positive: 5,
    ambiguous: 3,
    forbidden: 3,
  };
  for (const [kind, minimum] of Object.entries(required)) {
    if (scenarios.filter((scenario) => scenario.kind === kind).length < minimum) {
      throw new Error("Le document doit contenir 5 cas positifs, 3 ambigus et 3 interdits");
    }
  }
  return scenarios;
}
