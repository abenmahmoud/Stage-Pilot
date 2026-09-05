import assert from "node:assert/strict";
import test from "node:test";
import { decideKnowledgeSourceUsage } from "../shared/knowledge-use-policy.ts";

const now = "2026-09-06T12:00:00.000Z";

const baseSource = {
  id: "source-1",
  institutionId: "school-a",
  serviceCodes: [],
  status: "published",
  classification: "public",
  provenanceStatus: "imported",
  usePolicy: "can_use_as_instruction",
  validFrom: "2026-08-01T00:00:00.000Z",
  expiresAt: "2026-12-31T23:59:59.000Z",
};

const visitor = {
  identityLevel: "I0",
  role: "visitor",
  institutionId: "school-a",
  serviceCodes: [],
};

const internalAgent = {
  identityLevel: "I3",
  role: "agent",
  institutionId: "school-a",
  serviceCodes: ["scolarite"],
};

function decide(sourceOverrides = {}, actor = visitor, nowOverride = now) {
  return decideKnowledgeSourceUsage({
    source: { ...baseSource, ...sourceOverrides },
    actor,
    now: nowOverride,
  });
}

test("rejects safely on an invalid evaluation time", () => {
  assert.deepEqual(decide({}, visitor, "not-a-date"), {
    decision: "do_not_inject",
    reasonCode: "evaluation_time_invalid",
  });
});

test("excludes a source from another institution", () => {
  assert.deepEqual(decide({ institutionId: "school-b" }), {
    decision: "do_not_inject",
    reasonCode: "institution_mismatch",
  });
});

test("excludes a draft source as not published", () => {
  assert.deepEqual(decide({ status: "draft" }), {
    decision: "do_not_inject",
    reasonCode: "source_not_published",
  });
});

test("excludes a revoked source as not published", () => {
  assert.deepEqual(decide({ status: "revoked" }), {
    decision: "do_not_inject",
    reasonCode: "source_not_published",
  });
});

test("excludes a source whose status is literally expired", () => {
  assert.deepEqual(decide({ status: "expired" }), {
    decision: "do_not_inject",
    reasonCode: "source_expired",
  });
});

test("excludes a published source not yet valid", () => {
  assert.deepEqual(decide({ validFrom: "2027-01-01T00:00:00.000Z" }), {
    decision: "do_not_inject",
    reasonCode: "source_not_yet_valid",
  });
});

test("excludes a published source past its expiry timestamp", () => {
  assert.deepEqual(decide({ expiresAt: "2026-01-01T00:00:00.000Z" }), {
    decision: "do_not_inject",
    reasonCode: "source_expired",
  });
});

test("excludes a superseded source unconditionally", () => {
  assert.deepEqual(decide({ provenanceStatus: "superseded" }), {
    decision: "do_not_inject",
    reasonCode: "source_superseded",
  });
});

test("excludes a disputed source unconditionally", () => {
  assert.deepEqual(decide({ provenanceStatus: "disputed" }), {
    decision: "do_not_inject",
    reasonCode: "source_disputed",
  });
});

test("excludes a source whose policy blocks automatic injection", () => {
  assert.deepEqual(decide({ usePolicy: "do_not_inject_automatically" }), {
    decision: "do_not_inject",
    reasonCode: "use_policy_blocks_automatic_injection",
  });
});

test("excludes a service-scoped source when the actor lacks the service", () => {
  assert.deepEqual(
    decide({ serviceCodes: ["cantine"] }, internalAgent),
    { decision: "do_not_inject", reasonCode: "service_scope_required" }
  );
});

test("allows a service-scoped source when the actor shares the service", () => {
  assert.deepEqual(decide({ serviceCodes: ["scolarite"] }, internalAgent), {
    decision: "instruction",
    reasonCode: "policy_allows_instruction",
  });
});

test("excludes an internal source for a visitor as classification unsafe", () => {
  assert.deepEqual(decide({ classification: "internal" }, visitor), {
    decision: "do_not_inject",
    reasonCode: "classification_not_safe_for_actor",
  });
});

test("excludes a personal source even for an internal agent", () => {
  assert.deepEqual(decide({ classification: "personal" }, internalAgent), {
    decision: "do_not_inject",
    reasonCode: "classification_not_safe_for_actor",
  });
});

test("excludes a sensitive source even for an internal agent", () => {
  assert.deepEqual(decide({ classification: "sensitive" }, internalAgent), {
    decision: "do_not_inject",
    reasonCode: "classification_not_safe_for_actor",
  });
});

test("allows an internal source for an authorized internal agent", () => {
  assert.deepEqual(decide({ classification: "internal" }, internalAgent), {
    decision: "instruction",
    reasonCode: "policy_allows_instruction",
  });
});

test("returns evidence for a current public source flagged as citable", () => {
  assert.deepEqual(decide({ usePolicy: "can_use_as_evidence" }), {
    decision: "evidence",
    reasonCode: "policy_allows_cited_evidence",
  });
});

test("returns requires_confirmation for a current public source pending review", () => {
  assert.deepEqual(decide({ usePolicy: "requires_human_confirmation" }), {
    decision: "requires_confirmation",
    reasonCode: "policy_requires_human_confirmation",
  });
});

test("returns instruction for a current public source with the historical default policy", () => {
  assert.deepEqual(decide({}), {
    decision: "instruction",
    reasonCode: "policy_allows_instruction",
  });
});

// Combinaisons contradictoires : plusieurs motifs d'exclusion vrais en meme
// temps. Le motif retenu doit rester stable (ordre de priorite deterministe),
// jamais un motif choisi au hasard entre deux causes valides.

test("prioritizes institution mismatch over every other contradictory exclusion", () => {
  assert.deepEqual(
    decide({
      institutionId: "school-b",
      status: "expired",
      provenanceStatus: "disputed",
      usePolicy: "do_not_inject_automatically",
      classification: "sensitive",
    }),
    { decision: "do_not_inject", reasonCode: "institution_mismatch" }
  );
});

test("prioritizes superseded over disputed and policy exclusion when all are true", () => {
  assert.deepEqual(
    decide({
      provenanceStatus: "superseded",
      usePolicy: "do_not_inject_automatically",
      classification: "sensitive",
    }),
    { decision: "do_not_inject", reasonCode: "source_superseded" }
  );
});

test("prioritizes the automatic-injection block over service scope and classification", () => {
  assert.deepEqual(
    decide({
      usePolicy: "do_not_inject_automatically",
      serviceCodes: ["cantine"],
      classification: "sensitive",
    }, internalAgent),
    { decision: "do_not_inject", reasonCode: "use_policy_blocks_automatic_injection" }
  );
});

test("prioritizes service scope over classification when both are true", () => {
  assert.deepEqual(
    decide({ serviceCodes: ["cantine"], classification: "sensitive" }, internalAgent),
    { decision: "do_not_inject", reasonCode: "service_scope_required" }
  );
});
