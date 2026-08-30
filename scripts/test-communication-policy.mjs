import assert from "node:assert/strict";
import test from "node:test";
import {
  CommunicationPolicyError,
  parseCommunicationControlInput,
} from "../shared/communication-policy.ts";
import { readCommunicationFeatureFlags } from "../api/_shared/communication-flags.ts";

const fingerprint = "a".repeat(64);
const now = new Date("2026-08-30T10:00:00.000Z");

function parse(overrides = {}) {
  return parseCommunicationControlInput({
    sourceType: "direct_text",
    sourceFingerprint: fingerprint,
    ...overrides,
  }, now);
}

test("defaults every new communication to internal without an audience", () => {
  assert.deepEqual(parse(), {
    sourceType: "direct_text",
    sourceFingerprint: fingerprint,
    visibility: "internal",
    audienceGroupRefs: [],
    publishToSite: false,
    notifyAudience: false,
    publishAt: null,
    expiresAt: null,
  });
});

test("accepts only opaque audience references and removes duplicates", () => {
  assert.deepEqual(parse({
    visibility: "targeted",
    audienceGroupRefs: ["staff:general", "staff:general", "staff:pro"],
    notifyAudience: true,
  }).audienceGroupRefs, ["staff:general", "staff:pro"]);
  assert.throws(
    () => parse({ visibility: "targeted", audienceGroupRefs: ["person@example.test"] }),
    (error) => error instanceof CommunicationPolicyError && error.reason === "audience_ref_invalid"
  );
});

test("requires an audience for targeted visibility and notifications", () => {
  assert.throws(
    () => parse({ visibility: "targeted" }),
    (error) => error instanceof CommunicationPolicyError && error.reason === "targeted_audience_required"
  );
  assert.throws(
    () => parse({ notifyAudience: true }),
    (error) => error instanceof CommunicationPolicyError && error.reason === "notification_audience_required"
  );
});

test("publishes on the site only with explicit public visibility", () => {
  assert.equal(parse({ visibility: "public", publishToSite: true }).publishToSite, true);
  assert.throws(
    () => parse({ visibility: "internal", publishToSite: true }),
    (error) => error instanceof CommunicationPolicyError && error.reason === "public_visibility_required"
  );
});

test("checks expiry against the scheduled publication or server time", () => {
  assert.equal(parse({ expiresAt: "2026-08-31T10:00:00Z" }).expiresAt, "2026-08-31T10:00:00.000Z");
  assert.throws(
    () => parse({ publishAt: "2026-09-01T10:00:00Z", expiresAt: "2026-09-01T09:00:00Z" }),
    (error) => error instanceof CommunicationPolicyError && error.reason === "expiry_before_publication"
  );
});

test("rejects unknown fields and unbounded source values", () => {
  assert.throws(() => parse({ recipients: ["hidden@example.test"] }), CommunicationPolicyError);
  assert.throws(() => parse({ sourceType: "binary" }), CommunicationPolicyError);
  assert.throws(() => parse({ sourceFingerprint: "short" }), CommunicationPolicyError);
});

test("keeps module, publication and sending disabled unless each flag is exact", () => {
  assert.deepEqual(readCommunicationFeatureFlags({}), {
    moduleEnabled: false,
    publicationEnabled: false,
    sendingEnabled: false,
  });
  assert.deepEqual(readCommunicationFeatureFlags({
    COMMUNICATIONS_ENABLED: "true",
    COMMUNICATION_PUBLICATION_ENABLED: "true",
    COMMUNICATION_SEND_ENABLED: "true",
  }), {
    moduleEnabled: true,
    publicationEnabled: true,
    sendingEnabled: true,
  });
  assert.deepEqual(readCommunicationFeatureFlags({
    COMMUNICATIONS_ENABLED: "false",
    COMMUNICATION_PUBLICATION_ENABLED: "true",
    COMMUNICATION_SEND_ENABLED: "true",
  }), {
    moduleEnabled: false,
    publicationEnabled: false,
    sendingEnabled: false,
  });
});
