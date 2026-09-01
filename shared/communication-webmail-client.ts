import type { CommunicationJobFailureCode } from "./communication-job-policy.js";
import { isIP } from "node:net";
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
const MAX_COMMAND_TOKEN_BYTES = 16 * 1024;
const MAX_HTTP_RESPONSE_BYTES = 24 * 1024;
const MIN_BEARER_TOKEN_LENGTH = 32;
const MAX_BEARER_TOKEN_LENGTH = 1024;
const MAX_ENDPOINT_LENGTH = 2048;
const RESPONSE_FIELDS = new Set(["receiptToken"]);
const JSON_CONTENT_TYPE_PATTERN = /^application\/(?:[a-z0-9!#$&^_.+-]+\+)?json(?:\s*;|$)/i;

export type CommunicationWebmailTransport = (input: {
  commandToken: string;
  signal: AbortSignal;
}) => Promise<unknown>;

export type CommunicationWebmailHttpTransportOptions = {
  endpoint: string | undefined;
  bearerToken: string | undefined;
  fetchImpl?: typeof fetch;
  maxResponseBytes?: number;
};

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

function validatedHttpEndpoint(value: string | undefined): string {
  if (typeof value !== "string" || value.length < 1 || value.length > MAX_ENDPOINT_LENGTH) {
    throw new Error("webmail_endpoint_invalid");
  }
  let endpoint: URL;
  try {
    endpoint = new URL(value);
  } catch {
    throw new Error("webmail_endpoint_invalid");
  }
  const hostname = endpoint.hostname.toLowerCase();
  if (
    endpoint.protocol !== "https:" ||
    endpoint.username !== "" ||
    endpoint.password !== "" ||
    endpoint.search !== "" ||
    endpoint.hash !== "" ||
    endpoint.pathname === "/" ||
    isIP(hostname) !== 0 ||
    !hostname.includes(".") ||
    hostname.endsWith(".") ||
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  ) {
    throw new Error("webmail_endpoint_invalid");
  }
  return endpoint.toString();
}

function validatedBearerToken(value: string | undefined): string {
  if (
    typeof value !== "string" ||
    value.length < MIN_BEARER_TOKEN_LENGTH ||
    value.length > MAX_BEARER_TOKEN_LENGTH ||
    /[^A-Za-z0-9._~-]/.test(value)
  ) {
    throw new Error("webmail_bearer_token_invalid");
  }
  return value;
}

function validatedResponseLimit(value: number | undefined): number {
  const limit = value ?? MAX_HTTP_RESPONSE_BYTES;
  if (!Number.isInteger(limit) || limit < 256 || limit > MAX_HTTP_RESPONSE_BYTES) {
    throw new Error("webmail_response_limit_invalid");
  }
  return limit;
}

function discardResponseBody(response: Response): void {
  if (!response.body) return;
  void response.body.cancel().catch(() => undefined);
}

async function readBoundedJsonResponse(response: Response, maxBytes: number): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!JSON_CONTENT_TYPE_PATTERN.test(contentType)) {
    discardResponseBody(response);
    throw new Error("response_invalid");
  }
  const declaredLength = response.headers.get("content-length");
  if (declaredLength !== null && (!/^\d+$/.test(declaredLength) || Number(declaredLength) > maxBytes)) {
    discardResponseBody(response);
    throw new Error("response_invalid");
  }
  if (!response.body) throw new Error("response_invalid");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new Error("response_invalid");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new Error("response_invalid");
  }
}

export function createCommunicationWebmailHttpTransport(
  options: CommunicationWebmailHttpTransportOptions
): CommunicationWebmailTransport {
  const endpoint = validatedHttpEndpoint(options.endpoint);
  const bearerToken = validatedBearerToken(options.bearerToken);
  const maxResponseBytes = validatedResponseLimit(options.maxResponseBytes);
  const fetchImpl = options.fetchImpl ?? fetch;

  return async ({ commandToken, signal }) => {
    if (
      typeof commandToken !== "string" ||
      commandToken.length < 1 ||
      Buffer.byteLength(commandToken, "utf8") > MAX_COMMAND_TOKEN_BYTES
    ) {
      throw new Error("response_invalid");
    }
    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${bearerToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ commandToken }),
      cache: "no-store",
      credentials: "omit",
      redirect: "error",
      signal,
    });
    if (!response.ok) {
      discardResponseBody(response);
      throw new CommunicationWebmailTransportError(response.status);
    }
    return readBoundedJsonResponse(response, maxResponseBytes);
  };
}

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
