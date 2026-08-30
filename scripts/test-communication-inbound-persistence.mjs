import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync(
  new URL("../api/webhooks/brevo/communications-inbound.ts", import.meta.url),
  "utf8"
);

test("keeps the inbound webhook closed behind flag and strong bearer", () => {
  assert.match(route, /if \(!communicationInboundWebhookEnabled\(\)\) throw new HttpError\(404/);
  assert.match(route, /verifyCommunicationInboundBearerHeader\(/);
  assert.match(route, /COMMUNICATION_INBOUND_WEBHOOK_TOKEN/);
  assert.match(route, /COMMUNICATION_PROVIDER_MESSAGE_HMAC_SECRET/);
});

test("matches only an exact provider HMAC in the configured institution", () => {
  assert.match(route, /eq\(communicationDeliveries\.institutionId, institution\.id\)/);
  assert.match(route, /eq\(communicationDeliveries\.providerMessageRef, receipt\.inReplyToHash\)/);
  assert.match(route, /\.limit\(2\)/);
  assert.match(route, /matchCommunicationInboundToDelivery\(receipt, candidates, institution\.id\)/);
  assert.doesNotMatch(route, /contactRef|recipientEmail|emailAddress|senderEmail/);
});

test("persists one metadata row idempotently without body or coordinates", () => {
  assert.match(route, /\.insert\(communicationInbound\)/);
  assert.match(route, /externalMessageHash: receipt\.externalMessageHash/);
  assert.match(route, /\.onConflictDoNothing\(\)/);
  assert.match(route, /status: "received"/);
  assert.doesNotMatch(route, /ExtractedMarkdownMessage|RawTextBody|Subject|From|Attachments|storageRef|extractedText/);
});

test("audits only bounded counters and a spam review flag for matched replies", () => {
  assert.match(route, /eventType: "inbound\.received"/);
  assert.match(route, /externalEventHash: receipt\.externalMessageHash/);
  assert.match(route, /attachmentCount: receipt\.attachmentCount/);
  assert.match(route, /attachmentBytes: receipt\.attachmentBytes/);
  assert.match(route, /hasExtractedMessage: receipt\.hasExtractedMessage/);
  assert.match(route, /spamReviewRequired:/);
  assert.doesNotMatch(route, /spamScore:|recipientAliasHashes:/);
});

test("returns aggregate non-identifying counters and bounds the body", () => {
  const response = route.slice(route.lastIndexOf("return { accepted: true"));
  assert.match(response, /received, duplicates, matched, unmatched/);
  assert.doesNotMatch(response, /communicationId|deliveryId|externalMessageHash|providerMessageRef/);
  assert.match(route, /bodyParser: \{ sizeLimit: "3mb" \}/);
});
