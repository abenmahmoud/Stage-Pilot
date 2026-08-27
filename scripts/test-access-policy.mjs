import assert from "node:assert/strict";
import test from "node:test";
import {
  ADMINISTRATION_ROLES,
  AGENT_ROLES,
  roleIsAllowed,
} from "../shared/role-access.ts";
import { isStrongAgentPassword } from "../shared/password-policy.ts";

test("limits historical administration pages to administration roles", () => {
  assert.equal(roleIsAllowed("superadmin", ADMINISTRATION_ROLES), true);
  assert.equal(roleIsAllowed("administration", ADMINISTRATION_ROLES), true);
  assert.equal(roleIsAllowed("proviseur", ADMINISTRATION_ROLES), false);
  assert.equal(roleIsAllowed("professeur", ADMINISTRATION_ROLES), false);
  assert.equal(roleIsAllowed("eleve", ADMINISTRATION_ROLES), false);
});

test("allows the direction and administration into agent tools", () => {
  assert.equal(roleIsAllowed("superadmin", AGENT_ROLES), true);
  assert.equal(roleIsAllowed("administration", AGENT_ROLES), true);
  assert.equal(roleIsAllowed("proviseur", AGENT_ROLES), true);
  assert.equal(roleIsAllowed("pp", AGENT_ROLES), false);
  assert.equal(roleIsAllowed("eleve", AGENT_ROLES), false);
});

test("requires a strong password for agent accounts", () => {
  assert.equal(isStrongAgentPassword("court93@"), false);
  assert.equal(isStrongAgentPassword("douzecaracteres"), false);
  assert.equal(isStrongAgentPassword("Administration2026"), false);
  assert.equal(isStrongAgentPassword("Direction-2026!"), true);
});
