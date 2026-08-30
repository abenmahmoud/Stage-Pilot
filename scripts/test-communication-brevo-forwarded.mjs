import assert from "node:assert/strict";
import test from "node:test";
import {
  communicationForwardAliasHashForConfiguration,
  communicationForwardAllowedAliasHashes,
  communicationForwardAllowedSourceHashes,
  communicationForwardSourceHashForConfiguration,
  communicationForwardWebhookEnabled,
  parseCommunicationBrevoForwardedEnvelope,
  verifyCommunicationForwardBearerHeader,
} from "../shared/communication-brevo-forwarded.ts";

const hashingSecret = "stable-forward-hmac-secret-with-32-chars";
const bearerSecret = "stable-forward-bearer-secret-32-chars";
const allowedAddress = "authorized-source@example.test";
const allowedAlias = "collecte@example.test";
const allowedHash = communicationForwardSourceHashForConfiguration(allowedAddress, hashingSecret);
const allowedAliasHash = communicationForwardAliasHashForConfiguration(allowedAlias, hashingSecret);

function item(overrides = {}) {
  return {
    MessageId: "<forwarded-001@example.test>",
    From: { Address: allowedAddress, Name: "Source fictive" },
    To: [{ Address: allowedAlias }],
    Subject: "TR: Information fictive",
    ExtractedMarkdownMessage: "Bonjour,\n\nInformation strictement fictive.",
    Attachments: [{ ContentLength: 1234 }],
    ...overrides,
  };
}

test("accepts one allowed source while keeping its address out of the result", () => {
  const result = parseCommunicationBrevoForwardedEnvelope(
    { items: [item()] },
    hashingSecret,
    [allowedHash],
    [allowedAliasHash]
  );
  assert.match(result.externalMessageHash, /^[a-f0-9]{64}$/);
  assert.equal(result.attachmentCount, 1);
  assert.equal(result.subject, "TR: Information fictive");
  assert.equal(result.sourceAuthorized, true);
  assert.doesNotMatch(JSON.stringify(result), /authorized-source@example\.test|collecte@example\.test/);
});

test("rejects an unknown source, a batch and unbounded extracted text", () => {
  assert.throws(() => parseCommunicationBrevoForwardedEnvelope(
    { items: [item({ From: { Address: "unknown@example.test" } })] },
    hashingSecret,
    [allowedHash],
    [allowedAliasHash]
  ), /source_not_authorized/);
  assert.throws(() => parseCommunicationBrevoForwardedEnvelope(
    { items: [item({ To: [{ Address: "other-alias@example.test" }] })] },
    hashingSecret,
    [allowedHash],
    [allowedAliasHash]
  ), /alias_not_authorized/);
  assert.throws(() => parseCommunicationBrevoForwardedEnvelope(
    { items: [item(), item({ MessageId: "<forwarded-002@example.test>" })] },
    hashingSecret,
    [allowedHash],
    [allowedAliasHash]
  ), /single_message_required/);
  assert.throws(() => parseCommunicationBrevoForwardedEnvelope(
    { items: [item({ ExtractedMarkdownMessage: "x".repeat(100_001) })] },
    hashingSecret,
    [allowedHash],
    [allowedAliasHash]
  ), /extracted_message_invalid|extracted_text_invalid/);
});

test("parses only a bounded HMAC allowlist and exact activation flag", () => {
  assert.deepEqual(
    communicationForwardAllowedSourceHashes({
      COMMUNICATION_FORWARD_ALLOWED_SOURCE_HASHES: `${allowedHash},${allowedHash}`,
    }),
    [allowedHash]
  );
  assert.deepEqual(
    communicationForwardAllowedAliasHashes({
      COMMUNICATION_FORWARD_ALLOWED_ALIAS_HASHES: `${allowedAliasHash},${allowedAliasHash}`,
    }),
    [allowedAliasHash]
  );
  assert.throws(() => communicationForwardAllowedSourceHashes({}), /allowed_sources_missing/);
  assert.throws(() => communicationForwardAllowedSourceHashes({
    COMMUNICATION_FORWARD_ALLOWED_SOURCE_HASHES: "raw-address@example.test",
  }), /allowed_sources_invalid/);
  assert.throws(() => communicationForwardAllowedAliasHashes({}), /allowed_aliases_missing/);
  assert.equal(communicationForwardWebhookEnabled({}), false);
  assert.equal(communicationForwardWebhookEnabled({ COMMUNICATION_FORWARD_ENABLED: "TRUE" }), false);
  assert.equal(communicationForwardWebhookEnabled({ COMMUNICATION_FORWARD_ENABLED: "true" }), true);
});

test("requires one exact strong Bearer token", () => {
  assert.equal(verifyCommunicationForwardBearerHeader(`Bearer ${bearerSecret}`, bearerSecret), true);
  assert.equal(verifyCommunicationForwardBearerHeader(`bearer ${bearerSecret}`, bearerSecret), false);
  assert.equal(verifyCommunicationForwardBearerHeader([`Bearer ${bearerSecret}`], bearerSecret), false);
  assert.equal(verifyCommunicationForwardBearerHeader(`Bearer ${bearerSecret}`, "short"), false);
});
