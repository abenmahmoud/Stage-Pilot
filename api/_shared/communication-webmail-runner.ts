import type { ClaimedCommunicationWebmailJob } from "./communication-job-claim.js";
import type { PersistedCommunicationJobFailure } from "./communication-job-failure.js";
import type { PersistedCommunicationWebmailCompletion } from "./communication-webmail-persistence.js";
import type { CommunicationJobFailureCode } from "../../shared/communication-job-policy.js";
import {
  runCommunicationWebmailDeliveryExchange,
  type CommunicationWebmailClientInput,
  type CommunicationWebmailTransport,
} from "../../shared/communication-webmail-client.js";
import type { VerifiedCommunicationWebmailDeliveryCommand } from "../../shared/communication-webmail-delivery.js";
import type { VerifiedCommunicationWebmailDeliveryReceipt } from "../../shared/communication-webmail-receipt.js";

const MAX_BATCH_SIZE = 20;
const MAX_CONCURRENCY = 20;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type CommunicationWebmailRunnerItem = {
  job: ClaimedCommunicationWebmailJob;
  client: CommunicationWebmailClientInput;
};

export type CommunicationWebmailRunnerResult =
  | {
    jobId: string;
    outcome: "completed";
    deliveryStatus: PersistedCommunicationWebmailCompletion["deliveryStatus"];
    duplicate: boolean;
  }
  | {
    jobId: string;
    outcome: "retry" | "dead";
    failureCode: CommunicationJobFailureCode;
    runAfter: string | null;
  }
  | {
    jobId: string;
    outcome: "unresolved";
    failureCode: "persistence_failed";
  };

export type CommunicationWebmailRunnerPersistence = {
  complete(input: {
    job: ClaimedCommunicationWebmailJob;
    command: VerifiedCommunicationWebmailDeliveryCommand;
    receipt: VerifiedCommunicationWebmailDeliveryReceipt;
    completedAt: Date;
  }): Promise<PersistedCommunicationWebmailCompletion>;
  fail(input: {
    job: ClaimedCommunicationWebmailJob;
    failureCode: CommunicationJobFailureCode;
    failedAt: Date;
  }): Promise<PersistedCommunicationJobFailure>;
};

function validateBatch(input: {
  institutionId: string;
  items: CommunicationWebmailRunnerItem[];
  concurrency: number;
}): void {
  if (!UUID_PATTERN.test(input.institutionId)) throw new Error("institution_scope_invalid");
  if (!Array.isArray(input.items) || input.items.length < 1 || input.items.length > MAX_BATCH_SIZE) {
    throw new Error("runner_batch_size_invalid");
  }
  if (!Number.isInteger(input.concurrency) || input.concurrency < 1 || input.concurrency > MAX_CONCURRENCY) {
    throw new Error("runner_concurrency_invalid");
  }
  const jobIds = new Set<string>();
  const deliveryIds = new Set<string>();
  for (const item of input.items) {
    if (
      !item || !item.job || !item.client ||
      !UUID_PATTERN.test(item.job.jobId) ||
      item.job.institutionId !== input.institutionId ||
      item.client.institutionId !== input.institutionId ||
      item.client.state.delivery.institutionId !== input.institutionId ||
      item.client.state.delivery.deliveryId !== item.job.deliveryId ||
      item.client.state.job.deliveryId !== item.job.deliveryId ||
      item.client.state.job.status !== "running" ||
      item.client.state.job.jobType !== item.job.jobType
    ) {
      throw new Error("runner_item_scope_invalid");
    }
    if (jobIds.has(item.job.jobId) || deliveryIds.has(item.job.deliveryId)) {
      throw new Error("runner_duplicate_item");
    }
    jobIds.add(item.job.jobId);
    deliveryIds.add(item.job.deliveryId);
  }
}

export async function runCommunicationWebmailJobs(input: {
  institutionId: string;
  items: CommunicationWebmailRunnerItem[];
  transport: CommunicationWebmailTransport;
  persistence: CommunicationWebmailRunnerPersistence;
  concurrency?: number;
  timeoutMs?: number;
  now?: Date;
}): Promise<CommunicationWebmailRunnerResult[]> {
  const concurrency = input.concurrency ?? 5;
  const now = input.now ?? new Date();
  if (!Number.isFinite(now.getTime())) throw new Error("runner_time_invalid");
  validateBatch({ institutionId: input.institutionId, items: input.items, concurrency });

  const results = new Array<CommunicationWebmailRunnerResult>(input.items.length);
  let cursor = 0;

  async function processItem(index: number): Promise<void> {
    const item = input.items[index];
    const exchange = await runCommunicationWebmailDeliveryExchange({
      item: item.client,
      transport: input.transport,
      timeoutMs: input.timeoutMs,
      now,
    });
    try {
      if (exchange.ok) {
        const persisted = await input.persistence.complete({
          job: item.job,
          command: exchange.command,
          receipt: exchange.receipt,
          completedAt: now,
        });
        results[index] = {
          jobId: item.job.jobId,
          outcome: "completed",
          deliveryStatus: persisted.deliveryStatus,
          duplicate: persisted.duplicate,
        };
        return;
      }
      const persisted = await input.persistence.fail({
        job: item.job,
        failureCode: exchange.failureCode,
        failedAt: now,
      });
      results[index] = {
        jobId: item.job.jobId,
        outcome: persisted.jobStatus,
        failureCode: exchange.failureCode,
        runAfter: persisted.runAfter,
      };
    } catch {
      // The running lock is intentionally left for the stale-job recovery path.
      results[index] = {
        jobId: item.job.jobId,
        outcome: "unresolved",
        failureCode: "persistence_failed",
      };
    }
  }

  async function worker(): Promise<void> {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= input.items.length) return;
      await processItem(index);
    }
  }

  await Promise.all(Array.from(
    { length: Math.min(concurrency, input.items.length) },
    () => worker()
  ));
  return results;
}
