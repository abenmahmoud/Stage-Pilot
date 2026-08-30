import assert from "node:assert/strict";
import test from "node:test";
import {
  authorizeKnowledgeSource,
  selectActiveSkillVersion,
  validateSkillForPublication,
} from "../shared/skill-registry-policy.ts";

const now = "2026-08-27T09:00:00.000Z";
const evaluationNotBefore = "2026-08-27T08:00:00.000Z";
const source = {
  id: "source-fictive-procedure",
  institutionId: "lycee-fictif-1",
  serviceCodes: ["vie_scolaire"],
  status: "published",
  classification: "internal",
  ownerUserId: "responsable-fictif-1",
  validFrom: "2026-08-01T00:00:00.000Z",
  expiresAt: "2026-12-31T23:59:59.000Z",
  checksum: "1234567890abcdef1234567890abcdef",
};
function evaluation(kind, index) {
  return {
    testCaseKey: `${kind}-${index}`,
    kind,
    result: "pass",
    evidence: {
      runner: "deterministic",
      fixture: "fictitious",
      scenario: `Scénario fictif ${kind} numéro ${index}`,
      expected: "Le comportement attendu reste borné et vérifiable.",
      observed: "Le comportement observé correspond exactement à l’attendu.",
    },
    runAt: "2026-08-27T08:30:00.000Z",
  };
}

const evaluations = [
  ...Array.from({ length: 5 }, (_, index) => evaluation("positive", index + 1)),
  ...Array.from({ length: 3 }, (_, index) => evaluation("ambiguous", index + 1)),
  ...Array.from({ length: 3 }, (_, index) => evaluation("forbidden", index + 1)),
];
const candidate = {
  id: "version-fictive-1",
  institutionId: "lycee-fictif-1",
  skillKey: "procedure-fictive",
  version: "0.1.0",
  status: "review",
  ownerUserId: "responsable-fictif-1",
  createdBy: "auteur-fictif-1",
  approvedBy: null,
  dataClassification: "internal",
  sourceIds: [source.id],
  allowedTools: ["knowledge.search_published", "support.create_request"],
  evaluations,
  publishedAt: null,
  reviewDueAt: "2026-11-30T23:59:59.000Z",
};

function validate(candidateOverrides = {}, sourceOverrides = {}) {
  return validateSkillForPublication({
    candidate: { ...candidate, ...candidateOverrides },
    sources: [{ ...source, ...sourceOverrides }],
    now,
    evaluationNotBefore,
  });
}

test("accepts a complete fictitious skill ready for publication", () => {
  assert.deepEqual(validate(), { ok: true, errors: [] });
});

test("rejects placeholder ownership and expired review dates", () => {
  const result = validate({ ownerUserId: "RESPONSABLE_A_NOMMER", reviewDueAt: now });
  assert.equal(result.ok, false);
  assert.equal(result.errors.includes("owner_required"), true);
  assert.equal(result.errors.includes("review_date_invalid"), true);
});

test("requires independent approval for personal or sensitive skills", () => {
  const missing = validate({ dataClassification: "personal" });
  assert.equal(missing.errors.includes("independent_approval_required"), true);

  const selfApproved = validate({
    dataClassification: "sensitive",
    approvedBy: candidate.createdBy,
  });
  assert.equal(selfApproved.errors.includes("independent_approval_required"), true);

  const approved = validate({
    dataClassification: "personal",
    approvedBy: "relecteur-fictif-2",
  });
  assert.equal(approved.errors.includes("independent_approval_required"), false);
});

test("blocks missing, revoked and expired sources", () => {
  const missing = validateSkillForPublication({
    candidate,
    sources: [],
    now,
    evaluationNotBefore,
  });
  assert.equal(missing.errors.includes("source_missing"), true);
  assert.equal(validate({}, { status: "revoked" }).errors.includes("source_unavailable"), true);
  assert.equal(
    validate({}, { expiresAt: "2026-08-26T23:59:59.000Z" }).errors.includes("source_not_current"),
    true
  );
});

test("rejects a source linked from another institution", () => {
  const result = validate({}, { institutionId: "autre-etablissement-fictif" });
  assert.equal(result.errors.includes("source_scope_mismatch"), true);
});

test("requires positive, ambiguous and forbidden tests to pass", () => {
  const incomplete = validate({ evaluations: evaluations.slice(0, 10) });
  assert.equal(incomplete.errors.includes("test_coverage_incomplete"), true);

  const failed = validate({
    evaluations: evaluations.map((entry, index) =>
      index === 2 ? { ...entry, result: "needs_review" } : entry
    ),
  });
  assert.equal(failed.errors.includes("test_failed"), true);
});

test("requires evidence recorded after the version entered review", () => {
  const missingEvidence = validate({
    evaluations: evaluations.map((entry, index) =>
      index === 0 ? { ...entry, evidence: {} } : entry
    ),
  });
  assert.equal(missingEvidence.errors.includes("test_evidence_missing"), true);

  const staleRun = validate({
    evaluations: evaluations.map((entry, index) =>
      index === 0 ? { ...entry, runAt: "2026-08-27T07:59:59.000Z" } : entry
    ),
  });
  assert.equal(staleRun.errors.includes("test_run_invalid"), true);
});

test("rejects malformed tool names before publication", () => {
  const result = validate({ allowedTools: ["https://outil-inconnu.example", "raw_shell"] });
  assert.equal(result.errors.includes("allowed_tool_invalid"), true);
});

test("limits each source to the correct actor level and access path", () => {
  const publicSource = { ...source, classification: "public" };
  const visitor = {
    identityLevel: "I0",
    role: "visitor",
    institutionId: source.institutionId,
    serviceCodes: [],
  };
  assert.deepEqual(
    authorizeKnowledgeSource({ source: publicSource, actor: visitor, purpose: "answer", now }),
    { ok: true }
  );
  assert.deepEqual(
    authorizeKnowledgeSource({
      source,
      actor: { ...visitor, identityLevel: "I3", role: "requester" },
      purpose: "answer",
      now,
    }),
    { ok: false, reason: "access_denied" }
  );
  const personalSource = { ...source, classification: "personal" };
  assert.deepEqual(
    authorizeKnowledgeSource({
      source: personalSource,
      actor: { ...visitor, identityLevel: "I3", role: "student" },
      purpose: "answer",
      now,
    }),
    { ok: false, reason: "tool_required" }
  );
  assert.deepEqual(
    authorizeKnowledgeSource({
      source: personalSource,
      actor: { ...visitor, identityLevel: "I3", role: "student" },
      purpose: "tool",
      now,
    }),
    { ok: true }
  );
});

test("enforces institution and service scope even for staff", () => {
  const agent = {
    identityLevel: "I3",
    role: "agent",
    institutionId: source.institutionId,
    serviceCodes: ["secretariat"],
  };
  assert.deepEqual(
    authorizeKnowledgeSource({ source, actor: agent, purpose: "answer", now }),
    { ok: false, reason: "access_denied" }
  );
  assert.deepEqual(
    authorizeKnowledgeSource({
      source,
      actor: { ...agent, serviceCodes: ["vie_scolaire"] },
      purpose: "answer",
      now,
    }),
    { ok: true }
  );
  assert.deepEqual(
    authorizeKnowledgeSource({
      source,
      actor: { ...agent, institutionId: "autre-etablissement-fictif", serviceCodes: ["vie_scolaire"] },
      purpose: "answer",
      now,
    }),
    { ok: false, reason: "access_denied" }
  );
});

test("requires I4 and an authorized role for sensitive tool access", () => {
  const sensitiveSource = { ...source, classification: "sensitive" };
  const baseActor = {
    identityLevel: "I3",
    role: "service_manager",
    institutionId: source.institutionId,
    serviceCodes: ["vie_scolaire"],
  };
  assert.deepEqual(
    authorizeKnowledgeSource({
      source: sensitiveSource,
      actor: baseActor,
      purpose: "tool",
      now,
    }),
    { ok: false, reason: "access_denied" }
  );
  assert.deepEqual(
    authorizeKnowledgeSource({
      source: sensitiveSource,
      actor: { ...baseActor, identityLevel: "I4" },
      purpose: "tool",
      now,
    }),
    { ok: true }
  );
  assert.deepEqual(
    authorizeKnowledgeSource({
      source: sensitiveSource,
      actor: { ...baseActor, identityLevel: "I4", role: "requester" },
      purpose: "tool",
      now,
    }),
    { ok: false, reason: "access_denied" }
  );
});

test("selects the latest current published version and supports rollback", () => {
  const oldVersion = {
    ...candidate,
    id: "version-publiee-1",
    status: "published",
    publishedAt: "2026-08-20T10:00:00.000Z",
  };
  const latestVersion = {
    ...oldVersion,
    id: "version-publiee-2",
    version: "0.2.0",
    publishedAt: "2026-08-26T10:00:00.000Z",
  };
  assert.equal(
    selectActiveSkillVersion({ versions: [oldVersion, latestVersion], sources: [source], now })?.id,
    latestVersion.id
  );
  assert.equal(
    selectActiveSkillVersion({
      versions: [oldVersion, { ...latestVersion, status: "retired" }],
      sources: [source],
      now,
    })?.id,
    oldVersion.id
  );
});

test("deactivates a skill automatically when its source expires", () => {
  const published = {
    ...candidate,
    status: "published",
    publishedAt: "2026-08-26T10:00:00.000Z",
  };
  assert.equal(
    selectActiveSkillVersion({
      versions: [published],
      sources: [{ ...source, expiresAt: "2026-08-26T23:59:59.000Z" }],
      now,
    }),
    null
  );
});
