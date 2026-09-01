import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync(
  new URL("../api/webhooks/brevo/communications-inbound.ts", import.meta.url),
  "utf8"
);
const persistence = readFileSync(
  new URL("../api/_shared/communication-inbound-persistence.ts", import.meta.url),
  "utf8"
);
const previewRecipe = readFileSync(
  new URL("./test-preview-communication-inbound-replay.mjs", import.meta.url),
  "utf8"
);

test("keeps the inbound webhook closed behind flag and strong bearer", () => {
  assert.match(route, /if \(!communicationInboundWebhookEnabled\(\)\) throw new HttpError\(404/);
  assert.match(route, /verifyCommunicationInboundBearerHeader\(/);
  assert.match(route, /COMMUNICATION_INBOUND_WEBHOOK_TOKEN/);
  assert.match(route, /COMMUNICATION_PROVIDER_MESSAGE_HMAC_SECRET/);
});

test("matches only an exact provider HMAC in the configured institution", () => {
  assert.match(persistence, /eq\(communicationDeliveries\.institutionId, input\.institutionId\)/);
  assert.match(persistence, /eq\(communicationDeliveries\.providerMessageRef, receipt\.inReplyToHash\)/);
  assert.match(persistence, /\.limit\(2\)/);
  assert.match(persistence, /matchCommunicationInboundToDelivery\(receipt, candidates, input\.institutionId\)/);
  assert.doesNotMatch(persistence, /contactRef|recipientEmail|emailAddress|senderEmail/);
});

test("persists one metadata row idempotently without body or coordinates", () => {
  assert.match(route, /persistCommunicationInboundReceipts/);
  assert.match(persistence, /\.insert\(communicationInbound\)/);
  assert.match(persistence, /externalMessageHash: receipt\.externalMessageHash/);
  assert.match(persistence, /\.onConflictDoNothing\(\)/);
  assert.match(persistence, /status: receipt\.classification === null \? "received" : "review"/);
  assert.match(persistence, /classification: receipt\.classification\?\.classification \?\? null/);
  assert.doesNotMatch(persistence, /ExtractedMarkdownMessage|RawTextBody|Subject|From|Attachments|storageRef|extractedText/);
});

test("audits only bounded counters and a spam review flag for matched replies", () => {
  assert.match(persistence, /eventType: "inbound\.received"/);
  assert.match(persistence, /externalEventHash: receipt\.externalMessageHash/);
  assert.match(persistence, /attachmentCount: receipt\.attachmentCount/);
  assert.match(persistence, /attachmentBytes: receipt\.attachmentBytes/);
  assert.match(persistence, /hasExtractedMessage: receipt\.hasExtractedMessage/);
  assert.match(persistence, /spamReviewRequired:/);
  assert.match(persistence, /classificationConfidence:/);
  assert.match(persistence, /requiresHumanReview: true/);
  assert.doesNotMatch(persistence, /spamScore:|recipientAliasHashes:/);
});

test("returns aggregate non-identifying counters and bounds the body", () => {
  const response = persistence.slice(persistence.lastIndexOf("return { accepted: true"));
  assert.match(response, /received, duplicates, matched, unmatched/);
  assert.doesNotMatch(response, /communicationId|deliveryId|externalMessageHash|providerMessageRef/);
  assert.match(route, /bodyParser: \{ sizeLimit: "3mb" \}/);
});

test("keeps the executable replay recipe preview-only, transactional and residue-free", () => {
  assert.match(previewRecipe, /communicationInboundPreviewDatabaseUrl\(process\.env\.DATABASE_URL\)/);
  assert.match(previewRecipe, /assert\.deepEqual\(process\.argv\.slice\(2\), \["--preview-only"\]\)/);
  assert.match(previewRecipe, /db\.transaction\(async \(tx\)/);
  assert.match(previewRecipe, /throw ROLLBACK_RECIPE/);
  assert.match(previewRecipe, /duplicates: 2/);
  assert.match(previewRecipe, /institutions: 2/);
  assert.match(previewRecipe, /residue: 0/);
  assert.match(previewRecipe, /@example\.test/);
  assert.doesNotMatch(previewRecipe, /@ac-creteil\.fr|lycee-blaise-cendrars-sevran\.fr/);
});
