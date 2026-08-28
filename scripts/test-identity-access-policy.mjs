import assert from "node:assert/strict";
import test from "node:test";
import { authorizeInstitutionAccess } from "../shared/identity-access-policy.ts";

const now = "2026-08-27T08:00:00.000Z";
const baseActor = {
  userId: "user-1",
  verifiedContactInstitutionIds: [],
  schoolIdentity: null,
  relationships: [],
  memberships: [],
  authenticatorLevel: "aal1",
};

function decide(actor, target) {
  return authorizeInstitutionAccess({ actor, target, now });
}

test("allows public information without an account", () => {
  assert.deepEqual(
    decide({ ...baseActor, userId: null }, { kind: "public_information", institutionId: "school-a" }),
    { ok: true, basis: "public" }
  );
});

test("allows a verified contact to follow only its own request", () => {
  const actor = { ...baseActor, verifiedContactInstitutionIds: ["school-a"] };
  assert.equal(decide(actor, { kind: "support_followup", institutionId: "school-a", ownerUserId: "user-1" }).ok, true);
  assert.deepEqual(
    decide(actor, { kind: "support_followup", institutionId: "school-a", ownerUserId: "user-2" }),
    { ok: false, reason: "owner_mismatch" }
  );
});

test("does not turn a verified email into a school identity", () => {
  const actor = { ...baseActor, verifiedContactInstitutionIds: ["school-a"] };
  assert.deepEqual(
    decide(actor, { kind: "school_data", institutionId: "school-a", subjectPersonRef: "student-1" }),
    { ok: false, reason: "school_identity_required" }
  );
});

test("allows a matched identity to read only itself or an active relationship", () => {
  const actor = {
    ...baseActor,
    schoolIdentity: {
      institutionId: "school-a",
      officialPersonRef: "guardian-1",
      assuranceLevel: "directory_matched",
      revokedAt: null,
    },
    relationships: [{
      institutionId: "school-a",
      subjectPersonRef: "guardian-1",
      objectPersonRef: "student-1",
      status: "active",
      validFrom: "2026-08-01T00:00:00.000Z",
      validUntil: "2027-07-31T23:59:59.000Z",
    }],
  };
  assert.equal(decide(actor, { kind: "school_data", institutionId: "school-a", subjectPersonRef: "guardian-1" }).ok, true);
  assert.equal(decide(actor, { kind: "school_data", institutionId: "school-a", subjectPersonRef: "student-1" }).ok, true);
  assert.deepEqual(
    decide(actor, { kind: "school_data", institutionId: "school-a", subjectPersonRef: "student-2" }),
    { ok: false, reason: "relationship_missing" }
  );
  assert.deepEqual(
    decide(
      { ...actor, relationships: [{ ...actor.relationships[0], validUntil: "2026-08-26T23:59:59.000Z" }] },
      { kind: "school_data", institutionId: "school-a", subjectPersonRef: "student-1" }
    ),
    { ok: false, reason: "relationship_missing" }
  );
});

test("rejects revoked identities and cross-institution reads", () => {
  const identity = {
    institutionId: "school-a",
    officialPersonRef: "student-1",
    assuranceLevel: "official_sso",
    revokedAt: null,
  };
  assert.deepEqual(
    decide({ ...baseActor, schoolIdentity: { ...identity, revokedAt: now } }, { kind: "school_data", institutionId: "school-a", subjectPersonRef: "student-1" }),
    { ok: false, reason: "identity_revoked" }
  );
  assert.deepEqual(
    decide({ ...baseActor, schoolIdentity: identity }, { kind: "school_data", institutionId: "school-b", subjectPersonRef: "student-1" }),
    { ok: false, reason: "institution_mismatch" }
  );
});

test("limits an active agent to the services in its membership", () => {
  const actor = {
    ...baseActor,
    memberships: [{ institutionId: "school-a", role: "agent", serviceCodes: ["numerique"], status: "active" }],
  };
  assert.equal(decide(actor, { kind: "service_queue", institutionId: "school-a", serviceCode: "numerique" }).ok, true);
  assert.deepEqual(
    decide(actor, { kind: "service_queue", institutionId: "school-a", serviceCode: "vie_scolaire" }),
    { ok: false, reason: "service_scope_required" }
  );
});

test("does not let an administrator bypass the service scope", () => {
  const actor = {
    ...baseActor,
    memberships: [{ institutionId: "school-a", role: "admin", serviceCodes: ["direction"], status: "active" }],
    authenticatorLevel: "aal2",
  };
  assert.deepEqual(
    decide(actor, { kind: "service_queue", institutionId: "school-a", serviceCode: "secretariat" }),
    { ok: false, reason: "service_scope_required" }
  );
});

test("requires a manager role and MFA to publish a service skill", () => {
  const membership = { institutionId: "school-a", role: "service_manager", serviceCodes: ["numerique"], status: "active" };
  const target = { kind: "skill_publication", institutionId: "school-a", serviceCode: "numerique" };
  assert.deepEqual(decide({ ...baseActor, memberships: [membership] }, target), { ok: false, reason: "mfa_required" });
  assert.equal(decide({ ...baseActor, memberships: [membership], authenticatorLevel: "aal2" }, target).ok, true);
});

test("reserves membership administration for an MFA-protected administrator", () => {
  const manager = { institutionId: "school-a", role: "service_manager", serviceCodes: ["direction"], status: "active" };
  const admin = { ...manager, role: "admin" };
  const target = { kind: "membership_admin", institutionId: "school-a" };
  assert.deepEqual(decide({ ...baseActor, memberships: [manager], authenticatorLevel: "aal2" }, target), { ok: false, reason: "role_insufficient" });
  assert.deepEqual(decide({ ...baseActor, memberships: [admin] }, target), { ok: false, reason: "mfa_required" });
  assert.equal(decide({ ...baseActor, memberships: [admin], authenticatorLevel: "aal2" }, target).ok, true);
});

test("limits an MFA-protected auditor to its assigned service", () => {
  const actor = {
    ...baseActor,
    memberships: [{ institutionId: "school-a", role: "auditor", serviceCodes: ["vie_scolaire"], status: "active" }],
    authenticatorLevel: "aal2",
  };
  assert.equal(decide(actor, { kind: "audit_log", institutionId: "school-a", serviceCode: "vie_scolaire" }).ok, true);
  assert.deepEqual(
    decide(actor, { kind: "audit_log", institutionId: "school-a", serviceCode: "secretariat" }),
    { ok: false, reason: "service_scope_required" }
  );
  assert.deepEqual(
    decide(actor, { kind: "audit_log", institutionId: "school-a", serviceCode: null }),
    { ok: false, reason: "service_scope_required" }
  );
});

test("allows only an MFA-protected institution admin to read institution-wide logs", () => {
  const target = { kind: "audit_log", institutionId: "school-a", serviceCode: null };
  const admin = {
    institutionId: "school-a",
    role: "admin",
    serviceCodes: [],
    status: "active",
  };
  assert.deepEqual(
    decide({ ...baseActor, memberships: [admin], authenticatorLevel: "aal1" }, target),
    { ok: false, reason: "mfa_required" }
  );
  assert.equal(
    decide({ ...baseActor, memberships: [admin], authenticatorLevel: "aal2" }, target).ok,
    true
  );
});

test("keeps invited or disabled memberships outside every staff area", () => {
  for (const status of ["invited", "disabled"]) {
    const actor = {
      ...baseActor,
      memberships: [{ institutionId: "school-a", role: "admin", serviceCodes: ["direction"], status }],
      authenticatorLevel: "aal2",
    };
    assert.deepEqual(
      decide(actor, { kind: "membership_admin", institutionId: "school-a" }),
      { ok: false, reason: "membership_required" }
    );
  }
});
