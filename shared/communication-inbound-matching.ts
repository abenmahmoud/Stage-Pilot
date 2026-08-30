import type { CommunicationBrevoInboundReceipt } from "./communication-brevo-inbound.js";

export type CommunicationInboundDeliveryCandidate = {
  institutionId: string;
  deliveryId: string;
  communicationId: string;
  providerMessageRef: string;
};

export type CommunicationInboundMatch =
  | {
      status: "matched";
      reason: "in_reply_to_exact";
      deliveryId: string;
      communicationId: string;
    }
  | {
      status: "unmatched";
      reason: "missing_reply_reference" | "delivery_not_found";
      deliveryId: null;
      communicationId: null;
    }
  | {
      status: "ambiguous";
      reason: "multiple_deliveries";
      deliveryId: null;
      communicationId: null;
    };

const CANDIDATE_FIELDS = new Set([
  "institutionId",
  "deliveryId",
  "communicationId",
  "providerMessageRef",
]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const HMAC_PATTERN = /^[a-f0-9]{64}$/u;

function validateCandidate(value: unknown): CommunicationInboundDeliveryCandidate {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("candidate_invalid");
  }
  const candidate = value as Record<string, unknown>;
  if (Object.keys(candidate).some((key) => !CANDIDATE_FIELDS.has(key))) {
    throw new Error("candidate_unknown_field");
  }
  if (
    typeof candidate.institutionId !== "string" ||
    !UUID_PATTERN.test(candidate.institutionId) ||
    typeof candidate.deliveryId !== "string" ||
    !UUID_PATTERN.test(candidate.deliveryId) ||
    typeof candidate.communicationId !== "string" ||
    !UUID_PATTERN.test(candidate.communicationId) ||
    typeof candidate.providerMessageRef !== "string" ||
    !HMAC_PATTERN.test(candidate.providerMessageRef)
  ) {
    throw new Error("candidate_invalid");
  }
  return candidate as CommunicationInboundDeliveryCandidate;
}

export function matchCommunicationInboundToDelivery(
  receipt: CommunicationBrevoInboundReceipt,
  values: unknown,
  institutionId: string
): CommunicationInboundMatch {
  if (!receipt || receipt.provider !== "brevo_inbound") throw new Error("receipt_invalid");
  if (!UUID_PATTERN.test(institutionId)) throw new Error("institution_invalid");
  if (receipt.inReplyToHash === null) {
    return {
      status: "unmatched",
      reason: "missing_reply_reference",
      deliveryId: null,
      communicationId: null,
    };
  }
  if (!HMAC_PATTERN.test(receipt.inReplyToHash)) throw new Error("receipt_invalid");
  if (!Array.isArray(values) || values.length > 2) throw new Error("candidates_invalid");
  const candidates = values.map(validateCandidate);
  if (candidates.some((candidate) => candidate.institutionId !== institutionId)) {
    throw new Error("candidate_scope_mismatch");
  }
  const matches = candidates.filter((candidate) =>
    candidate.providerMessageRef === receipt.inReplyToHash
  );
  if (matches.length === 0) {
    return {
      status: "unmatched",
      reason: "delivery_not_found",
      deliveryId: null,
      communicationId: null,
    };
  }
  if (matches.length > 1) {
    return {
      status: "ambiguous",
      reason: "multiple_deliveries",
      deliveryId: null,
      communicationId: null,
    };
  }
  return {
    status: "matched",
    reason: "in_reply_to_exact",
    deliveryId: matches[0].deliveryId,
    communicationId: matches[0].communicationId,
  };
}
