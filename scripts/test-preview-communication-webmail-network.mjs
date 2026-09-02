import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import {
  createCommunicationWebmailDeliveryToken,
  verifyCommunicationWebmailDeliveryToken,
} from "../shared/communication-webmail-delivery.ts";
import {
  createCommunicationWebmailHttpTransport,
  runCommunicationWebmailDeliveryBatch,
} from "../shared/communication-webmail-client.ts";
import {
  assertCommunicationWebmailNetworkPreviewSecrets,
  assertCommunicationWebmailNetworkPreviewTarget,
} from "./communication-webmail-network-preview-target.mjs";
import {
  COMMUNICATION_WEBMAIL_FIXTURE_PURPOSE,
  verifyCommunicationWebmailFixtureChallenge,
} from "./communication-webmail-network-fixture-proof.mjs";

const MAX_CHALLENGE_RESPONSE_BYTES = 4 * 1024;
const institutionId = "11dc4154-9fe3-4624-93b7-34e7feb944b0";
const communicationId = "2423e6c2-bf87-43df-8149-c6ef6f168622";
const versionId = "b8f4c471-105c-456b-ab22-2e46dfb90b3c";

async function readBoundedJson(response, maxBytes) {
  const contentType = response.headers.get("content-type") ?? "";
  const declared = response.headers.get("content-length");
  if (!response.ok || !/^application\/(?:[a-z0-9!#$&^_.+-]+\+)?json(?:\s*;|$)/iu.test(contentType)) {
    await response.body?.cancel().catch(() => undefined);
    throw new Error("webmail_fixture_challenge_failed");
  }
  if (declared !== null && (!/^\d+$/u.test(declared) || Number(declared) > maxBytes)) {
    await response.body?.cancel().catch(() => undefined);
    throw new Error("webmail_fixture_challenge_failed");
  }
  if (!response.body) throw new Error("webmail_fixture_challenge_failed");
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new Error("webmail_fixture_challenge_failed");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new Error("webmail_fixture_challenge_failed");
  }
}

async function verifyFixture(target, secrets, now) {
  const challenge = randomBytes(32).toString("base64url");
  const response = await fetch(target.challengeEndpoint, {
    method: "POST",
    headers: {
      accept: "application/json",
      authorization: `Bearer ${secrets.bearerToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      v: 1,
      purpose: COMMUNICATION_WEBMAIL_FIXTURE_PURPOSE,
      runId: target.runId,
      challenge,
    }),
    cache: "no-store",
    credentials: "omit",
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
  });
  verifyCommunicationWebmailFixtureChallenge({
    value: await readBoundedJson(response, MAX_CHALLENGE_RESPONSE_BYTES),
    runId: target.runId,
    challenge,
    proofSecret: secrets.proofSecret,
    now,
  });
}

function fixtureItem(index, now, secrets) {
  const suffix = String(index).padStart(12, "0");
  const commandToken = createCommunicationWebmailDeliveryToken({
    institutionId,
    secret: secrets.deliverySecret,
    now,
    command: {
      v: 1,
      institutionId,
      deliveryId: `90890f16-f354-484d-88e9-${suffix}`,
      communicationId,
      versionId,
      version: 1,
      contactRef: `fixture:contact:${String(index).padStart(6, "0")}`,
      resolutionHash: "a".repeat(64),
      idempotencyKeyHash: index.toString(16).padStart(64, "0"),
      visibility: "internal",
      canonicalPath: "/informations/recette-webmail",
      linkMode: "authenticated",
      subject: "[TEST] Information fictive",
      preheader: "Recette réseau sans destinataire réel.",
      bodyText: "Message entièrement fictif pour la recette de preview.",
      replyRef: `fixture:reply:${String(index).padStart(6, "0")}`,
      issuedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 5 * 60 * 1000).toISOString(),
    },
  });
  const command = verifyCommunicationWebmailDeliveryToken({
    token: commandToken,
    institutionId,
    secret: secrets.deliverySecret,
    now,
  });
  assert.ok(command);
  return {
    institutionId,
    commandToken,
    deliverySecret: secrets.deliverySecret,
    receiptSecret: secrets.receiptSecret,
    state: {
      delivery: {
        institutionId,
        deliveryId: command.deliveryId,
        status: "queued",
        resolutionHash: command.resolutionHash,
        commandHash: command.commandHash,
        idempotencyKeyHash: command.idempotencyKeyHash,
        providerMessageRef: null,
        webmailReceiptHash: null,
        sentAt: null,
      },
      job: { deliveryId: command.deliveryId, jobType: "send_delivery", status: "running" },
    },
  };
}

if (!process.argv.includes("--preview-only")) {
  throw new Error("webmail_fixture_preview_flag_required");
}

const target = assertCommunicationWebmailNetworkPreviewTarget({
  endpoint: process.env.PREVIEW_WEBMAIL_FIXTURE_ENDPOINT,
  expectedHost: process.env.EXPECTED_WEBMAIL_FIXTURE_HOST,
  runId: process.env.PREVIEW_WEBMAIL_NETWORK_RUN_ID,
  confirmation: process.env.CONFIRM_PREVIEW_WEBMAIL_NETWORK_RECIPE,
  previewOnly: true,
});
const secrets = assertCommunicationWebmailNetworkPreviewSecrets({
  bearerToken: process.env.PREVIEW_WEBMAIL_BEARER_TOKEN,
  deliverySecret: process.env.PREVIEW_WEBMAIL_DELIVERY_SECRET,
  receiptSecret: process.env.PREVIEW_WEBMAIL_RECEIPT_SECRET,
  proofSecret: process.env.PREVIEW_WEBMAIL_FIXTURE_PROOF_SECRET,
});
const now = new Date();
await verifyFixture(target, secrets, now);

const items = Array.from({ length: 200 }, (_, index) => fixtureItem(index + 1, now, secrets));
const transport = createCommunicationWebmailHttpTransport({
  endpoint: target.endpoint,
  bearerToken: secrets.bearerToken,
});
const accepted = await runCommunicationWebmailDeliveryBatch({
  items,
  transport,
  concurrency: 10,
  timeoutMs: 10_000,
});
assert.equal(accepted.length, 200);
assert.equal(accepted.every((result) => result.ok && !result.decision.duplicate), true);
assert.equal(new Set(accepted.map((result) => result.decision.providerMessageRef)).size, 200);

const replayItems = items.slice(0, 20).map((item, index) => {
  const first = accepted[index];
  assert.equal(first.ok, true);
  return {
    ...item,
    state: {
      delivery: {
        ...item.state.delivery,
        status: "sent",
        providerMessageRef: first.decision.providerMessageRef,
        webmailReceiptHash: first.decision.webmailReceiptHash,
        sentAt: first.decision.sentAt,
      },
      job: {
        ...item.state.job,
        jobType: "retry_delivery",
      },
    },
  };
});
const replayed = await runCommunicationWebmailDeliveryBatch({
  items: replayItems,
  transport,
  concurrency: 5,
  timeoutMs: 10_000,
});
assert.equal(replayed.length, 20);
assert.equal(replayed.every((result) => result.ok && result.decision.duplicate), true);

const serialized = JSON.stringify([...accepted, ...replayed]).toLowerCase();
for (const marker of ["@", "mailto:", "gmail", "ac-creteil", "recipient", "address", "audience"]) {
  assert.equal(serialized.includes(marker), false);
}

console.log(JSON.stringify({
  target: "isolated_webmail_fixture",
  runId: target.runId,
  accepted: accepted.length,
  duplicates: replayed.length,
  contacts: "opaque_fictitious_only",
  residue: "fixture_cleanup_required",
}));
