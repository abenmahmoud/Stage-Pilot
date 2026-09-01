import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  parseKnowledgeRegistryCreationPayload,
  parseKnowledgeRegistryEvaluationMutationPayload,
  parseKnowledgeRegistrySourceActionPayload,
  parseKnowledgeRegistryVersionActionPayload,
  parseKnowledgeRegistryVersionUpdatePayload,
  projectKnowledgeRegistryCreationPayload,
  projectKnowledgeRegistryEvaluationMutationPayload,
  projectKnowledgeRegistrySourceActionPayload,
  projectKnowledgeRegistryVersionActionPayload,
  projectKnowledgeRegistryVersionUpdatePayload,
} from "../shared/knowledge-registry-admin-action-payload.ts";

const SOURCE_ID = "11111111-1111-4111-8111-111111111111";
const SKILL_ID = "22222222-2222-4222-8222-222222222222";
const VERSION_ID = "33333333-3333-4333-8333-333333333333";
const OTHER_ID = "44444444-4444-4444-8444-444444444444";
const ACTOR_ID = "55555555-5555-4555-8555-555555555555";

test("accepts exact creation receipts and strips full database rows", () => {
  const source = projectKnowledgeRegistryCreationPayload({
    resource: "source",
    source: { id: SOURCE_ID, status: "draft", ownerUserId: ACTOR_ID, checksum: "a".repeat(64) },
  });
  assert.deepEqual(source, { resource: "source", sourceId: SOURCE_ID, status: "draft" });
  const skill = projectKnowledgeRegistryCreationPayload({
    resource: "skill",
    skill: { id: SKILL_ID, institutionId: OTHER_ID },
    version: { id: VERSION_ID, status: "draft", createdBy: ACTOR_ID },
  });
  assert.deepEqual(skill, {
    resource: "skill",
    skillId: SKILL_ID,
    versionId: VERSION_ID,
    status: "draft",
  });
  const version = projectKnowledgeRegistryCreationPayload({
    resource: "version",
    skill: { id: SKILL_ID },
    version: { id: VERSION_ID, status: "draft", contentHash: "b".repeat(64) },
  });
  assert.deepEqual(
    parseKnowledgeRegistryCreationPayload(version, { resource: "version", skillId: SKILL_ID }),
    version,
  );
});

test("rejects hidden, substituted and incoherent creation fields", () => {
  for (const value of [
    { resource: "source", sourceId: SOURCE_ID, status: "draft", ownerUserId: ACTOR_ID },
    { resource: "source", sourceId: SOURCE_ID, status: "published" },
    { resource: "skill", skillId: SKILL_ID, versionId: VERSION_ID, status: "review" },
    { resource: "version", skillId: OTHER_ID, versionId: VERSION_ID, status: "draft" },
  ]) {
    const expected = value.resource === "version"
      ? { resource: "version", skillId: SKILL_ID }
      : value.resource === "source"
        ? { resource: "source" }
        : { resource: "skill" };
    assert.equal(parseKnowledgeRegistryCreationPayload(value, expected), null);
  }
});

test("binds a draft update to its exact skill and version", () => {
  const receipt = projectKnowledgeRegistryVersionUpdatePayload(
    { id: SKILL_ID, name: "Interne" },
    { id: VERSION_ID, status: "draft", definition: { ownerUserId: ACTOR_ID } },
  );
  assert.deepEqual(receipt, {
    resource: "version",
    action: "update",
    skillId: SKILL_ID,
    versionId: VERSION_ID,
    status: "draft",
  });
  assert.equal(parseKnowledgeRegistryVersionUpdatePayload(receipt, {
    skillId: SKILL_ID,
    versionId: OTHER_ID,
  }), null);
  assert.equal(parseKnowledgeRegistryVersionUpdatePayload({ ...receipt, actorId: ACTOR_ID }, {
    skillId: SKILL_ID,
    versionId: VERSION_ID,
  }), null);
});

test("enforces the source action and status matrix", () => {
  const published = projectKnowledgeRegistrySourceActionPayload({
    source: { id: SOURCE_ID, status: "published", checksum: "private" },
    action: "publish",
    disabledSkillCount: 0,
  });
  assert.deepEqual(
    parseKnowledgeRegistrySourceActionPayload(published, { sourceId: SOURCE_ID, action: "publish" }),
    published,
  );
  const revoked = projectKnowledgeRegistrySourceActionPayload({
    source: { id: SOURCE_ID, status: "revoked" },
    action: "revoke",
    disabledSkillCount: 12,
  });
  assert.deepEqual(
    parseKnowledgeRegistrySourceActionPayload(revoked, { sourceId: SOURCE_ID, action: "revoke" }),
    revoked,
  );
  for (const value of [
    { ...published, status: "revoked" },
    { ...published, disabledSkillCount: 1 },
    { ...revoked, sourceId: OTHER_ID },
    { ...revoked, disabledSkillCount: 1_000_001 },
  ]) assert.equal(parseKnowledgeRegistrySourceActionPayload(value, {
    sourceId: SOURCE_ID,
    action: value.action,
  }), null);
});

test("enforces every version action, state and active flag", () => {
  const cases = [
    { action: "submit_review", status: "review", active: false },
    { action: "publish", status: "published", active: true },
    { action: "rollback", status: "published", active: true },
    { action: "retire", status: "retired", active: false },
  ];
  for (const entry of cases) {
    const payload = projectKnowledgeRegistryVersionActionPayload({
      skill: {
        id: SKILL_ID,
        enabled: entry.active,
        activeVersionId: entry.active ? VERSION_ID : null,
        institutionId: OTHER_ID,
      },
      version: { id: VERSION_ID, status: entry.status, approvedBy: ACTOR_ID },
      action: entry.action,
    });
    assert.deepEqual(
      parseKnowledgeRegistryVersionActionPayload(payload, { versionId: VERSION_ID, action: entry.action }),
      payload,
    );
    assert.equal(parseKnowledgeRegistryVersionActionPayload({ ...payload, active: !entry.active }, {
      versionId: VERSION_ID,
      action: entry.action,
    }), null);
    assert.equal(parseKnowledgeRegistryVersionActionPayload({ ...payload, actorId: ACTOR_ID }, {
      versionId: VERSION_ID,
      action: entry.action,
    }), null);
  }
});

test("binds an evaluation receipt to the submitted test", () => {
  const row = {
    skillVersionId: VERSION_ID,
    testCaseKey: "aide-ent-positive-01",
    kind: "positive",
    result: "pass",
    runAt: new Date("2026-09-01T05:00:00.000Z"),
    evidence: { scenario: "private" },
    scores: { assertions: 1 },
  };
  const receipt = projectKnowledgeRegistryEvaluationMutationPayload(row);
  const expected = {
    versionId: VERSION_ID,
    testCaseKey: "aide-ent-positive-01",
    kind: "positive",
    result: "pass",
  };
  assert.deepEqual(parseKnowledgeRegistryEvaluationMutationPayload(receipt, expected), receipt);
  assert.equal(parseKnowledgeRegistryEvaluationMutationPayload({ ...receipt, result: "fail" }, expected), null);
  assert.equal(parseKnowledgeRegistryEvaluationMutationPayload({ ...receipt, evidence: row.evidence }, expected), null);
  assert.equal(parseKnowledgeRegistryEvaluationMutationPayload({ ...receipt, runAt: "01/09/2026" }, expected), null);
});

test("all registry mutation routes return only shared projectors", async () => {
  const paths = [
    "../api/knowledge/admin/index.ts",
    "../api/knowledge/admin/sources/[id]/action.ts",
    "../api/knowledge/admin/versions/[id].ts",
    "../api/knowledge/admin/versions/[id]/action.ts",
    "../api/knowledge/admin/versions/[id]/evaluations.ts",
  ];
  const routes = await Promise.all(paths.map((path) => readFile(new URL(path, import.meta.url), "utf8")));
  assert.match(routes[0], /projectKnowledgeRegistryCreationPayload/);
  assert.match(routes[1], /projectKnowledgeRegistrySourceActionPayload/);
  assert.match(routes[2], /projectKnowledgeRegistryVersionUpdatePayload/);
  assert.match(routes[3], /projectKnowledgeRegistryVersionActionPayload/);
  assert.match(routes[4], /projectKnowledgeRegistryEvaluationMutationPayload/);
  for (const route of routes) {
    assert.doesNotMatch(route, /return \{ (?:source|skill|version|evaluation)(?:,| \})/);
  }
});

test("the browser validates each receipt before announcing success", async () => {
  const page = await readFile(new URL("../src/pages/admin/KnowledgeRegistryPage.tsx", import.meta.url), "utf8");
  const cases = [
    ["async function createSource", "parseKnowledgeRegistryCreationPayload(response, { resource: \"source\" })", "Source enregistrée en brouillon"],
    ["async function createSkill", "parseKnowledgeRegistryCreationPayload(response", "Nouvelle version créée en brouillon"],
    ["async function recordEvaluation", "parseKnowledgeRegistryEvaluationMutationPayload(response, expected)", "Test horodaté"],
    ["async function versionAction", "parseKnowledgeRegistryVersionActionPayload(response", "Compétence publiée et activée"],
    ["async function sourceAction", "parseKnowledgeRegistrySourceActionPayload(response", "Source validée"],
  ];
  for (const [startText, validationText, successText] of cases) {
    const start = page.indexOf(startText);
    const validation = page.indexOf(validationText, start);
    const success = page.indexOf(successText, validation);
    assert.ok(start >= 0 && validation > start && success > validation, startText);
  }
  assert.doesNotMatch(page, /await apiFetch\(`?knowledge\/admin[^;]+;\s*setNotice/s);
});
