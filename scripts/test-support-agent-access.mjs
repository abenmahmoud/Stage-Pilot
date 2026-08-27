import assert from "node:assert/strict";
import test from "node:test";
import {
  canAccessSupportService,
  canTransferSupportRequest,
  resolvePersistedSupportAgentAccess,
  resolveSupportAgentAccess,
} from "../shared/support-agent-access.ts";

test("gives the superadministrator a complete support perimeter", () => {
  const access = resolveSupportAgentAccess("superadmin");
  assert.ok(access);
  assert.equal(access.canViewAll, true);
  assert.equal(canAccessSupportService(access, null), true);
  assert.equal(canAccessSupportService(access, "vie_scolaire"), true);
  assert.equal(canTransferSupportRequest(access, "ddfpt", "vie_scolaire"), true);
});

test("limits a DDFPT agent to the declared service", () => {
  const access = resolveSupportAgentAccess("agent", { service_codes: ["ddfpt"] });
  assert.ok(access);
  assert.equal(access.label, "Agent DDFPT");
  assert.equal(canAccessSupportService(access, "ddfpt"), true);
  assert.equal(canAccessSupportService(access, "vie_scolaire"), false);
  assert.equal(canAccessSupportService(access, null), false);
  assert.equal(canTransferSupportRequest(access, "ddfpt", "vie_scolaire"), false);
});

test("limits a school-life agent to school-life requests", () => {
  const access = resolveSupportAgentAccess("agent", {
    service_codes: ["vie_scolaire", "not-a-service"],
  });
  assert.ok(access);
  assert.deepEqual(access.serviceCodes, ["vie_scolaire"]);
  assert.equal(canAccessSupportService(access, "vie_scolaire"), true);
  assert.equal(canAccessSupportService(access, "secretariat"), false);
});

test("keeps the historical administration account scoped", () => {
  const access = resolveSupportAgentAccess("administration");
  assert.ok(access);
  assert.equal(canAccessSupportService(access, "secretariat"), true);
  assert.equal(canAccessSupportService(access, "intendance"), true);
  assert.equal(canAccessSupportService(access, "administration"), true);
  assert.equal(canAccessSupportService(access, "ddfpt"), false);
  assert.equal(canAccessSupportService(access, "referent_numerique"), false);
});

test("rejects an agent without a trusted service declaration", () => {
  assert.equal(resolveSupportAgentAccess("agent", {}), null);
  assert.equal(resolveSupportAgentAccess("professeur", { service_codes: ["ddfpt"] }), null);
});

test("uses active persisted services instead of metadata", () => {
  const access = resolvePersistedSupportAgentAccess("agent", {
    role: "agent",
    serviceCodes: ["ddfpt", "not-a-service", "ddfpt"],
    status: "active",
    institutionStatus: "pilot",
  });
  assert.ok(access);
  assert.deepEqual(access.serviceCodes, ["ddfpt"]);
  assert.equal(canAccessSupportService(access, "vie_scolaire"), false);
});

test("denies disabled memberships and suspended institutions", () => {
  assert.equal(
    resolvePersistedSupportAgentAccess("agent", {
      role: "agent",
      serviceCodes: ["ddfpt"],
      status: "disabled",
      institutionStatus: "pilot",
    }),
    null
  );
  assert.equal(
    resolvePersistedSupportAgentAccess("agent", {
      role: "agent",
      serviceCodes: ["ddfpt"],
      status: "active",
      institutionStatus: "suspended",
    }),
    null
  );
});

test("requires an active admin membership for global support roles", () => {
  assert.equal(
    resolvePersistedSupportAgentAccess("superadmin", {
      role: "agent",
      serviceCodes: ["direction"],
      status: "active",
      institutionStatus: "active",
    }),
    null
  );
  const access = resolvePersistedSupportAgentAccess("proviseur", {
    role: "admin",
    serviceCodes: [],
    status: "active",
    institutionStatus: "active",
  });
  assert.ok(access);
  assert.equal(access.canViewAll, true);
});

test("never turns a persisted auditor into a support agent", () => {
  assert.equal(
    resolvePersistedSupportAgentAccess("agent", {
      role: "auditor",
      serviceCodes: ["vie_scolaire"],
      status: "active",
      institutionStatus: "active",
    }),
    null
  );
});
