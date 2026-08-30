import assert from "node:assert/strict";
import test from "node:test";
import {
  createCommunicationWebmailDeliveryToken,
  verifyCommunicationWebmailDeliveryToken,
} from "../shared/communication-webmail-delivery.ts";
import { createCommunicationWebmailDeliveryReceiptToken } from "../shared/communication-webmail-receipt.ts";
import { CommunicationWebmailTransportError } from "../shared/communication-webmail-client.ts";
import { runCommunicationWebmailJobs } from "../api/_shared/communication-webmail-runner.ts";

const now = new Date("2026-08-30T18:00:00.000Z");
const institutionId = "11dc4154-9fe3-4624-93b7-34e7feb944b0";
const deliverySecret = "runner-command-test-secret-with-32-characters";
const receiptSecret = "runner-receipt-test-secret-with-32-characters";
const providerHashingSecret = "runner-provider-test-secret-with-32-characters";

function runnerItem(index = 1) {
  const suffix = String(index).padStart(12, "0");
  const deliveryId = `90890f16-f354-484d-88e9-${suffix}`;
  const jobId = `a2380f16-f354-484d-88e9-${suffix}`;
  const commandToken = createCommunicationWebmailDeliveryToken({
    institutionId,
    secret: deliverySecret,
    now,
    command: {
      v: 1,
      institutionId,
      deliveryId,
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
  const command = verifyCommunicationWebmailDeliveryToken({
    token: commandToken,
    institutionId,
    secret: deliverySecret,
    now,
  });
  assert.ok(command);
  return {
    job: {
      jobId,
      institutionId,
      communicationId: command.communicationId,
      versionId: command.versionId,
      version: command.version,
      deliveryId,
      jobType: "send_delivery",
      attemptCount: 0,
      lockedAt: now.toISOString(),
    },
    client: {
      institutionId,
      commandToken,
      deliverySecret,
      receiptSecret,
      state: {
        delivery: {
          institutionId,
          deliveryId,
          status: "queued",
          resolutionHash: command.resolutionHash,
          commandHash: command.commandHash,
          idempotencyKeyHash: command.idempotencyKeyHash,
          providerMessageRef: null,
          webmailReceiptHash: null,
          sentAt: null,
        },
        job: { deliveryId, jobType: "send_delivery", status: "running" },
      },
    },
  };
}

function acceptingTransport(delayMs = 0) {
  return async ({ commandToken }) => {
    if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs));
    const command = verifyCommunicationWebmailDeliveryToken({
      token: commandToken,
      institutionId,
      secret: deliverySecret,
      now,
    });
    assert.ok(command);
    return {
      receiptToken: createCommunicationWebmailDeliveryReceiptToken({
        command,
        outcome: "accepted",
        providerMessageId: `<runner-${command.deliveryId}@example.invalid>`,
        receiptSecret,
        providerHashingSecret,
        acceptedAt: now,
        now,
      }),
    };
  };
}

function persistence(overrides = {}) {
  return {
    complete: overrides.complete ?? (async () => ({
      accepted: true,
      duplicate: false,
      deliveryStatus: "sent",
      jobStatus: "completed",
    })),
    fail: overrides.fail ?? (async () => ({
      accepted: true,
      jobStatus: "retry",
      attemptCount: 1,
      runAfter: new Date(now.getTime() + 60_000).toISOString(),
      showInFailureInbox: false,
    })),
  };
}

test("persists an exact verified command and receipt after acceptance", async () => {
  let completed;
  const results = await runCommunicationWebmailJobs({
    institutionId,
    items: [runnerItem()],
    transport: acceptingTransport(),
    persistence: persistence({ complete: async (input) => {
      completed = input;
      return { accepted: true, duplicate: false, deliveryStatus: "sent", jobStatus: "completed" };
    } }),
    now,
  });
  assert.equal(completed.command.deliveryId, completed.job.deliveryId);
  assert.equal(completed.receipt.commandHash, completed.command.commandHash);
  assert.deepEqual(results, [{
    jobId: completed.job.jobId,
    outcome: "completed",
    deliveryStatus: "sent",
    duplicate: false,
  }]);
});

test("persists a closed failure code instead of provider prose", async () => {
  let failed;
  const item = runnerItem();
  const results = await runCommunicationWebmailJobs({
    institutionId,
    items: [item],
    transport: async () => { throw new CommunicationWebmailTransportError(503); },
    persistence: persistence({ fail: async (input) => {
      failed = input;
      return {
        accepted: true,
        jobStatus: "retry",
        attemptCount: 1,
        runAfter: new Date(now.getTime() + 60_000).toISOString(),
        showInFailureInbox: false,
      };
    } }),
    now,
  });
  assert.equal(failed.failureCode, "provider_unavailable");
  assert.equal(JSON.stringify(results).includes("Webmail transport failed"), false);
  assert.equal(results[0].outcome, "retry");
});

test("leaves a persistence failure for stale-lock recovery without sending again", async () => {
  let failedCalls = 0;
  const results = await runCommunicationWebmailJobs({
    institutionId,
    items: [runnerItem()],
    transport: acceptingTransport(),
    persistence: persistence({
      complete: async () => { throw new Error("private database detail"); },
      fail: async () => { failedCalls += 1; throw new Error("must not run"); },
    }),
    now,
  });
  assert.equal(failedCalls, 0);
  assert.equal(results[0].outcome, "unresolved");
  assert.equal(JSON.stringify(results).includes("private database detail"), false);
});

test("processes a claimed batch with bounded concurrency and stable ordering", async () => {
  let active = 0;
  let peak = 0;
  const transport = acceptingTransport(2);
  const measuredTransport = async (input) => {
    active += 1;
    peak = Math.max(peak, active);
    try {
      return await transport(input);
    } finally {
      active -= 1;
    }
  };
  const items = Array.from({ length: 20 }, (_, index) => runnerItem(index + 1));
  const results = await runCommunicationWebmailJobs({
    institutionId,
    items,
    transport: measuredTransport,
    persistence: persistence(),
    concurrency: 4,
    now,
  });
  assert.equal(peak <= 4, true);
  assert.deepEqual(results.map((result) => result.jobId), items.map((item) => item.job.jobId));
  assert.equal(results.every((result) => result.outcome === "completed"), true);
});

test("rejects cross-scope, duplicate and oversized batches before transport", async () => {
  let calls = 0;
  const transport = async () => { calls += 1; return {}; };
  const duplicate = runnerItem();
  await assert.rejects(() => runCommunicationWebmailJobs({
    institutionId,
    items: [duplicate, duplicate],
    transport,
    persistence: persistence(),
    now,
  }), /runner_duplicate_item/);
  const crossScope = runnerItem();
  crossScope.job.institutionId = "21dc4154-9fe3-4624-93b7-34e7feb944b0";
  await assert.rejects(() => runCommunicationWebmailJobs({
    institutionId,
    items: [crossScope],
    transport,
    persistence: persistence(),
    now,
  }), /runner_item_scope_invalid/);
  await assert.rejects(() => runCommunicationWebmailJobs({
    institutionId,
    items: Array.from({ length: 21 }, (_, index) => runnerItem(index + 1)),
    transport,
    persistence: persistence(),
    now,
  }), /runner_batch_size_invalid/);
  assert.equal(calls, 0);
});
