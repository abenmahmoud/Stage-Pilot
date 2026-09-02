import assert from "node:assert/strict";
import test from "node:test";
import {
  decideRequesterFileAccess,
  decideRequesterServiceAccess,
} from "../shared/requester-service-access-policy.ts";

const verifiedStudent = {
  identityLevel: "I3",
  directoryMatch: "unique_active",
  deviceSession: "active",
  relationship: "self",
};

test("serves public information and blank public documents without identity", () => {
  for (const service of ["public_information", "public_document"]) {
    assert.equal(decideRequesterServiceAccess({
      service,
      identity: { identityLevel: "I0", directoryMatch: "none", deviceSession: "absent", relationship: "none" },
    }).outcome, "instant");
  }
});

test("serves a student's own schedule only from an active I3 device session", () => {
  assert.deepEqual(decideRequesterServiceAccess({ service: "own_schedule", identity: verifiedStudent }), {
    outcome: "instant",
    mayReadPersonalData: true,
    mayMutateOfficialData: false,
    reason: "verified_own_scope",
  });
});

test("falls back to a tracked request when the device is not identified", () => {
  for (const deviceSession of ["absent", "expired", "revoked"]) {
    const decision = decideRequesterServiceAccess({
      service: "own_schedule",
      identity: { ...verifiedStudent, deviceSession },
    });
    assert.equal(decision.outcome, "request_required");
    assert.equal(decision.mayReadPersonalData, false);
    assert.equal(decision.reason, "device_session_unavailable");
  }
});

test("never auto-matches an ambiguous, inactive or shared directory contact", () => {
  for (const directoryMatch of ["ambiguous", "inactive"]) {
    const decision = decideRequesterServiceAccess({
      service: "own_school_data",
      identity: { ...verifiedStudent, directoryMatch },
    });
    assert.equal(decision.outcome, "request_required");
    assert.equal(decision.mayReadPersonalData, false);
    assert.equal(decision.reason, "directory_match_unavailable");
  }
});

test("allows a guardian to read only the linked student's low-risk scope", () => {
  const allowed = decideRequesterServiceAccess({
    service: "linked_student_schedule",
    identity: { ...verifiedStudent, relationship: "guardian_of" },
  });
  assert.equal(allowed.outcome, "instant");
  assert.equal(allowed.reason, "verified_linked_scope");

  const denied = decideRequesterServiceAccess({ service: "linked_student_schedule", identity: verifiedStudent });
  assert.equal(denied.outcome, "request_required");
  assert.equal(denied.reason, "relationship_required");
});

test("blocks any third-party personal lookup without revealing whether data exists", () => {
  const decision = decideRequesterServiceAccess({
    service: "own_schedule",
    identity: { ...verifiedStudent, relationship: "third_party" },
  });
  assert.equal(decision.outcome, "blocked");
  assert.equal(decision.mayReadPersonalData, false);
  assert.equal(decision.reason, "third_party_forbidden");
});

test("keeps credentials, personal documents and official changes under human authority", () => {
  for (const service of ["personal_document", "access_credential", "official_record_change"]) {
    const decision = decideRequesterServiceAccess({ service, identity: verifiedStudent });
    assert.equal(decision.outcome, "express_review");
    assert.equal(decision.mayReadPersonalData, true);
    assert.equal(decision.mayMutateOfficialData, false);
  }
});

test("never opens a file before a clean antivirus result", () => {
  for (const state of ["awaiting_upload", "quarantined", "scanning"]) {
    assert.deepEqual(decideRequesterFileAccess(state), {
      outcome: "waiting_scan", mayOpen: false, reason: "antivirus_pending",
    });
  }
  assert.deepEqual(decideRequesterFileAccess("clean"), {
    outcome: "available", mayOpen: true, reason: "scan_clean",
  });
  for (const state of ["infected", "rejected"]) {
    assert.deepEqual(decideRequesterFileAccess(state), {
      outcome: "blocked", mayOpen: false, reason: "unsafe_file",
    });
  }
});
