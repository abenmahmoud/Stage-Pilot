import type { CommunicationJobFailureCode } from "./communication-job-policy.js";
import {
  verifyCommunicationWebmailDeliveryToken,
} from "./communication-webmail-delivery.js";
import type { VerifiedCommunicationWebmailDeliveryCommand } from "./communication-webmail-delivery.js";
import {
  verifyCommunicationWebmailDeliveryReceiptToken,
} from "./communication-webmail-receipt.js";
import type { VerifiedCommunicationWebmailDeliveryReceipt } from "./communication-webmail-receipt.js";
import {
  planCommunicationWebmailCompletion,
  type CommunicationWebmailCompletionDecision,
  type CommunicationWebmailCompletionState,
} from "./communication-webmail-completion.js";

const MAX_BATCH_SIZE = 500;
const MAX_CONCURRENCY = 20;
const MIN_TIMEOUT_MS = 100;
const MAX_TIMEOUT_MS = 30_000;
const RESPONSE_FIELDS = new Set(["receiptToken"]);

export type CommunicationWebmailTransport = (input: {
  commandToken: string;
  signal: AbortSignal;
}) => Promise<unknown>;

export type CommunicationWebmailClientInput = {
  institutionId: string;
  commandToken: string;
  deliverySecret: string | undefined;
  receiptSecret: string | undefined;
  state: CommunicationWebmailCompletionState;
};

export type CommunicationWebmailClientResult =
  | {
    ok: true;
    decision: CommunicationWebmailCompletionDecision;
  }
  | {
    ok: false;
    failureCode: CommunicationJobFailureCode;
  };

export type CommunicationWebmailExchangeResult =
  | {
    ok: true;
    decision: CommunicationWebmailCompletionDecision;
    command: VerifiedCommunicationWebmailDeliveryCommand;
    receipt: VerifiedCommunicationWebmailDeliveryReceipt;
  }
  | {
    ok: false;
    failureCode: CommunicationJobFailureCode;
  };

export class CommunicationWebmailTransportError extends Error {
  readonly status: number;

  constructor(status: number) {
    super("Webmail transport failed");
    this.status = status;
  }
}

class CommunicationWebmailTimeoutError extends Error {}

function failureCode(error: unknown): CommunicationJobFailureCode {
  if (error instanceof CommunicationWebmailTimeoutError) return "provider_timeout";
  if (error instanceof CommunicationWebmailTransportError) {
    if (error.status === 401 || error.status === 403) return "authorization_failed";
    if (error.status === 404) return "configuration_missing";
    if (error.status === 429) return "provider_rate_limited";
    if (error.status >= 500 && error.status <= 599) return "provider_unavailable";
    return "provider_rejected";
  }
  if (error instanceof TypeError) return "network_error";
  return "unknown_failure";
}

function receiptToken(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("response_invalid");
  const response = value as Record<string, unknown>;
  if (Object.keys(response).some((key) => !RESPONSE_FIELDS.has(key))) throw new Error("response_invalid");
  if (typeof response.receiptToken !== "string" || response.receiptToken.length > 16 * 1024) {
    throw new Error("receipt_invalid");
  }
  return response.receiptToken;
}

function validTimeout(value: number): number {
  if (!Number.isInteger(value) || value < MIN_TIMEOUT_MS || value > MAX_TIMEOUT_MS) {
    throw new Error("timeout_invalid");
  }
  return value;
}

export async function runCommunicationWebmailDeliveryExchange(input: {
  item: CommunicationWebmailClientInput;
  transport: CommunicationWebmailTransport;
  timeoutMs?: number;
  now?: Date;
}): Promise<CommunicationWebmailExchangeResult> {
  const now = input.now ?? new Date();
  const timeoutMs = validTimeout(input.timeoutMs ?? 10_000);
  const command = verifyCommunicationWebmailDeliveryToken({
    token: input.item.commandToken,
    institutionId: input.item.institutionId,
    secret: input.item.deliverySecret,
    now,
  });
  if (!command) return { ok: false, failureCode: "scope_invalid" };

  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new CommunicationWebmailTimeoutError());
        controller.abort();
      }, timeoutMs);
    });
    const response = await Promise.race([
      input.transport({ commandToken: input.item.commandToken, signal: controller.signal }),
      timeout,
    ]);
    if (controller.signal.aborted) throw new CommunicationWebmailTimeoutError();
    const receipt = verifyCommunicationWebmailDeliveryReceiptToken({
      token: receiptToken(response),
      command,
      receiptSecret: input.item.receiptSecret,
      now,
    });
    if (!receipt) return { ok: false, failureCode: "scope_invalid" };
    try {
      return {
        ok: true,
        decision: planCommunicationWebmailCompletion({ state: input.item.state, command, receipt }),
        command,
        receipt,
      };
    } catch {
      return { ok: false, failureCode: "scope_invalid" };
    }
  } catch (error) {
    if (error instanceof Error && /response_invalid|receipt_invalid/.test(error.message)) {
      return { ok: false, failureCode: "scope_invalid" };
    }
    return { ok: false, failureCode: failureCode(error) };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function runCommunicationWebmailDelivery(input: {
  item: CommunicationWebmailClientInput;
  transport: CommunicationWebmailTransport;
  timeoutMs?: number;
  now?: Date;
}): Promise<CommunicationWebmailClientResult> {
  const result = await runCommunicationWebmailDeliveryExchange(input);
  if (!result.ok) return result;
  return { ok: true, decision: result.decision };
}

export async function runCommunicationWebmailDeliveryBatch(input: {
  items: CommunicationWebmailClientInput[];
  transport: CommunicationWebmailTransport;
  concurrency?: number;
  timeoutMs?: number;
  now?: Date;
}): Promise<CommunicationWebmailClientResult[]> {
  if (!Array.isArray(input.items) || input.items.length < 1 || input.items.length > MAX_BATCH_SIZE) {
    throw new Error("batch_size_invalid");
  }
  const concurrency = input.concurrency ?? 10;
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > MAX_CONCURRENCY) {
    throw new Error("concurrency_invalid");
  }
  validTimeout(input.timeoutMs ?? 10_000);
  const results = new Array<CommunicationWebmailClientResult>(input.items.length);
  let cursor = 0;

  async function worker(): Promise<void> {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= input.items.length) return;
      results[index] = await runCommunicationWebmailDelivery({
        item: input.items[index],
        transport: input.transport,
        timeoutMs: input.timeoutMs,
        now: input.now,
      });
    }
  }

  await Promise.all(Array.from(
    { length: Math.min(concurrency, input.items.length) },
    () => worker()
  ));
  return results;
}
