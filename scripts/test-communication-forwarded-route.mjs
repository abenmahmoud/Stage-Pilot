import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync(
  new URL("../api/webhooks/brevo/communications-forwarded.ts", import.meta.url),
  "utf8"
);
const contract = readFileSync(
  new URL("../shared/communication-brevo-forwarded.ts", import.meta.url),
  "utf8"
);

test("keeps forwarded intake closed behind separate server controls", () => {
  assert.match(route, /if \(!communicationForwardWebhookEnabled\(\)\) throw new HttpError\(404/);
  assert.match(route, /COMMUNICATION_FORWARD_WEBHOOK_TOKEN/);
  assert.match(contract, /COMMUNICATION_FORWARD_ALLOWED_SOURCE_HASHES/);
  assert.match(contract, /COMMUNICATION_FORWARD_ALLOWED_ALIAS_HASHES/);
  assert.match(route, /COMMUNICATION_FORWARD_ACTOR_USER_ID/);
  assert.match(route, /requireConfiguredInstitution\(\)/);
  assert.match(route, /eq\(institutionMemberships\.institutionId, institution\.id\)/);
  assert.match(route, /eq\(institutionMemberships\.userId, actorUserId\)/);
  assert.match(route, /eq\(institutionMemberships\.status, "active"\)/);
  assert.match(route, /eq\(institutionMemberships\.role, "admin"\)/);
});

test("creates one idempotent internal draft in a single transaction", () => {
  assert.match(route, /db\.transaction\(async \(tx\)/);
  assert.match(route, /\.insert\(communicationInbound\)/);
  assert.match(route, /provider: "brevo_forward"/);
  assert.match(route, /classification: "forwarded_source"/);
  assert.match(route, /\.onConflictDoNothing\(\)/);
  assert.match(route, /\.insert\(communications\)/);
  assert.match(route, /sourceType: "forwarded_email"/);
  assert.match(route, /visibility: "internal"/);
  assert.match(route, /status: "draft"/);
  assert.match(route, /\.insert\(communicationVersions\)/);
  assert.match(route, /status: "processed"/);
  assert.match(route, /eventType: "inbound\.draft_created"/);
});

test("returns only aggregate state and opens no publication or delivery", () => {
  const response = route.slice(route.lastIndexOf("return { accepted: true"));
  assert.match(response, /accepted: true, duplicate: false, draftCreated: true, reviewRequired: true/);
  assert.doesNotMatch(response, /communicationId|inboundId|externalMessageHash|subject|extractedText|sourceFingerprint/);
  assert.doesNotMatch(route, /communicationAudiences|communicationDeliveries|communicationJobs|siteContentItems/);
  assert.match(route, /bodyParser: \{ sizeLimit: "3mb" \}/);
});

test("persists bounded review metadata without a source address", () => {
  assert.match(route, /privacySignals: prepared\.privacySignals/);
  assert.match(route, /redactionRequiredBeforeAi: prepared\.redactionRequiredBeforeAi/);
  assert.match(route, /requiresHumanReview: true/);
  assert.doesNotMatch(route, /senderEmail|senderAddress|recipientEmail|From\.Address|contactRef/);
});
