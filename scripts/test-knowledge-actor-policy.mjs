import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolveKnowledgeActor } from "../shared/knowledge-actor-policy.ts";

const base = {
  institutionId: "school-a",
  authenticated: false,
  emailConfirmed: false,
  schoolRecordMatched: false,
  membership: null,
};

test("keeps an anonymous or unconfirmed account at visitor level", () => {
  assert.equal(resolveKnowledgeActor(base).level, "visitor");
  assert.equal(resolveKnowledgeActor({ ...base, authenticated: true }).level, "visitor");
});

test("promotes only a confirmed authenticated contact to contact_verified", () => {
  assert.equal(resolveKnowledgeActor({
    ...base,
    authenticated: true,
    emailConfirmed: true,
  }).level, "contact_verified");
});

test("requires a persisted school record for school_identity", () => {
  assert.equal(resolveKnowledgeActor({
    ...base,
    authenticated: true,
    emailConfirmed: true,
    schoolRecordMatched: true,
  }).level, "school_identity");
});

test("uses only an active same-institution staff membership and its services", () => {
  const actor = resolveKnowledgeActor({
    ...base,
    authenticated: true,
    emailConfirmed: true,
    membership: {
      institutionId: "school-a",
      role: "service_manager",
      serviceCodes: ["numerique", "numerique"],
      status: "active",
    },
  });
  assert.deepEqual(actor, {
    level: "service_manager",
    institutionId: "school-a",
    serviceCodes: ["numerique"],
  });
  assert.equal(resolveKnowledgeActor({
    ...base,
    authenticated: true,
    emailConfirmed: true,
    membership: { institutionId: "school-b", role: "admin", serviceCodes: [], status: "active" },
  }).level, "contact_verified");
  assert.equal(resolveKnowledgeActor({
    ...base,
    authenticated: true,
    emailConfirmed: true,
    membership: { institutionId: "school-a", role: "admin", serviceCodes: [], status: "disabled" },
  }).level, "contact_verified");
});

test("does not promote an auditor to an operational knowledge role", () => {
  assert.equal(resolveKnowledgeActor({
    ...base,
    authenticated: true,
    emailConfirmed: true,
    membership: { institutionId: "school-a", role: "auditor", serviceCodes: ["direction"], status: "active" },
  }).level, "contact_verified");
});

test("resolves server evidence by auth id and never from conversation text", () => {
  const resolver = readFileSync(new URL("../api/_shared/knowledge-actor.ts", import.meta.url), "utf8");
  assert.match(resolver, /getUserFromRequest\(req\)/);
  assert.match(resolver, /eq\(eleves\.authUserId, user\.id\)/);
  assert.match(resolver, /eq\(professeurs\.authUserId, user\.id\)/);
  assert.match(resolver, /eq\(institutionMemberships\.status, "active"\)/);
  assert.doesNotMatch(resolver, /message|conversation|requesterType/);
});

test("the prototype sends the optional Supabase session through apiFetch", () => {
  const page = readFileSync(new URL("../src/pages/prototype/LyceeConnectPrototype.tsx", import.meta.url), "utf8");
  assert.match(page, /apiFetch<AssistantInsight>\("support\/assistant"/);
});

test("the assistant route resolves and forwards only server-side actor evidence", () => {
  const endpoint = readFileSync(new URL("../api/support/assistant.ts", import.meta.url), "utf8");
  assert.match(endpoint, /resolveKnowledgeActorFromRequest\(req\)/);
  assert.match(endpoint, /knowledgeActor,/);
});
