import assert from "node:assert/strict";
import test from "node:test";
import {
  CommunicationBrevoInboundError,
  communicationInboundWebhookEnabled,
  parseCommunicationBrevoInboundEnvelope,
  verifyCommunicationInboundBearerHeader,
} from "../shared/communication-brevo-inbound.ts";

const secret = "brevo-inbound-test-token-with-32-characters";
const hashingSecret = "stable-hmac-test-secret-with-32-characters";

function parse(envelope) {
  return parseCommunicationBrevoInboundEnvelope(envelope, hashingSecret);
}

function item(overrides = {}) {
  return {
    MessageId: "<message-001@example.test>",
    InReplyTo: "<outbound-001@example.test>",
    From: { Address: "parent@example.test", Name: "Parent fictif" },
    To: [{ Address: "communication+groupe-a@example.test" }],
    Recipients: ["communication+groupe-a@example.test"],
    Subject: "Réponse fictive",
    ExtractedMarkdownMessage: "Merci, ceci est une réponse fictive.",
    RawTextBody: "Texte brut qui ne doit pas ressortir.",
    Attachments: [{
      Name: "document-fictif.pdf",
      ContentType: "application/pdf",
      ContentLength: 12_345,
      DownloadToken: "private-download-token-must-not-leak",
    }],
    SpamScore: 0.2,
    Headers: { Authorization: "Bearer private-value" },
    ...overrides,
  };
}

test("accepts only one exact Bearer token with a strong configured secret", () => {
  assert.equal(verifyCommunicationInboundBearerHeader(`Bearer ${secret}`, secret), true);
  assert.equal(verifyCommunicationInboundBearerHeader(`bearer ${secret}`, secret), false);
  assert.equal(verifyCommunicationInboundBearerHeader(`Bearer wrong-${secret}`, secret), false);
  assert.equal(verifyCommunicationInboundBearerHeader([`Bearer ${secret}`], secret), false);
  assert.equal(verifyCommunicationInboundBearerHeader(`Bearer ${secret}, Bearer ${secret}`, secret), false);
  assert.equal(verifyCommunicationInboundBearerHeader(`Bearer ${secret}`, "short"), false);
});

test("returns only bounded non-identifying receipt metadata", () => {
  const [receipt] = parse({ items: [item()] });
  assert.deepEqual(Object.keys(receipt).sort(), [
    "attachmentBytes",
    "attachmentCount",
    "classification",
    "externalMessageHash",
    "hasExtractedMessage",
    "inReplyToHash",
    "provider",
    "recipientAliasHashes",
    "spamScore",
  ]);
  assert.match(receipt.externalMessageHash, /^[a-f0-9]{64}$/);
  assert.match(receipt.inReplyToHash, /^[a-f0-9]{64}$/);
  assert.equal(receipt.recipientAliasHashes.length, 1);
  assert.equal(receipt.attachmentCount, 1);
  assert.equal(receipt.attachmentBytes, 12_345);
  assert.equal(receipt.hasExtractedMessage, true);
  assert.equal(receipt.classification.classification, "free_reply");
  assert.equal(receipt.classification.requiresHumanReview, true);
  const output = JSON.stringify(receipt);
  for (const privateValue of [
    "parent@example.test",
    "communication+groupe-a@example.test",
    "Réponse fictive",
    "Texte brut",
    "document-fictif.pdf",
    "private-download-token-must-not-leak",
  ]) {
    assert.doesNotMatch(output, new RegExp(privateValue.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
  }
});

test("classifies bounded extracted text without returning the message", () => {
  const [withdrawal] = parse({
    items: [item({ ExtractedMarkdownMessage: "Retirez-moi de la liste, s’il vous plaît." })],
  });
  assert.equal(withdrawal.classification.classification, "withdrawal");
  assert.equal(withdrawal.classification.proposedAction, "confirm_withdrawal");

  const [empty] = parse({
    items: [item({ ExtractedMarkdownMessage: "   " })],
  });
  assert.equal(empty.hasExtractedMessage, false);
  assert.equal(empty.classification, null);
});

test("creates stable secret domain-separated HMACs and rejects duplicates in one batch", () => {
  const [first] = parse({ items: [item()] });
  const [same] = parse({ items: [item()] });
  const [differentSecret] = parseCommunicationBrevoInboundEnvelope(
    { items: [item()] },
    "another-stable-hmac-secret-with-32-characters"
  );
  assert.equal(first.externalMessageHash, same.externalMessageHash);
  assert.notEqual(first.externalMessageHash, first.inReplyToHash);
  assert.notEqual(first.externalMessageHash, differentSecret.externalMessageHash);
  assert.throws(
    () => parse({ items: [item(), item()] }),
    (error) => error instanceof CommunicationBrevoInboundError && error.reason === "message_id_duplicate"
  );
});

test("accepts documented recipient shapes while hashing each unique alias", () => {
  const [receipt] = parse({
    items: [item({
      To: [{ Address: "first@example.test" }],
      Recipients: ["FIRST@example.test", { Address: "second@example.test" }],
    })],
  });
  assert.equal(receipt.recipientAliasHashes.length, 2);
  assert.equal(receipt.recipientAliasHashes.every((value) => /^[a-f0-9]{64}$/.test(value)), true);
});

test("bounds batches, header values, attachments, bodies and spam metadata", () => {
  assert.throws(() => parse({ items: [] }), /items_invalid/);
  assert.throws(() => parse({
    items: Array.from({ length: 21 }, (_, index) => item({ MessageId: `<${index}@example.test>` })),
  }), /items_invalid/);
  assert.throws(() => parse({
    items: [item({ MessageId: "<bad\r\nheader@example.test>" })],
  }), /message_id_invalid/);
  assert.throws(() => parse({
    items: [item({ Attachments: [{ ContentLength: 10 * 1024 * 1024 + 1 }] })],
  }), /attachment_size_invalid/);
  assert.throws(() => parse({
    items: [item({ ExtractedMarkdownMessage: "x".repeat(100_001) })],
  }), /extracted_message_invalid/);
  assert.throws(() => parse({
    items: [item({ SpamScore: Number.POSITIVE_INFINITY })],
  }), /spam_score_invalid/);
  assert.throws(() => parse({
    items: [item({ To: [], Recipients: [] })],
  }), /recipients_invalid/);
  assert.throws(
    () => parseCommunicationBrevoInboundEnvelope({ items: [item()] }, "short"),
    /hashing_secret_invalid/
  );
});

test("keeps the inbound integration closed unless the exact flag is enabled", () => {
  assert.equal(communicationInboundWebhookEnabled({}), false);
  assert.equal(communicationInboundWebhookEnabled({ COMMUNICATION_INBOUND_ENABLED: "TRUE" }), false);
  assert.equal(communicationInboundWebhookEnabled({ COMMUNICATION_INBOUND_ENABLED: "true" }), true);
});
