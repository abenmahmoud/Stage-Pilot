import { identityAtLeast, type AgentIdentityLevel } from "./agent-identity-policy.js";

export type RequesterServiceKind =
  | "public_information"
  | "public_document"
  | "own_schedule"
  | "linked_student_schedule"
  | "own_school_data"
  | "personal_document"
  | "access_credential"
  | "official_record_change";

export type DirectoryMatchState =
  | "none"
  | "unique_active"
  | "ambiguous"
  | "inactive";

export type IdentityDeviceSessionState =
  | "absent"
  | "active"
  | "expired"
  | "revoked";

export type RequesterRelationship =
  | "self"
  | "guardian_of"
  | "third_party"
  | "none";

export type RequesterServiceAccessDecision = {
  outcome: "instant" | "express_review" | "request_required" | "blocked";
  mayReadPersonalData: boolean;
  mayMutateOfficialData: false;
  reason:
    | "public_service"
    | "verified_own_scope"
    | "verified_linked_scope"
    | "human_authority_required"
    | "email_verification_or_request"
    | "directory_match_unavailable"
    | "device_session_unavailable"
    | "relationship_required"
    | "third_party_forbidden";
};

export type RequesterFileScanState =
  | "awaiting_upload"
  | "quarantined"
  | "scanning"
  | "clean"
  | "infected"
  | "rejected";

export type RequesterFileAccessDecision = {
  outcome: "available" | "waiting_scan" | "blocked";
  mayOpen: boolean;
  reason: "scan_clean" | "antivirus_pending" | "unsafe_file";
};

type RequesterIdentityContext = {
  identityLevel: AgentIdentityLevel;
  directoryMatch: DirectoryMatchState;
  deviceSession: IdentityDeviceSessionState;
  relationship: RequesterRelationship;
};

const PUBLIC_SERVICES = new Set<RequesterServiceKind>([
  "public_information",
  "public_document",
]);

const HUMAN_AUTHORITY_SERVICES = new Set<RequesterServiceKind>([
  "personal_document",
  "access_credential",
  "official_record_change",
]);

export function decideRequesterServiceAccess(input: {
  service: RequesterServiceKind;
  identity: RequesterIdentityContext;
}): RequesterServiceAccessDecision {
  const { service, identity } = input;

  if (PUBLIC_SERVICES.has(service)) {
    return {
      outcome: "instant",
      mayReadPersonalData: false,
      mayMutateOfficialData: false,
      reason: "public_service",
    };
  }

  if (identity.relationship === "third_party") {
    return {
      outcome: "blocked",
      mayReadPersonalData: false,
      mayMutateOfficialData: false,
      reason: "third_party_forbidden",
    };
  }

  if (identity.directoryMatch !== "unique_active") {
    return {
      outcome: "request_required",
      mayReadPersonalData: false,
      mayMutateOfficialData: false,
      reason: identity.directoryMatch === "none"
        ? "email_verification_or_request"
        : "directory_match_unavailable",
    };
  }

  if (identity.deviceSession !== "active") {
    return {
      outcome: "request_required",
      mayReadPersonalData: false,
      mayMutateOfficialData: false,
      reason: "device_session_unavailable",
    };
  }

  if (!identityAtLeast(identity.identityLevel, "I3")) {
    return {
      outcome: "request_required",
      mayReadPersonalData: false,
      mayMutateOfficialData: false,
      reason: "email_verification_or_request",
    };
  }

  const linkedStudent = input.service === "linked_student_schedule";
  if (linkedStudent && identity.relationship !== "guardian_of") {
    return {
      outcome: "request_required",
      mayReadPersonalData: false,
      mayMutateOfficialData: false,
      reason: "relationship_required",
    };
  }
  if (!linkedStudent && identity.relationship !== "self") {
    return {
      outcome: "request_required",
      mayReadPersonalData: false,
      mayMutateOfficialData: false,
      reason: "relationship_required",
    };
  }

  if (HUMAN_AUTHORITY_SERVICES.has(service)) {
    return {
      outcome: "express_review",
      mayReadPersonalData: true,
      mayMutateOfficialData: false,
      reason: "human_authority_required",
    };
  }

  return {
    outcome: "instant",
    mayReadPersonalData: true,
    mayMutateOfficialData: false,
    reason: identity.relationship === "guardian_of"
      ? "verified_linked_scope"
      : "verified_own_scope",
  };
}

export function decideRequesterFileAccess(
  scanState: RequesterFileScanState
): RequesterFileAccessDecision {
  if (scanState === "clean") {
    return { outcome: "available", mayOpen: true, reason: "scan_clean" };
  }
  if (scanState === "infected" || scanState === "rejected") {
    return { outcome: "blocked", mayOpen: false, reason: "unsafe_file" };
  }
  return { outcome: "waiting_scan", mayOpen: false, reason: "antivirus_pending" };
}
