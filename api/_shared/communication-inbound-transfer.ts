import { createHash, createHmac } from "node:crypto";
import {
  COMMUNICATION_INBOUND_CONTENT_LIMITS,
  COMMUNICATION_INBOUND_MEDIA_TYPES,
  communicationInboundObjectStoragePath,
  parseCommunicationInboundQuarantineConfirmation,
  type CommunicationInboundMediaType,
  type CommunicationInboundQuarantineConfirmation,
} from "../../shared/communication-inbound-content-policy.js";

const BREVO_ATTACHMENT_ENDPOINT = "https://api.brevo.com/v3/inbound/attachments/";
const QUARANTINE_BUCKET = "communication-inbound-quarantine";
const CLEAN_BUCKET = "communication-inbound-clean";
const MEDIA_TYPES = new Set<string>(COMMUNICATION_INBOUND_MEDIA_TYPES);
const MAX_BYTES = COMMUNICATION_INBOUND_CONTENT_LIMITS.objectBytes;

type TransferFailure =
  | "configuration_invalid" | "input_invalid" | "transfer_timeout"
  | "transfer_unavailable" | "provider_authorization_failed" | "provider_not_found"
  | "provider_rate_limited" | "provider_rejected" | "redirect_refused"
  | "content_size_invalid" | "content_media_invalid" | "content_digest_mismatch"
  | "storage_write_failed" | "storage_read_failed";

export class CommunicationInboundTransferError extends Error {
  readonly code: TransferFailure;

  constructor(code: TransferFailure) {
    super(code);
    this.name = "CommunicationInboundTransferError";
    this.code = code;
  }
}

export type CommunicationDownloadedAttachment = {
  // The caller owns this buffer and releases it after private storage or failure.
  bytes: Uint8Array;
  mediaType: CommunicationInboundMediaType;
  sizeBytes: number;
  sha256: string;
};

function fail(code: TransferFailure): never {
  throw new CommunicationInboundTransferError(code);
}

function key(value: unknown): string {
  if (typeof value !== "string" || value.length < 32 || value.length > 2048
    || /[^\x21-\x7e]/u.test(value)) fail("configuration_invalid");
  return value;
}

function timeout(value: number | undefined): number {
  const ms = value ?? 20_000;
  if (!Number.isInteger(ms) || ms < 100 || ms > 30_000) fail("configuration_invalid");
  return ms;
}

function discard(response: Response): void {
  if (response.body) void response.body.cancel().catch(() => undefined);
}

function abortable<T>(pending: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const aborted = () => reject(new CommunicationInboundTransferError("transfer_timeout"));
    signal.addEventListener("abort", aborted, { once: true });
    if (signal.aborted) aborted();
    pending.then(resolve, reject).finally(() => signal.removeEventListener("abort", aborted));
  });
}

async function deadline<T>(ms: number, work: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await abortable(work(controller.signal), controller.signal);
  } catch (error) {
    if (controller.signal.aborted) fail("transfer_timeout");
    if (error instanceof CommunicationInboundTransferError) throw error;
    fail("transfer_unavailable");
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}

async function request(
  fetchImpl: typeof fetch, url: string, init: RequestInit, signal: AbortSignal
): Promise<Response> {
  return abortable(fetchImpl(url, {
    ...init, signal, cache: "no-store", credentials: "omit", redirect: "error",
  }).then((response) => {
    if (signal.aborted) {
      discard(response);
      fail("transfer_timeout");
    }
    if (response.redirected || (response.url && response.url !== url)) {
      discard(response);
      fail("redirect_refused");
    }
    return response;
  }), signal);
}

async function readBytes(
  response: Response,
  mediaType: CommunicationInboundMediaType,
  signal: AbortSignal,
  allowGenericMedia: boolean,
  exactSize?: number
): Promise<Uint8Array> {
  const mime = (response.headers.get("content-type") ?? "").split(";", 1)[0].trim().toLowerCase();
  if (mime !== mediaType && !(allowGenericMedia && (mime === "" || mime === "application/octet-stream"))) {
    discard(response);
    fail("content_media_invalid");
  }
  const encoding = response.headers.get("content-encoding");
  if (encoding && encoding.trim().toLowerCase() !== "identity") {
    discard(response);
    fail("content_media_invalid");
  }
  const lengthHeader = response.headers.get("content-length");
  const declaredSize = lengthHeader === null ? null : Number(lengthHeader);
  if (lengthHeader !== null && (!/^\d{1,10}$/u.test(lengthHeader)
    || !Number.isSafeInteger(declaredSize) || Number(declaredSize) < 1
    || Number(declaredSize) > MAX_BYTES
    || (exactSize !== undefined && declaredSize !== exactSize))) {
    discard(response);
    fail("content_size_invalid");
  }
  if (!response.body) fail("content_size_invalid");
  const reader = response.body.getReader();
  const buffer = new Uint8Array(exactSize ?? declaredSize ?? MAX_BYTES);
  let total = 0;
  try {
    while (true) {
      const { done, value } = await abortable(reader.read(), signal);
      if (signal.aborted) fail("transfer_timeout");
      if (done) break;
      if (!(value instanceof Uint8Array)) fail("content_size_invalid");
      if (total + value.byteLength > buffer.byteLength) fail("content_size_invalid");
      buffer.set(value, total);
      total += value.byteLength;
    }
    if (total < 1 || (declaredSize !== null && total !== declaredSize)
      || (exactSize !== undefined && total !== exactSize)) fail("content_size_invalid");
    return buffer.slice(0, total);
  } catch (error) {
    void reader.cancel().catch(() => undefined);
    throw error;
  } finally {
    buffer.fill(0);
    reader.releaseLock();
  }
}

export function hashCommunicationBrevoAttachmentReference(input: {
  institutionId: string; inboundId: string; attachmentIndex: number; secret: string;
}): string {
  try {
    communicationInboundObjectStoragePath(input.institutionId, input.inboundId, input.inboundId);
  } catch { fail("input_invalid"); }
  if (!Number.isInteger(input.attachmentIndex) || input.attachmentIndex < 0
    || input.attachmentIndex >= 20) fail("input_invalid");
  return createHmac("sha256", key(input.secret))
    .update("lyceegest:communication:inbound-attachment:v1\0")
    .update(input.institutionId.toLowerCase()).update("\0")
    .update(input.inboundId.toLowerCase()).update("\0")
    .update(String(input.attachmentIndex)).digest("hex");
}

export function createCommunicationBrevoAttachmentDownloader(options: {
  apiKey: string | undefined; fetchImpl?: typeof fetch; timeoutMs?: number;
}): (value: unknown) => Promise<CommunicationDownloadedAttachment> {
  const apiKey = key(options.apiKey);
  const timeoutMs = timeout(options.timeoutMs);
  const fetchImpl = options.fetchImpl ?? fetch;
  return async (value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) fail("input_invalid");
    const input = value as Record<string, unknown>;
    if (Object.keys(input).sort().join(",") !== "downloadToken,estimatedBytes,mediaType"
      || typeof input.downloadToken !== "string"
      || !/^[A-Za-z0-9._~+/=-]{1,2048}$/u.test(input.downloadToken)
      || input.downloadToken === "." || input.downloadToken === ".."
      || typeof input.mediaType !== "string" || !MEDIA_TYPES.has(input.mediaType)
      || !Number.isSafeInteger(input.estimatedBytes) || Number(input.estimatedBytes) < 0
      || Number(input.estimatedBytes) > MAX_BYTES) fail("input_invalid");
    const mediaType = input.mediaType as CommunicationInboundMediaType;
    const url = BREVO_ATTACHMENT_ENDPOINT + encodeURIComponent(input.downloadToken);
    return deadline(timeoutMs, async (signal) => {
      const response = await request(fetchImpl, url, {
        method: "GET",
        headers: { accept: "application/octet-stream", "accept-encoding": "identity", "api-key": apiKey },
      }, signal);
      if (response.status !== 200) {
        discard(response);
        if (response.status === 401 || response.status === 403) fail("provider_authorization_failed");
        if (response.status === 404 || response.status === 410) fail("provider_not_found");
        if (response.status === 429) fail("provider_rate_limited");
        if (response.status >= 500) fail("transfer_unavailable");
        fail("provider_rejected");
      }
      // Brevo's webhook size is an estimate, never the immutable reservation size.
      const bytes = await readBytes(response, mediaType, signal, true);
      return { bytes, mediaType, sizeBytes: bytes.byteLength,
        sha256: createHash("sha256").update(bytes).digest("hex") };
    });
  };
}

type PrivateStorageOptions = {
  supabaseUrl: string | undefined; serviceRoleKey: string | undefined;
  fetchImpl?: typeof fetch; timeoutMs?: number;
};

function privateStorage(options: PrivateStorageOptions) {
  if (typeof options.supabaseUrl !== "string"
    || !/^https:\/\/[a-z0-9-]{1,63}\.supabase\.co\/?$/u.test(options.supabaseUrl)) {
    fail("configuration_invalid");
  }
  const serviceRoleKey = key(options.serviceRoleKey);
  return {
    baseUrl: options.supabaseUrl.replace(/\/$/u, ""),
    timeoutMs: timeout(options.timeoutMs),
    fetchImpl: options.fetchImpl ?? fetch,
    headers: { apikey: serviceRoleKey, authorization: `Bearer ${serviceRoleKey}`,
      "accept-encoding": "identity" },
  };
}

export function createCommunicationInboundQuarantineReader(options: PrivateStorageOptions) {
  const { baseUrl, timeoutMs, fetchImpl, headers } = privateStorage(options);
  return async (value: unknown): Promise<Uint8Array> => {
    let confirmation: CommunicationInboundQuarantineConfirmation;
    try { confirmation = parseCommunicationInboundQuarantineConfirmation(value); }
    catch { fail("input_invalid"); }
    const path = communicationInboundObjectStoragePath(
      confirmation.institutionId, confirmation.inboundId, confirmation.objectId
    );
    return deadline(timeoutMs, async (signal) => {
      const response = await request(fetchImpl, `${baseUrl}/storage/v1/object/${QUARANTINE_BUCKET}/${path}`,
        { method: "GET", headers }, signal);
      if (response.status !== 200) { discard(response); fail("storage_read_failed"); }
      const bytes = await readBytes(response, confirmation.mediaType, signal, false, confirmation.sizeBytes);
      if (createHash("sha256").update(bytes).digest("hex") !== confirmation.sha256) {
        bytes.fill(0);
        fail("content_digest_mismatch");
      }
      return bytes;
    });
  };
}

export function createCommunicationInboundQuarantineStore(options: PrivateStorageOptions) {
  return createPrivateStore(options, QUARANTINE_BUCKET);
}

export function createCommunicationInboundCleanStore(options: PrivateStorageOptions) {
  return createPrivateStore(options, CLEAN_BUCKET);
}

function createPrivateStore(options: PrivateStorageOptions, bucket: typeof QUARANTINE_BUCKET | typeof CLEAN_BUCKET): (input: {
  confirmation: unknown; bytes: Uint8Array;
}) => Promise<CommunicationInboundQuarantineConfirmation> {
  const { baseUrl, timeoutMs, fetchImpl, headers } = privateStorage(options);
  return async (input) => {
    let confirmation: CommunicationInboundQuarantineConfirmation;
    try {
      confirmation = { ...parseCommunicationInboundQuarantineConfirmation(input.confirmation) };
    } catch { fail("input_invalid"); }
    const source = input.bytes;
    if (!(source instanceof Uint8Array) || source.byteLength !== confirmation.sizeBytes) {
      fail("content_size_invalid");
    }
    const bytes = Uint8Array.from(source);
    try {
      if (bytes.byteLength !== confirmation.sizeBytes) fail("content_size_invalid");
      if (createHash("sha256").update(bytes).digest("hex") !== confirmation.sha256) {
        fail("content_digest_mismatch");
      }
      const path = communicationInboundObjectStoragePath(
        confirmation.institutionId, confirmation.inboundId, confirmation.objectId
      );
      const url = `${baseUrl}/storage/v1/object/${bucket}/${path}`;
      return await deadline(timeoutMs, async (signal) => {
        const uploaded = await request(fetchImpl, url, {
          method: "POST", body: new Blob([bytes]),
          headers: { ...headers, "content-type": confirmation.mediaType,
            "x-upsert": "false", "cache-control": "no-store" },
        }, signal);
        discard(uploaded);
        // Existing objects are accepted only after the same byte-level verification.
        if (![200, 201, 400, 409].includes(uploaded.status)) fail("storage_write_failed");
        const stored = await request(fetchImpl, url, { method: "GET", headers }, signal);
        if (stored.status !== 200) {
          discard(stored);
          fail("storage_read_failed");
        }
        const storedBytes = await readBytes(stored, confirmation.mediaType, signal, false, confirmation.sizeBytes);
        try {
          if (createHash("sha256").update(storedBytes).digest("hex") !== confirmation.sha256) {
            fail("content_digest_mismatch");
          }
        } finally { storedBytes.fill(0); }
        return confirmation;
      });
    } finally { bytes.fill(0); }
  };
}
