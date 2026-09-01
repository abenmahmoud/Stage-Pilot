import assert from "node:assert/strict";
import test from "node:test";
import {
  createCommunicationWebmailDeliveryToken,
  verifyCommunicationWebmailDeliveryToken,
} from "../shared/communication-webmail-delivery.ts";
import { createCommunicationWebmailDeliveryReceiptToken } from "../shared/communication-webmail-receipt.ts";
import {
  CommunicationWebmailTransportError,
  createCommunicationWebmailHttpTransport,
  runCommunicationWebmailDelivery,
  runCommunicationWebmailDeliveryBatch,
} from "../shared/communication-webmail-client.ts";

const now = new Date("2026-08-30T15:00:00.000Z");
const institutionId = "11dc4154-9fe3-4624-93b7-34e7feb944b0";
const deliverySecret = "webmail-command-test-secret-with-32-characters";
const receiptSecret = "webmail-receipt-test-secret-with-32-characters";
const providerHashingSecret = "provider-hashing-test-secret-with-32-characters";

function item(index = 1) {
  const suffix = String(index).padStart(12, "0");
  const commandToken = createCommunicationWebmailDeliveryToken({
    institutionId,
    secret: deliverySecret,
    now,
    command: {
      v: 1,
      institutionId,
      deliveryId: `90890f16-f354-484d-88e9-${suffix}`,
      communicationId: "2423e6c2-bf87-43df-8149-c6ef6f168622",
      versionId: "b8f4c471-105c-456b-ab22-2e46dfb90b3c",
      version: 2,
      contactRef: `contact:${String(index).padStart(8, "0")}`,
      resolutionHash: "a".repeat(64),
      idempotencyKeyHash: index.toString(16).padStart(64, "0"),
      visibility: "internal",
      canonicalPath: "/informations/rentree-professeurs",
      linkMode: "authenticated",
      subject: "Informations de rentrée",
      preheader: "Les informations utiles sont disponibles.",
      bodyText: "Bonjour,\n\nConsultez la version à jour sur le portail du lycée.",
      replyRef: `reply:communication-${String(index).padStart(4, "0")}`,
      issuedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 5 * 60 * 1000).toISOString(),
    },
  });
  const command = verifyCommunicationWebmailDeliveryToken({ token: commandToken, institutionId, secret: deliverySecret, now });
  assert.ok(command);
  return {
    institutionId,
    commandToken,
    deliverySecret,
    receiptSecret,
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

function acceptingTransport(outcome = "accepted") {
  return async ({ commandToken }) => {
    const command = verifyCommunicationWebmailDeliveryToken({ token: commandToken, institutionId, secret: deliverySecret, now });
    assert.ok(command);
    return {
      receiptToken: createCommunicationWebmailDeliveryReceiptToken({
        command,
        outcome,
        providerMessageId: `<message-${command.deliveryId}@example.invalid>`,
        receiptSecret,
        providerHashingSecret,
        acceptedAt: now,
        now,
      }),
    };
  };
}

function httpTransport(fetchImpl, overrides = {}) {
  return createCommunicationWebmailHttpTransport({
    endpoint: "https://webmail.preview.example.test/api/communications/deliveries",
    bearerToken: "preview-webmail-bearer-token-with-32-characters",
    fetchImpl,
    ...overrides,
  });
}

test("verifies the receipt before returning a completion decision", async () => {
  const result = await runCommunicationWebmailDelivery({
    item: item(),
    transport: acceptingTransport(),
    now,
  });
  assert.equal(result.ok, true);
  assert.equal(result.decision.nextDeliveryStatus, "sent");
});

test("posts one opaque command to the configured HTTPS Webmail endpoint", async () => {
  let requestCount = 0;
  const transport = httpTransport(async (url, init) => {
    requestCount += 1;
    assert.equal(url, "https://webmail.preview.example.test/api/communications/deliveries");
    assert.equal(init.method, "POST");
    assert.equal(init.redirect, "error");
    assert.equal(init.credentials, "omit");
    assert.equal(init.cache, "no-store");
    assert.equal(init.headers.authorization, "Bearer preview-webmail-bearer-token-with-32-characters");
    const body = JSON.parse(init.body);
    assert.deepEqual(Object.keys(body), ["commandToken"]);
    const command = verifyCommunicationWebmailDeliveryToken({
      token: body.commandToken,
      institutionId,
      secret: deliverySecret,
      now,
    });
    assert.ok(command);
    const receiptToken = createCommunicationWebmailDeliveryReceiptToken({
      command,
      outcome: "accepted",
      providerMessageId: `<message-${command.deliveryId}@example.invalid>`,
      receiptSecret,
      providerHashingSecret,
      acceptedAt: now,
      now,
    });
    return new Response(JSON.stringify({ receiptToken }), {
      status: 200,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  });
  const result = await runCommunicationWebmailDelivery({ item: item(), transport, now });
  assert.equal(requestCount, 1);
  assert.equal(result.ok, true);
  assert.equal(result.decision.nextDeliveryStatus, "sent");
});

test("rejects unsafe endpoint and credential configuration before any request", () => {
  const options = {
    bearerToken: "preview-webmail-bearer-token-with-32-characters",
    fetchImpl: async () => { throw new Error("must_not_run"); },
  };
  for (const endpoint of [
    "http://webmail.preview.example.test/api/deliveries",
    "https://127.0.0.1/api/deliveries",
    "https://localhost./api/deliveries",
    "https://webmail.internal/api/deliveries",
    "https://webmail.internal./api/deliveries",
    "https://webmail.preview.example.test./api/deliveries",
    "https://webmail.preview.example.test/",
    "https://user:password@webmail.preview.example.test/api/deliveries",
    "https://webmail.preview.example.test/api/deliveries?target=other",
  ]) {
    assert.throws(() => createCommunicationWebmailHttpTransport({ ...options, endpoint }), /webmail_endpoint_invalid/);
  }
  assert.throws(() => createCommunicationWebmailHttpTransport({
    endpoint: "https://webmail.preview.example.test/api/deliveries",
    bearerToken: "short",
  }), /webmail_bearer_token_invalid/);
});

test("fails closed on oversized, non-JSON and unexpected Webmail responses", async () => {
  const valid = item();
  const cases = [
    new Response(JSON.stringify({ receiptToken: "x".repeat(500) }), {
      status: 200,
      headers: { "content-type": "application/json", "content-length": "100000" },
    }),
    new Response("not json", { status: 200, headers: { "content-type": "text/plain" } }),
    new Response(JSON.stringify({ receiptToken: "invalid", providerText: "must not escape" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  ];
  for (const response of cases) {
    const result = await runCommunicationWebmailDelivery({
      item: valid,
      transport: httpTransport(async () => response.clone(), { maxResponseBytes: 256 }),
      now,
    });
    assert.deepEqual(result, { ok: false, failureCode: "scope_invalid" });
    assert.equal(JSON.stringify(result).includes("providerText"), false);
  }
});

test("maps HTTP status without reading or retaining the provider error body", async () => {
  const result = await runCommunicationWebmailDelivery({
    item: item(),
    transport: httpTransport(async () => new Response("internal provider detail", {
      status: 503,
      headers: { "content-type": "text/plain", "content-length": "24" },
    })),
    now,
  });
  assert.deepEqual(result, { ok: false, failureCode: "provider_unavailable" });
  assert.equal(JSON.stringify(result).includes("internal provider detail"), false);
});

test("cancels rejected response streams before returning a closed failure", async () => {
  const cases = [
    { status: 503, contentType: "text/plain", contentLength: undefined },
    { status: 200, contentType: "text/plain", contentLength: undefined },
    { status: 200, contentType: "application/json", contentLength: "25000" },
  ];
  for (const current of cases) {
    let canceled = false;
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("provider detail"));
      },
      cancel() {
        canceled = true;
      },
    });
    const headers = { "content-type": current.contentType };
    if (current.contentLength) headers["content-length"] = current.contentLength;
    const result = await runCommunicationWebmailDelivery({
      item: item(),
      transport: httpTransport(async () => new Response(body, {
        status: current.status,
        headers,
      })),
      now,
    });
    assert.equal(result.ok, false);
    assert.equal(canceled, true);
  }
});

test("fails closed for an invalid command, response or receipt", async () => {
  const valid = item();
  const invalidCommand = await runCommunicationWebmailDelivery({
    item: { ...valid, commandToken: `${valid.commandToken}x` },
    transport: acceptingTransport(),
    now,
  });
  assert.deepEqual(invalidCommand, { ok: false, failureCode: "scope_invalid" });
  const unknownResponse = await runCommunicationWebmailDelivery({
    item: valid,
    transport: async () => ({ receiptToken: "invalid", providerText: "do not persist" }),
    now,
  });
  assert.deepEqual(unknownResponse, { ok: false, failureCode: "scope_invalid" });
  const invalidReceipt = await runCommunicationWebmailDelivery({
    item: valid,
    transport: async () => ({ receiptToken: "invalid" }),
    now,
  });
  assert.deepEqual(invalidReceipt, { ok: false, failureCode: "scope_invalid" });
});

test("maps bounded HTTP failures without retaining provider prose", async () => {
  const expected = new Map([
    [401, "authorization_failed"],
    [404, "configuration_missing"],
    [429, "provider_rate_limited"],
    [503, "provider_unavailable"],
    [422, "provider_rejected"],
  ]);
  for (const [status, failureCode] of expected) {
    const result = await runCommunicationWebmailDelivery({
      item: item(),
      transport: async () => { throw new CommunicationWebmailTransportError(status); },
      now,
    });
    assert.deepEqual(result, { ok: false, failureCode });
    assert.equal(JSON.stringify(result).includes("Webmail transport failed"), false);
  }
});

test("aborts and classifies a transport timeout", async () => {
  let aborted = false;
  const result = await runCommunicationWebmailDelivery({
    item: item(),
    transport: ({ signal }) => new Promise((resolve) => {
      signal.addEventListener("abort", () => {
        aborted = true;
        resolve({ receiptToken: "late" });
      });
    }),
    timeoutMs: 100,
    now,
  });
  assert.equal(aborted, true);
  assert.deepEqual(result, { ok: false, failureCode: "provider_timeout" });
});

test("processes 200 deliveries with bounded concurrency and stable ordering", async () => {
  let active = 0;
  let peak = 0;
  const baseTransport = acceptingTransport();
  const seenContactRefs = new Set();
  const forbiddenRecipientFields = new Set([
    "to", "cc", "bcc", "email", "emails", "address", "addresses",
    "recipient", "recipients", "audience", "members", "contacts",
  ]);
  const transport = async (input) => {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 1));
    try {
      assert.deepEqual(Object.keys(input).sort(), ["commandToken", "signal"]);
      const command = verifyCommunicationWebmailDeliveryToken({
        token: input.commandToken,
        institutionId,
        secret: deliverySecret,
        now,
      });
      assert.ok(command);
      const commandFields = Object.keys(command).map((field) => field.toLowerCase());
      assert.equal(commandFields.some((field) => forbiddenRecipientFields.has(field)), false);
      const serializedCommand = JSON.stringify(command);
      assert.equal(serializedCommand.includes("@"), false);
      assert.equal(serializedCommand.includes("mailto:"), false);
      assert.equal(seenContactRefs.has(command.contactRef), false);
      seenContactRefs.add(command.contactRef);
      return await baseTransport(input);
    } finally {
      active -= 1;
    }
  };
  const results = await runCommunicationWebmailDeliveryBatch({
    items: Array.from({ length: 200 }, (_, index) => item(index + 1)),
    transport,
    concurrency: 10,
    now,
  });
  assert.equal(results.length, 200);
  assert.equal(results.every((result) => result.ok), true);
  assert.equal(peak <= 10, true);
  assert.equal(seenContactRefs.size, 200);
  assert.equal(new Set(results.map((result) => result.decision.providerMessageRef)).size, 200);
  for (const result of results) {
    const serializedResult = JSON.stringify(result).toLowerCase();
    for (const field of forbiddenRecipientFields) {
      assert.equal(serializedResult.includes(`\"${field}\"`), false);
    }
  }
});

test("rejects unsafe batch and worker bounds", async () => {
  await assert.rejects(() => runCommunicationWebmailDeliveryBatch({ items: [], transport: acceptingTransport(), now }), /batch_size_invalid/);
  await assert.rejects(() => runCommunicationWebmailDeliveryBatch({ items: [item()], transport: acceptingTransport(), concurrency: 21, now }), /concurrency_invalid/);
  await assert.rejects(() => runCommunicationWebmailDelivery({ item: item(), transport: acceptingTransport(), timeoutMs: 31_000, now }), /timeout_invalid/);
});
