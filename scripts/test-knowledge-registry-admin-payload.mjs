import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  KNOWLEDGE_REGISTRY_PAYLOAD_LIMITS,
  parseKnowledgeRegistryPayload,
  projectKnowledgeRegistryPayload,
  projectRegistryAudit,
  projectRegistryEvaluation,
  projectRegistryLink,
  projectRegistrySkill,
  projectRegistrySource,
  projectRegistryVersion,
} from "../shared/knowledge-registry-admin-payload.ts";

const SOURCE_ID = "11111111-1111-4111-8111-111111111111";
const SKILL_ID = "22222222-2222-4222-8222-222222222222";
const VERSION_ID = "33333333-3333-4333-8333-333333333333";
const AUDIT_ID = "44444444-4444-4444-8444-444444444444";
const ACTOR_ID = "55555555-5555-4555-8555-555555555555";
const INSTITUTION_ID = "66666666-6666-4666-8666-666666666666";
const NOW = "2026-09-01T05:00:00.000Z";

function source(overrides = {}) {
  return {
    id: SOURCE_ID,
    title: "Procédure ENT fictive",
    uri: "private://knowledge-documents/fictif",
    classification: "internal",
    expiresAt: "2027-02-01T12:00:00.000Z",
    status: "published",
    updatedAt: NOW,
    ...overrides,
  };
}

function skill(overrides = {}) {
  return {
    id: SKILL_ID,
    skillKey: "aide-ent-fictive",
    name: "Aide ENT fictive",
    domain: "Assistance du lycée",
    activeVersionId: VERSION_ID,
    enabled: true,
    ...overrides,
  };
}

function version(overrides = {}) {
  return {
    id: VERSION_ID,
    skillId: SKILL_ID,
    version: "1.0.0",
    status: "published",
    definition: {
      instructions: "Répondre uniquement depuis la procédure fictive validée.\nCréer un dossier en cas de doute.",
      allowedTools: ["support.create_request"],
    },
    dataClassification: "internal",
    reviewDueAt: "2027-02-01T12:00:00.000Z",
    createdAt: NOW,
    ...overrides,
  };
}

function evaluation(overrides = {}) {
  return {
    skillVersionId: VERSION_ID,
    testCaseKey: "aide-ent-positive-01",
    kind: "positive",
    result: "pass",
    evidence: {
      runner: "manual",
      fixture: "fictitious",
      scenario: "Un élève fictif demande où retrouver son accès ENT.",
      expected: "L'agent explique la procédure fictive sans donner de secret.",
      observed: "La réponse observée respecte la source et propose un suivi.",
    },
    runAt: NOW,
    ...overrides,
  };
}

function registry(overrides = {}) {
  return {
    sources: [source()],
    skills: [skill()],
    versions: [version()],
    links: [{ skillVersionId: VERSION_ID, sourceId: SOURCE_ID }],
    evaluations: [evaluation()],
    audit: [{ id: AUDIT_ID, resourceType: "version", action: "publish", createdAt: NOW }],
    ...overrides,
  };
}

test("accepts one exact coherent registry", () => {
  const payload = registry();
  assert.deepEqual(parseKnowledgeRegistryPayload(payload), payload);
});

test("rejects internal leaks, duplicates and broken relations", () => {
  for (const payload of [
    { ...registry(), hidden: true },
    registry({ sources: [{ ...source(), ownerUserId: ACTOR_ID }] }),
    registry({ versions: [{ ...version(), definition: { ...version().definition, ownerUserId: ACTOR_ID } }] }),
    registry({ audit: [{ ...registry().audit[0], actorId: ACTOR_ID }] }),
    registry({ skills: [{ ...skill(), enabled: false }] }),
    registry({ skills: [{ ...skill(), activeVersionId: SOURCE_ID }] }),
    registry({ versions: [{ ...version(), skillId: SOURCE_ID }] }),
    registry({ links: [{ skillVersionId: VERSION_ID, sourceId: ACTOR_ID }] }),
    registry({ evaluations: [{ ...evaluation(), skillVersionId: ACTOR_ID }] }),
    registry({ evaluations: [evaluation(), evaluation()] }),
  ]) assert.equal(parseKnowledgeRegistryPayload(payload), null);
});

test("rejects malformed instructions, tools, evidence and ordering", () => {
  const later = source({ id: ACTOR_ID, updatedAt: "2026-09-01T06:00:00.000Z" });
  for (const payload of [
    registry({ sources: [source(), later] }),
    registry({ versions: [{ ...version(), definition: { ...version().definition, allowedTools: ["shell"] } }] }),
    registry({ versions: [{ ...version(), definition: { ...version().definition, instructions: "trop court" } }] }),
    registry({ evaluations: [{ ...evaluation(), evidence: { ...evaluation().evidence, fixture: "real" } }] }),
    registry({ evaluations: [{ ...evaluation(), runAt: "01/09/2026" }] }),
  ]) assert.equal(parseKnowledgeRegistryPayload(payload), null);
});

test("server projections strip institution, owners, hashes and audit summaries", () => {
  const projectedSource = projectRegistrySource({
    ...source(),
    institutionId: INSTITUTION_ID,
    sourceType: "procedure",
    ownerUserId: ACTOR_ID,
    serviceCodes: ["administration"],
    checksum: "a".repeat(64),
  });
  assert.deepEqual(projectedSource, source());
  const projectedSkill = projectRegistrySkill({ ...skill(), institutionId: INSTITUTION_ID });
  assert.deepEqual(projectedSkill, skill());
  const projectedVersion = projectRegistryVersion({
    ...version(),
    institutionId: INSTITUTION_ID,
    definition: { ...version().definition, ownerUserId: ACTOR_ID },
    contentHash: "b".repeat(64),
    createdBy: ACTOR_ID,
    approvedBy: ACTOR_ID,
  });
  assert.deepEqual(projectedVersion, version());
  assert.deepEqual(projectRegistryLink({
    skillVersionId: VERSION_ID,
    sourceId: SOURCE_ID,
    institutionId: INSTITUTION_ID,
    required: true,
  }), registry().links[0]);
  assert.deepEqual(projectRegistryEvaluation({
    ...evaluation(),
    id: ACTOR_ID,
    institutionId: INSTITUTION_ID,
    scores: { internal: true },
  }), evaluation());
  assert.deepEqual(projectRegistryAudit({
    ...registry().audit[0],
    institutionId: INSTITUTION_ID,
    resourceId: VERSION_ID,
    actorId: ACTOR_ID,
    summary: { private: true },
  }), registry().audit[0]);
});

test("server rejects an oversized registry before returning it", () => {
  const tooManySources = Array.from(
    { length: KNOWLEDGE_REGISTRY_PAYLOAD_LIMITS.sources + 1 },
    () => source(),
  );
  assert.throws(
    () => projectKnowledgeRegistryPayload({ ...registry(), sources: tooManySources }),
    /exceeds its payload limit/,
  );
});

test("projects and revalidates the complete server registry", () => {
  const projected = projectKnowledgeRegistryPayload({
    sources: [{ ...source(), ownerUserId: ACTOR_ID }],
    skills: [{ ...skill(), institutionId: INSTITUTION_ID }],
    versions: [{ ...version(), definition: { ...version().definition, ownerUserId: ACTOR_ID } }],
    links: [{ ...registry().links[0], required: true }],
    evaluations: [{ ...evaluation(), scores: { assertions: 1 } }],
    audit: [{ ...registry().audit[0], summary: { secret: true } }],
  });
  assert.deepEqual(parseKnowledgeRegistryPayload(projected), registry());
});

test("validates the registry before replacing browser state", async () => {
  const page = await readFile(new URL("../src/pages/admin/KnowledgeRegistryPage.tsx", import.meta.url), "utf8");
  const route = await readFile(new URL("../api/knowledge/admin/index.ts", import.meta.url), "utf8");
  const read = page.indexOf('apiFetch<unknown>("knowledge/admin")');
  const validation = page.indexOf("parseKnowledgeRegistryPayload(nextRegistry)", read);
  const state = page.indexOf("setRegistry(parsedRegistry)", validation);
  assert.ok(read >= 0 && validation > read && state > validation);
  assert.match(route, /projectKnowledgeRegistryPayload/);
  for (const key of ["sources", "skills", "versions", "links", "evaluations", "audit"]) {
    assert.match(route, new RegExp(`limit\\(KNOWLEDGE_REGISTRY_PAYLOAD_LIMITS\\.${key}(?: \\+ 1)?\\)`));
  }
  assert.doesNotMatch(page, /apiFetch<Registry>\("knowledge\/admin"\)/);
});
