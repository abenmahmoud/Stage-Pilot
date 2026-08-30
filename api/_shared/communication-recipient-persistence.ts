import { and, eq, inArray } from "drizzle-orm";
import { db } from "../../db/index.js";
import {
  communicationDeliveries,
  communicationEvents,
  communications,
  communicationVersions,
} from "../../db/schema.js";
import {
  prepareCommunicationDeliveryRows,
  type VerifiedCommunicationRecipientResolution,
} from "../../shared/communication-recipient-resolution.js";

type CommunicationTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
const HASH_PATTERN = /^[a-f0-9]{64}$/;
const APPROVED_COMMUNICATION_STATUSES = new Set(["approved", "published"]);
const APPROVED_VERSION_STATUSES = new Set(["approved", "published"]);

export type PersistedCommunicationRecipientResolution = {
  accepted: true;
  preparedCount: number;
  createdCount: number;
  duplicateCount: number;
};

export async function persistCommunicationRecipientResolution(input: {
  tx: CommunicationTransaction;
  resolution: VerifiedCommunicationRecipientResolution;
  idempotencySecret: string | undefined;
  persistedAt?: Date;
}): Promise<PersistedCommunicationRecipientResolution> {
  const persistedAt = input.persistedAt ?? new Date();
  if (!Number.isFinite(persistedAt.getTime())) throw new Error("resolution_time_invalid");
  if (!HASH_PATTERN.test(input.resolution.resolutionHash)) {
    throw new Error("resolution_hash_invalid");
  }
  const prepared = prepareCommunicationDeliveryRows(input.resolution, input.idempotencySecret);

  const [scope] = await input.tx
    .select({
      communicationStatus: communications.status,
      currentVersion: communications.currentVersion,
      versionStatus: communicationVersions.status,
      versionNumber: communicationVersions.version,
    })
    .from(communications)
    .innerJoin(communicationVersions, and(
      eq(communicationVersions.id, input.resolution.versionId),
      eq(communicationVersions.institutionId, communications.institutionId),
      eq(communicationVersions.communicationId, communications.id)
    ))
    .where(and(
      eq(communications.id, input.resolution.communicationId),
      eq(communications.institutionId, input.resolution.institutionId),
      eq(communicationVersions.version, input.resolution.version)
    ))
    .limit(1)
    .for("update");
  if (!scope) throw new Error("resolution_scope_missing");
  if (
    !APPROVED_COMMUNICATION_STATUSES.has(scope.communicationStatus) ||
    !APPROVED_VERSION_STATUSES.has(scope.versionStatus) ||
    scope.currentVersion !== input.resolution.version ||
    scope.versionNumber !== input.resolution.version
  ) {
    throw new Error("resolution_version_not_current_approved");
  }

  const inserted = await input.tx
    .insert(communicationDeliveries)
    .values(prepared.map((row) => ({
      ...row,
      resolutionHash: input.resolution.resolutionHash,
      updatedAt: persistedAt,
      createdAt: persistedAt,
    })))
    .onConflictDoNothing()
    .returning({ idempotencyKeyHash: communicationDeliveries.idempotencyKeyHash });

  const hashes = prepared.map((row) => row.idempotencyKeyHash);
  const stored = await input.tx
    .select({
      institutionId: communicationDeliveries.institutionId,
      communicationId: communicationDeliveries.communicationId,
      versionId: communicationDeliveries.versionId,
      version: communicationDeliveries.version,
      contactRef: communicationDeliveries.contactRef,
      channel: communicationDeliveries.channel,
      idempotencyKeyHash: communicationDeliveries.idempotencyKeyHash,
      resolutionHash: communicationDeliveries.resolutionHash,
    })
    .from(communicationDeliveries)
    .where(and(
      eq(communicationDeliveries.institutionId, input.resolution.institutionId),
      inArray(communicationDeliveries.idempotencyKeyHash, hashes)
    ));
  if (stored.length !== prepared.length) throw new Error("resolution_persistence_incomplete");

  const expectedByHash = new Map(prepared.map((row) => [row.idempotencyKeyHash, row]));
  for (const row of stored) {
    const expected = expectedByHash.get(row.idempotencyKeyHash);
    if (
      !expected ||
      row.institutionId !== expected.institutionId ||
      row.communicationId !== expected.communicationId ||
      row.versionId !== expected.versionId ||
      row.version !== expected.version ||
      row.contactRef !== expected.contactRef ||
      row.channel !== expected.channel ||
      row.resolutionHash !== input.resolution.resolutionHash
    ) {
      throw new Error("delivery_resolution_conflict");
    }
  }

  await input.tx
    .insert(communicationEvents)
    .values({
      institutionId: input.resolution.institutionId,
      communicationId: input.resolution.communicationId,
      resourceType: "communication",
      resourceId: input.resolution.communicationId,
      eventType: "delivery.resolution_persisted",
      actorType: "webmail",
      externalEventHash: input.resolution.resolutionHash,
      summary: {
        pageIndex: input.resolution.pageIndex,
        pageCount: input.resolution.pageCount,
        preparedCount: prepared.length,
        createdCount: inserted.length,
      },
    })
    .onConflictDoNothing();

  return {
    accepted: true,
    preparedCount: prepared.length,
    createdCount: inserted.length,
    duplicateCount: prepared.length - inserted.length,
  };
}
