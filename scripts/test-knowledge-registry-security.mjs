import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  parseAgentSkillDraftInput,
  parseAgentSkillEvaluationInput,
  parseKnowledgeSourceInput,
} from "../shared/knowledge-registry-input.ts";

const migrationPath = new URL(
  "../supabase/migrations/20260827221500_create_agent_skill_registry.sql",
  import.meta.url
);
const helperPath = new URL("../api/_shared/knowledge-registry.ts", import.meta.url);
const parserPath = new URL("../shared/knowledge-registry-input.ts", import.meta.url);
const actionPath = new URL(
  "../api/knowledge/admin/versions/[id]/action.ts",
  import.meta.url
);
const evaluationRoutePath = new URL(
  "../api/knowledge/admin/versions/[id]/evaluations.ts",
  import.meta.url
);

test("keeps every knowledge registry table server-only", async () => {
  const sql = await readFile(migrationPath, "utf8");
  const tables = [
    "knowledge_sources",
    "agent_skills",
    "agent_skill_versions",
    "skill_source_links",
    "agent_evaluations",
    "agent_skill_audit",
  ];
  for (const table of tables) {
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
    assert.match(sql, new RegExp(`alter table public\\.${table} force row level security`, "i"));
  }
  assert.match(sql, /revoke all on table[\s\S]+from public, anon, authenticated/i);
  assert.match(sql, /grant select, insert, update, delete on table[\s\S]+to service_role/i);
});

test("keeps server imports compatible with the Vercel function bundle", async () => {
  const parser = await readFile(parserPath, "utf8");
  assert.match(parser, /from "\.\/support-agent-access\.js"/);
  assert.match(parser, /from "\.\/skill-registry-policy\.js"/);
  assert.doesNotMatch(parser, /from "[^\"]+\.ts"/);
});

test("enforces institution consistency and immutable version references", async () => {
  const sql = await readFile(migrationPath, "utf8");
  assert.match(sql, /foreign key \(skill_id, institution_id\)[\s\S]+agent_skills\(id, institution_id\)/i);
  assert.match(sql, /foreign key \(skill_version_id, institution_id\)[\s\S]+agent_skill_versions\(id, institution_id\)/i);
  assert.match(sql, /foreign key \(source_id, institution_id\)[\s\S]+knowledge_sources\(id, institution_id\)/i);
  assert.match(sql, /agent_skills_active_version_fk/i);
  assert.match(sql, /foreign key \(active_version_id, id, institution_id\)[\s\S]+agent_skill_versions\(id, skill_id, institution_id\)/i);
  assert.match(sql, /unique \(skill_id, version\)/i);
  assert.match(sql, /'create_version'/i);
});

test("requires persisted direction access and live AAL2 for publication", async () => {
  const [helper, action, evaluationRoute] = await Promise.all([
    readFile(helperPath, "utf8"),
    readFile(actionPath, "utf8"),
    readFile(evaluationRoutePath, "utf8"),
  ]);
  assert.match(helper, /requireSupportAgent\(req\)/);
  assert.match(helper, /access\.canViewAll/);
  assert.match(helper, /if \(options\.publish\) await requireAal2\(req\)/);
  assert.match(action, /validateSkillForPublication/);
  assert.match(action, /selectActiveSkillVersion/);
  assert.match(action, /evaluationProtocol: "evidence_required"/);
  assert.match(action, /delete\(agentEvaluations\)/);
  assert.match(evaluationRoute, /requireKnowledgeManager\(req, \{ publish: true \}\)/);
  assert.match(evaluationRoute, /version\.status !== "review"/);
  assert.match(evaluationRoute, /runAt = new Date\(\)/);
  assert.match(evaluationRoute, /evaluation_recorded/);
});

test("accepts a bounded source and a complete skill draft", () => {
  const source = parseKnowledgeSourceInput({
    title: "Procédure fictive",
    sourceType: "procedure",
    uri: "private://procedures/fictive-v1",
    classification: "internal",
    serviceCodes: ["referent_numerique"],
    validFrom: "2026-08-01T00:00:00.000Z",
    expiresAt: "2099-08-01T00:00:00.000Z",
    checksum: "a".repeat(64),
  });
  assert.deepEqual(source.serviceCodes, ["referent_numerique"]);

  const skill = parseAgentSkillDraftInput({
    skillKey: "procedure-fictive",
    name: "Procédure fictive",
    domain: "Tests",
    version: "1.0.0",
    dataClassification: "internal",
    instructions: "Utiliser uniquement la procédure fictive validée pour répondre.",
    allowedTools: ["support.create_request"],
    sourceIds: ["123e4567-e89b-42d3-a456-426614174000"],
    reviewDueAt: "2099-08-01T00:00:00.000Z",
  });
  assert.equal(skill.version, "1.0.0");
  assert.equal("evaluations" in skill, false);

  const evaluation = parseAgentSkillEvaluationInput({
    testCaseKey: "fictive-positive-01",
    kind: "positive",
    result: "pass",
    confirmation: "TEST_EXECUTE",
    evidence: {
      runner: "manual",
      fixture: "fictitious",
      scenario: "Question fictive posée à la compétence en validation.",
      expected: "Réponse bornée conforme à la procédure fictive.",
      observed: "La réponse observée reste conforme à la procédure fictive.",
    },
  });
  assert.equal(evaluation.evidence.fixture, "fictitious");
});

test("rejects declared draft results, unconfirmed runs and secrets in evidence", () => {
  const draft = {
    skillKey: "skill-fictive",
    name: "Skill fictif",
    domain: "Tests",
    version: "1.0.0",
    dataClassification: "internal",
    instructions: "Instructions fictives suffisamment longues pour le contrôle.",
    allowedTools: ["support.create_request"],
    sourceIds: [],
    reviewDueAt: "2099-08-01T00:00:00.000Z",
  };
  assert.throws(
    () => parseAgentSkillDraftInput({ ...draft, evaluations: [{ result: "pass" }] }),
    /après l’envoi/
  );
  const evaluation = {
    testCaseKey: "fictive-interdit-01",
    kind: "forbidden",
    result: "pass",
    confirmation: "TEST_EXECUTE",
    evidence: {
      runner: "manual",
      fixture: "fictitious",
      scenario: "Tentative fictive de demander une donnée interdite.",
      expected: "Refus sans exposition d’une donnée personnelle.",
      observed: "Refus observé sans exposition d’une donnée personnelle.",
    },
  };
  assert.throws(
    () => parseAgentSkillEvaluationInput({ ...evaluation, confirmation: "" }),
    /réellement été exécuté/
  );
  assert.throws(
    () => parseAgentSkillEvaluationInput({
      ...evaluation,
      evidence: { ...evaluation.evidence, observed: "mot de passe: SuperSecret93" },
    }),
    /clé secrète/
  );
});

test("rejects misleading public scope, fake checksums and unsafe tools", () => {
  assert.throws(() => parseKnowledgeSourceInput({
    title: "Source publique",
    sourceType: "official_url",
    uri: "https://example.test/source",
    classification: "public",
    serviceCodes: ["direction"],
    validFrom: "2026-08-01T00:00:00.000Z",
    expiresAt: "2099-08-01T00:00:00.000Z",
    checksum: "a".repeat(64),
  }), /publique/);
  assert.throws(() => parseKnowledgeSourceInput({
    title: "Source interne",
    sourceType: "procedure",
    uri: "private://source",
    classification: "internal",
    serviceCodes: [],
    validFrom: "2026-08-01T00:00:00.000Z",
    checksum: "invalide",
  }), /SHA-256/);
  assert.throws(() => parseAgentSkillDraftInput({
    skillKey: "skill-fictive",
    name: "Skill fictif",
    domain: "Tests",
    version: "1.0.0",
    dataClassification: "internal",
    instructions: "Instructions fictives suffisamment longues pour le contrôle.",
    allowedTools: ["shell"],
    sourceIds: [],
    reviewDueAt: "2099-08-01T00:00:00.000Z",
    evaluations: [],
  }), /outil/);
});
