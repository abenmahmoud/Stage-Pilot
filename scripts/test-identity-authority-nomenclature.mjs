import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const normativeFiles = [
  "codex-skills/referent-numerique-lycee/references/operating-rules.md",
  "specs/002-agent-etablissement-adaptatif/spec.md",
  "specs/002-agent-etablissement-adaptatif/plan.md",
  "specs/002-agent-etablissement-adaptatif/research.md",
  "specs/002-agent-etablissement-adaptatif/knowledge-registry-persistence.md",
  "specs/002-agent-etablissement-adaptatif/checklists/requirements.md",
];

const skillDirectory = new URL(
  "../specs/002-agent-etablissement-adaptatif/skills/",
  import.meta.url
);
for (const entry of readdirSync(skillDirectory, { withFileTypes: true })) {
  if (entry.isFile() && entry.name.endsWith(".md")) {
    normativeFiles.push(`specs/002-agent-etablissement-adaptatif/skills/${entry.name}`);
  }
}

test("keeps normative documents free from the ambiguous L0-L4 vocabulary", () => {
  for (const file of normativeFiles) {
    const content = readFileSync(new URL(file, root), "utf8");
    assert.doesNotMatch(content, /\bL[0-4]\b|L0-L4/u, file);
  }
});

test("keeps runtime knowledge actors split into identity level and role", () => {
  const registry = readFileSync(
    new URL("../shared/skill-registry-policy.ts", import.meta.url),
    "utf8"
  );
  const resolver = readFileSync(
    new URL("../shared/knowledge-actor-policy.ts", import.meta.url),
    "utf8"
  );
  assert.match(registry, /identityLevel: AgentIdentityLevel/u);
  assert.match(registry, /role: AgentInstitutionRole/u);
  assert.doesNotMatch(registry, /KnowledgeActorLevel|actor\.level/u);
  assert.match(resolver, /authenticatorLevel === "aal2" \? "I4" : "I3"/u);
});

test("keeps schedules on the same canonical identity contract", () => {
  const policy = readFileSync(
    new URL("../shared/schedule-policy.ts", import.meta.url),
    "utf8"
  );
  assert.match(policy, /identityLevel: AgentIdentityLevel/u);
  assert.match(policy, /identityAtLeast\(input\.viewer\.identityLevel, "I3"\)/u);
  assert.doesNotMatch(policy, /school_identity|contact_verified/u);
});
