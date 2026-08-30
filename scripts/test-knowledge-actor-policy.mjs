import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { migrateLegacyActorLevel } from "../shared/agent-identity-policy.ts";
import { resolveKnowledgeActor } from "../shared/knowledge-actor-policy.ts";

const base = {
  institutionId: "school-a",
  authenticated: false,
  emailConfirmed: false,
  schoolRecordMatched: false,
  membership: null,
};

test("separates an anonymous visitor from a declared authenticated identity", () => {
  assert.deepEqual(resolveKnowledgeActor(base), {
    identityLevel: "I0",
    role: "visitor",
    institutionId: "school-a",
    serviceCodes: [],
  });
  assert.deepEqual(resolveKnowledgeActor({ ...base, authenticated: true }), {
    identityLevel: "I1",
    role: "requester",
    institutionId: "school-a",
    serviceCodes: [],
  });
});

test("promotes only a confirmed authenticated contact to I2", () => {
  assert.equal(resolveKnowledgeActor({
    ...base,
    authenticated: true,
    emailConfirmed: true,
  }).identityLevel, "I2");
});

test("requires a persisted school record for I3 and keeps the school role separate", () => {
  assert.deepEqual(resolveKnowledgeActor({
    ...base,
    authenticated: true,
    emailConfirmed: true,
    schoolRecordMatched: true,
    schoolRole: "student",
  }), {
    identityLevel: "I3",
    role: "student",
    institutionId: "school-a",
    serviceCodes: [],
  });
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
    identityLevel: "I3",
    role: "service_manager",
    institutionId: "school-a",
    serviceCodes: ["numerique"],
  });
  assert.equal(resolveKnowledgeActor({
    ...base,
    authenticated: true,
    emailConfirmed: true,
    membership: { institutionId: "school-b", role: "admin", serviceCodes: [], status: "active" },
  }).identityLevel, "I2");
  assert.equal(resolveKnowledgeActor({
    ...base,
    authenticated: true,
    emailConfirmed: true,
    membership: { institutionId: "school-a", role: "admin", serviceCodes: [], status: "disabled" },
  }).identityLevel, "I2");
});

test("grants I4 only from a recent reinforced staff session", () => {
  const actor = resolveKnowledgeActor({
    ...base,
    authenticated: true,
    emailConfirmed: true,
    authenticatorLevel: "aal2",
    membership: {
      institutionId: "school-a",
      role: "admin",
      serviceCodes: ["direction"],
      status: "active",
    },
  });
  assert.equal(actor.identityLevel, "I4");
  assert.equal(actor.role, "admin");
});

test("does not promote an auditor to an operational knowledge role", () => {
  assert.equal(resolveKnowledgeActor({
    ...base,
    authenticated: true,
    emailConfirmed: true,
    membership: { institutionId: "school-a", role: "auditor", serviceCodes: ["direction"], status: "active" },
  }).identityLevel, "I2");
});

test("migrates legacy labels without ever inferring I4", () => {
  assert.deepEqual(migrateLegacyActorLevel("contact_verified"), {
    identityLevel: "I2",
    role: "requester",
  });
  assert.deepEqual(migrateLegacyActorLevel("admin"), {
    identityLevel: "I3",
    role: "admin",
  });
  assert.equal(migrateLegacyActorLevel("L4"), null);
  assert.equal(migrateLegacyActorLevel("unknown"), null);
});

test("resolves server evidence by auth id and never from conversation text", () => {
  const resolver = readFileSync(new URL("../api/_shared/knowledge-actor.ts", import.meta.url), "utf8");
  assert.match(resolver, /getUserFromRequest\(req\)/);
  assert.match(resolver, /eq\(eleves\.authUserId, user\.id\)/);
  assert.match(resolver, /eq\(professeurs\.authUserId, user\.id\)/);
  assert.match(resolver, /eq\(institutionMemberships\.status, "active"\)/);
  assert.match(resolver, /getAuthenticatorLevelFromRequest\(req\)/);
  assert.doesNotMatch(resolver, /message|conversation|requesterType/);
});

test("the prototype sends the optional Supabase session through apiFetch", () => {
  const page = readFileSync(new URL("../src/pages/prototype/LyceeConnectPrototype.tsx", import.meta.url), "utf8");
  assert.match(page, /apiFetch<AssistantApiResult>\("support\/assistant"/);
});

test("the assistant route resolves and forwards only server-side actor evidence", () => {
  const endpoint = readFileSync(new URL("../api/support/assistant.ts", import.meta.url), "utf8");
  assert.match(endpoint, /resolveKnowledgeActorFromRequest\(req\)/);
  assert.match(endpoint, /knowledgeActor,/);
});
