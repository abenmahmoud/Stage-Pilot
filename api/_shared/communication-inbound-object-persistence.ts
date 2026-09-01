import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import {
  communicationInbound,
  communicationInboundObjectEvents,
  communicationInboundObjects,
} from "../../db/schema.js";
import {
  assertCommunicationInboundObjectAggregate,
  communicationInboundObjectStoragePath,
  parseCommunicationInboundObjectDescriptors,
  parseCommunicationInboundQuarantineConfirmation,
  type CommunicationInboundObjectDescriptor,
} from "../../shared/communication-inbound-content-policy.js";

type CommunicationTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type CommunicationInboundObjectReservation = {
  id: string;
  objectKind: "message_body" | "attachment";
  mediaType: string;
  sizeBytes: number;
  storageBucket: "communication-inbound-quarantine" | "communication-inbound-clean";
  storagePath: string;
  status: string;
  duplicate: boolean;
};

function sameReservation(
  row: {
    objectKind: string;
    mediaType: string;
    sizeBytes: number;
  },
  descriptor: CommunicationInboundObjectDescriptor
): boolean {
  return row.objectKind === descriptor.objectKind
    && row.mediaType === descriptor.mediaType
    && Number(row.sizeBytes) === descriptor.sizeBytes;
}

export async function reserveCommunicationInboundObjects(input: {
  tx: CommunicationTransaction;
  institutionId: string;
  inboundId: string;
  descriptors: unknown;
}): Promise<CommunicationInboundObjectReservation[]> {
  const descriptors = parseCommunicationInboundObjectDescriptors(input.descriptors);
  const reservations: CommunicationInboundObjectReservation[] = [];

  const [parent] = await input.tx
    .select({ id: communicationInbound.id })
    .from(communicationInbound)
    .where(and(
      eq(communicationInbound.id, input.inboundId),
      eq(communicationInbound.institutionId, input.institutionId)
    ))
    .limit(1)
    .for("update");
  if (!parent) {
    throw new Error("communication_inbound_object_parent_missing");
  }

  const existingObjects = await input.tx
    .select({
      id: communicationInboundObjects.id,
      objectKind: communicationInboundObjects.objectKind,
      objectRefHash: communicationInboundObjects.objectRefHash,
      mediaType: communicationInboundObjects.mediaType,
      sizeBytes: communicationInboundObjects.sizeBytes,
      storageBucket: communicationInboundObjects.storageBucket,
      storagePath: communicationInboundObjects.storagePath,
      status: communicationInboundObjects.status,
    })
    .from(communicationInboundObjects)
    .where(and(
      eq(communicationInboundObjects.institutionId, input.institutionId),
      eq(communicationInboundObjects.inboundId, input.inboundId)
    ));
  assertCommunicationInboundObjectAggregate(existingObjects, descriptors);
  const existingByRef = new Map(
    existingObjects.map((object) => [object.objectRefHash, object])
  );

  for (const descriptor of descriptors) {
    const replay = existingByRef.get(descriptor.objectRefHash);
    if (replay) {
      const expectedPath = communicationInboundObjectStoragePath(
        input.institutionId,
        input.inboundId,
        replay.id
      );
      if (
        !sameReservation(replay, descriptor)
        || replay.storagePath !== expectedPath
        || (
          replay.storageBucket !== "communication-inbound-quarantine"
          && replay.storageBucket !== "communication-inbound-clean"
        )
      ) {
        throw new Error("communication_inbound_object_reservation_conflict");
      }
      reservations.push({
        id: replay.id,
        objectKind: descriptor.objectKind,
        mediaType: descriptor.mediaType,
        sizeBytes: descriptor.sizeBytes,
        storageBucket: replay.storageBucket,
        storagePath: replay.storagePath,
        status: replay.status,
        duplicate: true,
      });
      continue;
    }

    const objectId = randomUUID();
    const storagePath = communicationInboundObjectStoragePath(
      input.institutionId,
      input.inboundId,
      objectId
    );
    const [created] = await input.tx
      .insert(communicationInboundObjects)
      .values({
        id: objectId,
        institutionId: input.institutionId,
        inboundId: input.inboundId,
        objectKind: descriptor.objectKind,
        objectRefHash: descriptor.objectRefHash,
        mediaType: descriptor.mediaType,
        sizeBytes: descriptor.sizeBytes,
        storageBucket: "communication-inbound-quarantine",
        storagePath,
        status: "reserved",
      })
      .onConflictDoNothing()
      .returning({
        id: communicationInboundObjects.id,
        objectKind: communicationInboundObjects.objectKind,
        mediaType: communicationInboundObjects.mediaType,
        sizeBytes: communicationInboundObjects.sizeBytes,
        storageBucket: communicationInboundObjects.storageBucket,
        storagePath: communicationInboundObjects.storagePath,
        status: communicationInboundObjects.status,
      });

    if (created) {
      await input.tx.insert(communicationInboundObjectEvents).values({
        institutionId: input.institutionId,
        inboundObjectId: created.id,
        eventType: "object.reserved",
        actorType: "provider",
        summary: {
          objectKind: descriptor.objectKind,
          sizeBytes: descriptor.sizeBytes,
        },
      });
      reservations.push({
        id: created.id,
        objectKind: descriptor.objectKind,
        mediaType: descriptor.mediaType,
        sizeBytes: descriptor.sizeBytes,
        storageBucket: "communication-inbound-quarantine",
        storagePath: created.storagePath,
        status: created.status,
        duplicate: false,
      });
      continue;
    }

    const [existing] = await input.tx
      .select({
        id: communicationInboundObjects.id,
        objectKind: communicationInboundObjects.objectKind,
        mediaType: communicationInboundObjects.mediaType,
        sizeBytes: communicationInboundObjects.sizeBytes,
        storageBucket: communicationInboundObjects.storageBucket,
        storagePath: communicationInboundObjects.storagePath,
        status: communicationInboundObjects.status,
      })
      .from(communicationInboundObjects)
      .where(and(
        eq(communicationInboundObjects.institutionId, input.institutionId),
        eq(communicationInboundObjects.inboundId, input.inboundId),
        eq(communicationInboundObjects.objectRefHash, descriptor.objectRefHash)
      ))
      .limit(1);
    if (
      !existing
      || existing.storageBucket !== "communication-inbound-quarantine"
      || !sameReservation(existing, descriptor)
    ) {
      throw new Error("communication_inbound_object_reservation_conflict");
    }
    reservations.push({
      id: existing.id,
      objectKind: descriptor.objectKind,
      mediaType: descriptor.mediaType,
      sizeBytes: descriptor.sizeBytes,
      storageBucket: "communication-inbound-quarantine",
      storagePath: existing.storagePath,
      status: existing.status,
      duplicate: true,
    });
  }

  return reservations;
}

export async function confirmCommunicationInboundObjectQuarantine(input: {
  tx: CommunicationTransaction;
  confirmation: unknown;
}): Promise<{
  accepted: true;
  objectId: string;
  status: "quarantine";
  duplicate: boolean;
}> {
  const confirmation = parseCommunicationInboundQuarantineConfirmation(input.confirmation);
  const [quarantined] = await input.tx
    .update(communicationInboundObjects)
    .set({
      status: "quarantine",
      scanDetail: "awaiting_antivirus",
      sha256: confirmation.sha256,
    })
    .where(and(
      eq(communicationInboundObjects.id, confirmation.objectId),
      eq(communicationInboundObjects.institutionId, confirmation.institutionId),
      eq(communicationInboundObjects.inboundId, confirmation.inboundId),
      eq(communicationInboundObjects.mediaType, confirmation.mediaType),
      eq(communicationInboundObjects.sizeBytes, confirmation.sizeBytes),
      eq(communicationInboundObjects.status, "reserved")
    ))
    .returning({ id: communicationInboundObjects.id });

  if (!quarantined) {
    const [current] = await input.tx
      .select({
        id: communicationInboundObjects.id,
        mediaType: communicationInboundObjects.mediaType,
        sizeBytes: communicationInboundObjects.sizeBytes,
        status: communicationInboundObjects.status,
        sha256: communicationInboundObjects.sha256,
      })
      .from(communicationInboundObjects)
      .where(and(
        eq(communicationInboundObjects.id, confirmation.objectId),
        eq(communicationInboundObjects.institutionId, confirmation.institutionId),
        eq(communicationInboundObjects.inboundId, confirmation.inboundId)
      ))
      .limit(1);
    if (
      current?.status === "quarantine"
      && current.sha256 === confirmation.sha256
      && current.mediaType === confirmation.mediaType
      && Number(current.sizeBytes) === confirmation.sizeBytes
    ) {
      return {
        accepted: true,
        objectId: current.id,
        status: "quarantine",
        duplicate: true,
      };
    }
    throw new Error("communication_inbound_object_quarantine_conflict");
  }

  await input.tx.insert(communicationInboundObjectEvents).values({
    institutionId: confirmation.institutionId,
    inboundObjectId: confirmation.objectId,
    eventType: "object.quarantined",
    actorType: "system",
    summary: { scan: "pending" },
  });
  await input.tx.execute(sql`
    select pgmq.send(
      'communication_inbound_scan',
      jsonb_build_object(
        'schema', 1,
        'job_type', 'scan_communication_inbound_object',
        'institution_id', ${confirmation.institutionId}::uuid,
        'inbound_id', ${confirmation.inboundId}::uuid,
        'object_id', ${confirmation.objectId}::uuid
      )
    )
  `);

  return {
    accepted: true,
    objectId: confirmation.objectId,
    status: "quarantine",
    duplicate: false,
  };
}
