import assert from "node:assert/strict";
import test from "node:test";
import {
  verifyCommunicationWebmailDeliveryToken,
} from "../shared/communication-webmail-delivery.ts";
import {
  createCommunicationWebmailDeliveryReceiptToken,
} from "../shared/communication-webmail-receipt.ts";
import {
  COMMUNICATION_WEBMAIL_FIXTURE_PURPOSE,
  createCommunicationWebmailFixtureProof,
} from "./communication-webmail-network-fixture-proof.mjs";

const host = "lyceegest-webmail-fixture-a1b2c3d4-safe-scol.vercel.app";
const endpoint = `https://${host}/api/communications/deliveries`;
const challengeEndpoint = `https://${host}/api/fixture/challenge`;
const runId = "webmail-network-20260902-abcdef123456";
const institutionId = "11dc4154-9fe3-4624-93b7-34e7feb944b0";
const secrets = {
  bearerToken: "a".repeat(43),
  deliverySecret: "b".repeat(43),
  receiptSecret: "c".repeat(43),
  proofSecret: "d".repeat(43),
  providerHashingSecret: "e".repeat(43),
};

test("runs the complete 200 plus 20 network recipe against a signed in-memory fixture", async () => {
  const previousFetch = globalThis.fetch;
  const previousLog = console.log;
  const previousEnvironment = { ...process.env };
  let challenges = 0;
  let deliveries = 0;
  const deliveryIds = new Set();
  const output = [];

  process.env.PREVIEW_WEBMAIL_FIXTURE_ENDPOINT = endpoint;
  process.env.EXPECTED_WEBMAIL_FIXTURE_HOST = host;
  process.env.PREVIEW_WEBMAIL_NETWORK_RUN_ID = runId;
  process.env.CONFIRM_PREVIEW_WEBMAIL_NETWORK_RECIPE = `${runId}@${host}`;
  process.env.PREVIEW_WEBMAIL_BEARER_TOKEN = secrets.bearerToken;
  process.env.PREVIEW_WEBMAIL_DELIVERY_SECRET = secrets.deliverySecret;
  process.env.PREVIEW_WEBMAIL_RECEIPT_SECRET = secrets.receiptSecret;
  process.env.PREVIEW_WEBMAIL_FIXTURE_PROOF_SECRET = secrets.proofSecret;

  console.log = (value) => output.push(String(value));
  globalThis.fetch = async (url, init) => {
    assert.equal(init.method, "POST");
    assert.equal(init.redirect, "error");
    assert.equal(init.credentials, "omit");
    assert.equal(init.cache, "no-store");
    assert.equal(init.headers.authorization, `Bearer ${secrets.bearerToken}`);
    assert.equal(init.signal.aborted, false);
    const body = JSON.parse(init.body);
    if (url === challengeEndpoint) {
      challenges += 1;
      assert.deepEqual(Object.keys(body).sort(), ["challenge", "purpose", "runId", "v"]);
      assert.equal(body.v, 1);
      assert.equal(body.purpose, COMMUNICATION_WEBMAIL_FIXTURE_PURPOSE);
      assert.equal(body.runId, runId);
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      return Response.json({
        v: 1,
        purpose: COMMUNICATION_WEBMAIL_FIXTURE_PURPOSE,
        runId,
        challenge: body.challenge,
        expiresAt,
        proof: createCommunicationWebmailFixtureProof({
          runId,
          challenge: body.challenge,
          expiresAt,
          proofSecret: secrets.proofSecret,
        }),
      });
    }
    assert.equal(url, endpoint);
    deliveries += 1;
    assert.deepEqual(Object.keys(body), ["commandToken"]);
    const now = new Date();
    const command = verifyCommunicationWebmailDeliveryToken({
      token: body.commandToken,
      institutionId,
      secret: secrets.deliverySecret,
      now,
    });
    assert.ok(command);
    const serialized = JSON.stringify(command).toLowerCase();
    for (const marker of ["@", "mailto:", "gmail", "ac-creteil", "recipient", "address", "audience"]) {
      assert.equal(serialized.includes(marker), false);
    }
    deliveryIds.add(command.deliveryId);
    return Response.json({
      receiptToken: createCommunicationWebmailDeliveryReceiptToken({
        command,
        outcome: "accepted",
        providerMessageId: `fixture-${command.deliveryId}`,
        receiptSecret: secrets.receiptSecret,
        providerHashingSecret: secrets.providerHashingSecret,
        acceptedAt: now,
        now,
      }),
    });
  };

  try {
    await import(`./test-preview-communication-webmail-network.mjs?local=${Date.now()}`);
  } finally {
    globalThis.fetch = previousFetch;
    console.log = previousLog;
    for (const name of Object.keys(process.env)) {
      if (!(name in previousEnvironment)) delete process.env[name];
    }
    Object.assign(process.env, previousEnvironment);
  }

  assert.equal(challenges, 1);
  assert.equal(deliveries, 220);
  assert.equal(deliveryIds.size, 200);
  assert.equal(output.length, 1);
  assert.deepEqual(JSON.parse(output[0]), {
    target: "isolated_webmail_fixture",
    runId,
    accepted: 200,
    duplicates: 20,
    contacts: "opaque_fictitious_only",
    residue: "fixture_cleanup_required",
  });
});

