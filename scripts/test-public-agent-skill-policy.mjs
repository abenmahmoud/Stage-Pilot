import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  formatPublicAgentSkillContext,
  selectAuthorizedAgentSkillContext,
  selectPublicAgentSkillContext,
} from "../shared/public-agent-skill-policy.ts";

const now = "2026-08-28T08:00:00.000Z";
const source = {
  id: "source-public",
  institutionId: "school-a",
  title: "Procédure ENT de rentrée",
  status: "published",
  classification: "public",
  serviceCodes: [],
  validFrom: "2026-08-01T00:00:00.000Z",
  expiresAt: "2026-09-30T23:59:59.000Z",
  required: true,
};
const candidate = {
  institutionId: "school-a",
  skillKey: "assistance-ent",
  name: "Assistance ENT",
  domain: "Accès numérique",
  enabled: true,
  activeVersionId: "version-1",
  versionId: "version-1",
  version: "1.0.0",
  versionStatus: "published",
  dataClassification: "public",
  publishedAt: "2026-08-27T10:00:00.000Z",
  reviewDueAt: "2026-09-30T23:59:59.000Z",
  instructions: "Pour un blocage ENT, vérifier le navigateur puis préparer un dossier si le problème persiste.",
  allowedTools: ["knowledge.search_published"],
  sources: [source],
};

function select(overrides = {}, query = "Mon accès ENT ne fonctionne plus") {
  return selectPublicAgentSkillContext({
    candidates: [{ ...candidate, ...overrides }],
    institutionId: "school-a",
    query,
    now,
  });
}

test("selects a relevant published public skill with a current public source", () => {
  const selected = select();
  assert.equal(selected.length, 1);
  assert.equal(selected[0].skillKey, "assistance-ent");
  assert.deepEqual(selected[0].sources, [{
    id: "source-public",
    title: "Procédure ENT de rentrée",
    expiresAt: "2026-09-30T23:59:59.000Z",
  }]);
});

test("matches a password request to the validated ENT skill", () => {
  const selected = select({}, "J'ai oublié mon mot de passe EduConnect");
  assert.equal(selected.length, 1);
  assert.equal(selected[0].skillKey, "assistance-ent");
});

test("does not confuse an unrelated code with a digital access procedure", () => {
  assert.deepEqual(select({}, "Je veux modifier mon code postal"), []);
});

test("rejects disabled, inactive, unpublished and overdue skills", () => {
  assert.deepEqual(select({ enabled: false }), []);
  assert.deepEqual(select({ activeVersionId: "another-version" }), []);
  assert.deepEqual(select({ versionStatus: "review" }), []);
  assert.deepEqual(select({ reviewDueAt: "2026-08-28T07:59:59.000Z" }), []);
});

test("rejects private, expired and cross-institution required sources", () => {
  assert.deepEqual(select({ sources: [{ ...source, classification: "internal" }] }), []);
  assert.deepEqual(select({ sources: [{ ...source, status: "expired" }] }), []);
  assert.deepEqual(select({ sources: [{ ...source, institutionId: "school-b" }] }), []);
});

test("ignores an expired optional source when a required source remains valid", () => {
  const selected = select({
    sources: [source, { ...source, id: "optional", status: "expired", required: false }],
  });
  assert.equal(selected.length, 1);
  assert.equal(selected[0].sources.length, 1);
});

test("returns no context for an unrelated request or oversized instructions", () => {
  assert.deepEqual(select({}, "Je voudrais connaître le menu de la cantine"), []);
  assert.deepEqual(select({ instructions: "x".repeat(3_001) }), []);
});

test("formats only the bounded public context and declares tools unavailable", () => {
  const context = formatPublicAgentSkillContext(select());
  assert.match(context, /<registre_autorise_valide>/);
  assert.match(context, /Procédure ENT de rentrée/);
  assert.match(context, /non exécutables dans cette conversation/);
  assert.doesNotMatch(context, /source-public|checksum|https?:\/\//);
});

test("loads the registry dynamically and falls back when it is unavailable", () => {
  const sourceCode = readFileSync(new URL("../api/_shared/support-agent.ts", import.meta.url), "utf8");
  const dynamicImport = sourceCode.indexOf('await import("./public-knowledge-context.js")');
  const modelRequest = sourceCode.indexOf('fetch("https://api.openai.com/v1/responses"');
  assert.ok(dynamicImport >= 0 && modelRequest > dynamicImport);
  assert.match(
    sourceCode,
    /publicKnowledgeContext = \{ instructions: "", versions: \[\], sources: \[\] \};/
  );
});

test("never selects private source locators or ownership fields for the model", () => {
  const loader = readFileSync(new URL("../api/_shared/public-knowledge-context.ts", import.meta.url), "utf8");
  assert.doesNotMatch(loader, /uri:\s*knowledgeSources\.uri/);
  assert.doesNotMatch(loader, /checksum:\s*knowledgeSources\.checksum/);
  assert.doesNotMatch(loader, /ownerUserId:\s*knowledgeSources\.ownerUserId/);
});

test("keeps usage audit metadata free of messages and contact data", () => {
  const loader = readFileSync(new URL("../api/_shared/public-knowledge-context.ts", import.meta.url), "utf8");
  const auditMigration = readFileSync(
    new URL("../supabase/migrations/20260829103209_allow_public_knowledge_usage_audit.sql", import.meta.url),
    "utf8"
  );
  const auditSource = loader.slice(loader.indexOf("export async function recordPublicKnowledgeUsage"));
  assert.match(auditSource, /action: "consult_public"/);
  assert.match(auditSource, /resourceType: "source"/);
  assert.match(auditSource, /actorId: null/);
  assert.doesNotMatch(auditSource, /\b(query|reply|email|telephone|uri|checksum)\b/i);
  assert.match(auditMigration, /'consult_public'/);
  assert.match(auditMigration, /never stores message content/i);
});

test("allows an internal skill only for persisted staff in the source service", () => {
  const internalSource = {
    ...source,
    classification: "internal",
    serviceCodes: ["numerique"],
  };
  const internalSkill = {
    ...candidate,
    dataClassification: "internal",
    sources: [internalSource],
  };
  const base = {
    candidates: [internalSkill],
    query: "Mon accès ENT est bloqué",
    now,
  };

  assert.equal(selectAuthorizedAgentSkillContext({
    ...base,
    actor: { level: "agent", institutionId: "school-a", serviceCodes: ["numerique"] },
  }).length, 1);
  assert.deepEqual(selectAuthorizedAgentSkillContext({
    ...base,
    actor: { level: "agent", institutionId: "school-a", serviceCodes: ["vie_scolaire"] },
  }), []);
  assert.deepEqual(selectAuthorizedAgentSkillContext({
    ...base,
    actor: { level: "school_identity", institutionId: "school-a", serviceCodes: [] },
  }), []);
});

test("never injects personal or sensitive procedures directly into the prompt", () => {
  for (const classification of ["personal", "sensitive"]) {
    assert.deepEqual(selectAuthorizedAgentSkillContext({
      candidates: [{
        ...candidate,
        dataClassification: classification,
        sources: [{ ...source, classification }],
      }],
      actor: { level: "admin", institutionId: "school-a", serviceCodes: ["direction"] },
      query: "Mon accès ENT est bloqué",
      now,
    }), []);
  }
});
