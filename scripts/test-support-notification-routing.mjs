import assert from "node:assert/strict";
import test from "node:test";
import { resolveSupportNotificationTarget } from "../shared/support-notification-routing.ts";

test("routes each operational service to its configured recipient", () => {
  const env = {
    SUPPORT_AGENT_EMAIL: "superadmin@example.invalid",
    SUPPORT_AGENT_EMAIL_DDFPT: "ddfpt@example.invalid",
    SUPPORT_AGENT_EMAIL_VIE_SCOLAIRE: "vie-scolaire@example.invalid",
    SUPPORT_AGENT_EMAIL_NUMERIQUE: "numerique@example.invalid",
    SUPPORT_AGENT_EMAIL_DIRECTION: "direction@example.invalid",
  };

  assert.deepEqual(resolveSupportNotificationTarget("ddfpt", env), {
    email: "ddfpt@example.invalid",
    name: "DDFPT",
    service: "ddfpt",
    source: "service",
  });
  assert.equal(resolveSupportNotificationTarget("vie_scolaire", env)?.email, "vie-scolaire@example.invalid");
  assert.equal(resolveSupportNotificationTarget("referent_numerique", env)?.email, "numerique@example.invalid");
  assert.equal(resolveSupportNotificationTarget("direction", env)?.email, "direction@example.invalid");
});

test("uses one administration mailbox for secretariat, administration and stewardship", () => {
  const env = {
    SUPPORT_AGENT_EMAIL: "superadmin@example.invalid",
    SUPPORT_AGENT_EMAIL_ADMINISTRATION: "administration@example.invalid",
  };

  for (const service of ["secretariat", "administration", "intendance"]) {
    const target = resolveSupportNotificationTarget(service, env);
    assert.equal(target?.email, "administration@example.invalid");
    assert.equal(target?.source, "service");
  }
});

test("falls back to the superadministration mailbox when a service address is absent", () => {
  const target = resolveSupportNotificationTarget("ddfpt", {
    SUPPORT_AGENT_EMAIL: "superadmin@example.invalid",
  });
  assert.deepEqual(target, {
    email: "superadmin@example.invalid",
    name: "Superadministration du lycée",
    service: "ddfpt",
    source: "fallback",
  });
});

test("routes unassigned and unknown requests only to the fallback mailbox", () => {
  const env = { SUPPORT_AGENT_EMAIL: "superadmin@example.invalid" };
  assert.equal(resolveSupportNotificationTarget(null, env)?.source, "fallback");
  assert.equal(resolveSupportNotificationTarget("unknown_service", env)?.service, null);
});

test("rejects invalid addresses and returns null when no safe recipient exists", () => {
  assert.equal(
    resolveSupportNotificationTarget("ddfpt", {
      SUPPORT_AGENT_EMAIL_DDFPT: "not-an-email",
      SUPPORT_AGENT_EMAIL: "also-invalid",
    }),
    null
  );
});

test("returns only delivery data and never an environment variable name", () => {
  const target = resolveSupportNotificationTarget("ddfpt", {
    SUPPORT_AGENT_EMAIL_DDFPT: "DDFPT@EXAMPLE.INVALID ",
  });
  assert.ok(target);
  assert.equal(target.email, "ddfpt@example.invalid");
  assert.deepEqual(Object.keys(target).sort(), ["email", "name", "service", "source"]);
  assert.equal(JSON.stringify(target).includes("SUPPORT_AGENT_EMAIL"), false);
});
