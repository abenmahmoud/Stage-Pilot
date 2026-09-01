import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { communicationInbound } from "../../db/schema.js";
import {
  COMMUNICATION_INBOUND_CONTENT_LIMITS,
  COMMUNICATION_INBOUND_MEDIA_TYPES,
  CommunicationInboundContentPolicyError,
  parseCommunicationInboundObjectDescriptors,
  type CommunicationInboundQuarantineConfirmation,
} from "../../shared/communication-inbound-content-policy.js";
import {
  reserveCommunicationInboundObjects,
  storeAndConfirmCommunicationInboundObject,
  type CommunicationTransaction,
  type CommunicationInboundIngestionReceipt,
} from "./communication-inbound-object-persistence.js";
import {
  CommunicationInboundTransferError,
  hashCommunicationBrevoAttachmentReference,
  type CommunicationDownloadedAttachment,
} from "./communication-inbound-transfer.js";

type IngestionFailure = "configuration_invalid" | "input_invalid" | "capacity_exceeded"
  | "parent_missing" | "content_invalid" | "reservation_conflict" | "object_retired"
  | "transfer_failed" | "storage_failed" | "database_busy" | "persistence_failed";

export class CommunicationInboundIngestionError extends Error {
  readonly code: IngestionFailure;
  constructor(code: IngestionFailure) {
    super(code);
    this.name = "CommunicationInboundIngestionError";
    this.code = code;
  }
}

function fail(code: IngestionFailure): never {
  throw new CommunicationInboundIngestionError(code);
}

type TransactionRunner = <T>(work: (tx: CommunicationTransaction) => Promise<T>) => Promise<T>;

export function createCommunicationInboundAttachmentIngestor(options: {
  transaction: TransactionRunner;
  download: (input: unknown) => Promise<CommunicationDownloadedAttachment>;
  store: (input: { confirmation: unknown; bytes: Uint8Array }) => Promise<CommunicationInboundQuarantineConfirmation>;
  referenceSecret: string;
  concurrency?: number;
}): (value: unknown) => Promise<CommunicationInboundIngestionReceipt> {
  const concurrency = options.concurrency ?? 2;
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 4
    || typeof options.referenceSecret !== "string" || options.referenceSecret.length < 32
    || options.referenceSecret.length > 2048 || /[^\x21-\x7e]/u.test(options.referenceSecret)) {
    fail("configuration_invalid");
  }
  let active = 0;
  const transaction: TransactionRunner = (work) => options.transaction(async (tx) => {
    await tx.execute(sql`set local lock_timeout = '5s'`);
    return work(tx);
  });
  return async (value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) fail("input_invalid");
    const input = value as Record<string, unknown>;
    if (Object.keys(input).sort().join(",") !== "attachmentIndex,downloadToken,estimatedBytes,inboundId,institutionId,mediaType"
      || typeof input.institutionId !== "string" || typeof input.inboundId !== "string"
      || typeof input.downloadToken !== "string" || typeof input.mediaType !== "string"
      || !/^[A-Za-z0-9._~+/=-]{1,2048}$/u.test(input.downloadToken)
      || input.downloadToken === "." || input.downloadToken === ".."
      || !(COMMUNICATION_INBOUND_MEDIA_TYPES as readonly string[]).includes(input.mediaType)
      || !Number.isSafeInteger(input.estimatedBytes) || Number(input.estimatedBytes) < 0
      || Number(input.estimatedBytes) > COMMUNICATION_INBOUND_CONTENT_LIMITS.objectBytes
      || !Number.isInteger(input.attachmentIndex)) fail("input_invalid");
    const institutionId = input.institutionId.toLowerCase();
    const inboundId = input.inboundId.toLowerCase();
    let objectRefHash: string;
    try {
      objectRefHash = hashCommunicationBrevoAttachmentReference({ institutionId, inboundId,
        attachmentIndex: Number(input.attachmentIndex), secret: options.referenceSecret });
    } catch { fail("input_invalid"); }
    const downloadInput = { downloadToken: input.downloadToken, mediaType: input.mediaType,
      estimatedBytes: input.estimatedBytes };
    if (active >= concurrency) fail("capacity_exceeded");
    active += 1;
    let downloaded: CommunicationDownloadedAttachment | undefined;
    try {
      await transaction(async (tx) => {
        const [parent] = await tx.select({ id: communicationInbound.id })
          .from(communicationInbound)
          .where(and(eq(communicationInbound.id, inboundId), eq(communicationInbound.institutionId, institutionId)))
          .limit(1);
        if (!parent) fail("parent_missing");
      });
      try { downloaded = await options.download(downloadInput); }
      catch (error) {
        if (error instanceof CommunicationInboundTransferError) throw error;
        fail("transfer_failed");
      }
      if (!(downloaded?.bytes instanceof Uint8Array)
        || downloaded.sizeBytes !== downloaded.bytes.byteLength
        || downloaded.mediaType !== downloadInput.mediaType
        || createHash("sha256").update(downloaded.bytes).digest("hex") !== downloaded.sha256) {
        fail("content_invalid");
      }
      const [descriptor] = parseCommunicationInboundObjectDescriptors([{
        objectKind: "attachment", objectRefHash,
        mediaType: downloaded.mediaType, sizeBytes: downloaded.sizeBytes,
      }]);
      // This transaction must commit before any storage write so retries retain the same path.
      const reservations = await transaction((tx) => reserveCommunicationInboundObjects({
        tx, institutionId, inboundId, descriptors: [descriptor],
      }));
      if (reservations.length !== 1) fail("reservation_conflict");
      const confirmation: CommunicationInboundQuarantineConfirmation = {
        institutionId, inboundId, objectId: reservations[0].id,
        mediaType: downloaded.mediaType, sizeBytes: downloaded.sizeBytes, sha256: downloaded.sha256,
      };
      const bytes = downloaded.bytes;
      return await transaction((tx) => storeAndConfirmCommunicationInboundObject({
        tx, confirmation, store: async (confirmed) => {
          try { return await options.store({ confirmation: confirmed, bytes }); }
          catch (error) {
            if (error instanceof CommunicationInboundTransferError) throw error;
            fail("storage_failed");
          }
        },
      }));
    } catch (error) {
      if (error instanceof CommunicationInboundIngestionError || error instanceof CommunicationInboundTransferError) throw error;
      if (error instanceof Error && error.message === "communication_inbound_object_retired") fail("object_retired");
      if (error instanceof Error && error.message === "communication_inbound_object_parent_missing") fail("parent_missing");
      if (error instanceof Error && ["communication_inbound_object_quarantine_conflict",
        "communication_inbound_object_reservation_conflict", "communication_inbound_object_storage_receipt_conflict",
        "object_reservation_conflict"].includes(error.message)) fail("reservation_conflict");
      if (error instanceof CommunicationInboundContentPolicyError) fail("content_invalid");
      const databaseError = error as { code?: unknown; cause?: { code?: unknown } } | null;
      if (["55P03", "40P01", "40001"].includes(String(databaseError?.cause?.code ?? databaseError?.code))) {
        fail("database_busy");
      }
      fail("persistence_failed");
    } finally {
      if (downloaded?.bytes instanceof Uint8Array) downloaded.bytes.fill(0);
      active -= 1;
    }
  };
}
