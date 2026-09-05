// LOT 4 du plan de publication publique
// (docs/operations/PLAN_FLASH_PUBLIC_2026-09-05.md) : raccorde une
// publication flash a la file durable existante du centre de communication
// (spec 005), jamais une seconde file (regle commune n4). Appele UNIQUEMENT
// depuis la meme transaction que la publication flash (jamais un second
// aller-retour) et UNIQUEMENT avec la requete calculee par le module pur
// shared/flash-communication-bridge.ts.
//
// Reste INERT tant que `communication_settings.module_enabled` est faux
// (defaut, aucun drapeau n'est ouvert par ce lot -- interdit absolu de
// CLAUDE.md) : la fonction lit ce drapeau AVANT toute ecriture et retourne
// un statut « module_disabled » sans jamais tenter une insertion. C'est
// deliberement une verification applicative prealable, jamais un
// try/catch autour d'une insertion : les triggers de garde du centre de
// communication (communication_guard_job_flags, migration 20260830160000)
// levent une exception SQL si le module est desactive, ce qui ferait
// echouer TOUTE la transaction -- y compris l'ecriture deja existante de
// `flash_notification_dispatches` (LOT 3) et la transition de la version
// flash elle-meme. Casser une publication flash aujourd'hui fonctionnelle
// pour raccorder une file qui restera de toute facon inerte serait une
// regression, pas un progres.
//
// Sequence d'ecriture (uniquement si le module est actif ET le secret
// d'idempotence configure) : la fondation du centre de communication
// (migration 20260830080000) exige qu'une ligne `communications` /
// `communication_versions` naisse TOUJOURS a l'etat 'draft' -- un INSERT
// direct a l'etat 'approved' est refuse par le trigger
// `communication_root_insert_guard` / `communication_version_insert_guard`.
// Sur une republication, retenter cet INSERT (meme protege par
// `onConflictDoNothing`) declenche quand meme le trigger AVANT la
// resolution du conflit et leve une exception si la ligne existante est deja
// approuvee -- verifie par lecture des migrations avant d'ecrire ce fichier
// (voir docs/operations/night-logs/PUBLIC-LOT4.md). Ce module verifie donc
// TOUJOURS l'existence par une lecture verrouillee avant d'inserer quoi que
// ce soit, jamais par un INSERT ... ON CONFLICT DO NOTHING pour ces deux
// tables precises. Aucune course n'est possible ici : l'appelant tient deja
// un verrou `for update` sur la version flash source (meme transaction),
// donc deux publications de la meme version ne peuvent jamais s'executer en
// parallele.

import { and, eq } from "drizzle-orm";
import { createHmac } from "node:crypto";
import { db } from "../../db/index.js";
import {
  communicationAudiences,
  communicationJobs,
  communications,
  communicationSettings,
  communicationVersions,
} from "../../db/schema.js";
import type { FlashCommunicationBridgeRequest } from "../../shared/flash-communication-bridge.js";

type CommunicationTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

const FLASH_COMMUNICATION_SOURCE_TYPE = "flash_info";
const FLASH_COMMUNICATION_CATEGORY = "flash";
const FLASH_COMMUNICATION_VERSION = 1;
const MIN_SECRET_LENGTH = 32;

export type FlashCommunicationBridgeOutcome =
  | { enqueued: false; reason: "no_email_target" | "module_disabled" | "secret_missing" }
  | { enqueued: true; communicationId: string; versionId: string; jobCreated: boolean };

export async function persistFlashCommunicationBridge(input: {
  tx: CommunicationTransaction;
  institutionId: string;
  actorUserId: string;
  request: FlashCommunicationBridgeRequest | null;
  idempotencySecret: string | undefined;
  now?: Date;
}): Promise<FlashCommunicationBridgeOutcome> {
  if (!input.request) return { enqueued: false, reason: "no_email_target" };

  const [settings] = await input.tx
    .select({ moduleEnabled: communicationSettings.moduleEnabled })
    .from(communicationSettings)
    .where(eq(communicationSettings.institutionId, input.institutionId))
    .limit(1);
  if (!settings || !settings.moduleEnabled) {
    return { enqueued: false, reason: "module_disabled" };
  }
  if (!input.idempotencySecret || input.idempotencySecret.length < MIN_SECRET_LENGTH) {
    return { enqueued: false, reason: "secret_missing" };
  }

  const now = input.now ?? new Date();
  const request = input.request;

  const [existingCommunication] = await input.tx
    .select({ id: communications.id })
    .from(communications)
    .where(and(
      eq(communications.institutionId, input.institutionId),
      eq(communications.sourceFingerprint, request.sourceFingerprint)
    ))
    .limit(1)
    .for("update");

  let communicationId: string;
  let versionId: string;

  if (existingCommunication) {
    communicationId = existingCommunication.id;
    const [existingVersion] = await input.tx
      .select({ id: communicationVersions.id })
      .from(communicationVersions)
      .where(and(
        eq(communicationVersions.communicationId, communicationId),
        eq(communicationVersions.institutionId, input.institutionId),
        eq(communicationVersions.version, FLASH_COMMUNICATION_VERSION)
      ))
      .limit(1);
    if (!existingVersion) throw new Error("flash_communication_bridge_version_missing");
    versionId = existingVersion.id;
  } else {
    const [createdCommunication] = await input.tx
      .insert(communications)
      .values({
        institutionId: input.institutionId,
        sourceType: FLASH_COMMUNICATION_SOURCE_TYPE,
        sourceFingerprint: request.sourceFingerprint,
        sourceLabel: request.sourceLabel,
        status: "draft",
        visibility: "targeted",
        category: FLASH_COMMUNICATION_CATEGORY,
        currentVersion: FLASH_COMMUNICATION_VERSION,
        createdBy: input.actorUserId,
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: communications.id });
    communicationId = createdCommunication.id;

    const [createdVersion] = await input.tx
      .insert(communicationVersions)
      .values({
        institutionId: input.institutionId,
        communicationId,
        version: FLASH_COMMUNICATION_VERSION,
        status: "draft",
        title: request.title,
        bodyMarkdown: request.bodyMarkdown,
        contentHash: request.contentHash,
        createdBy: input.actorUserId,
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: communicationVersions.id });
    versionId = createdVersion.id;

    await input.tx
      .update(communicationVersions)
      .set({ status: "approved", approvedBy: input.actorUserId, approvedAt: now, updatedAt: now })
      .where(and(
        eq(communicationVersions.id, versionId),
        eq(communicationVersions.institutionId, input.institutionId)
      ));
    await input.tx
      .update(communications)
      .set({ status: "approved", approvedBy: input.actorUserId, approvedAt: now, updatedAt: now })
      .where(and(
        eq(communications.id, communicationId),
        eq(communications.institutionId, input.institutionId)
      ));
  }

  if (request.groupRefs.length > 0) {
    await input.tx
      .insert(communicationAudiences)
      .values(
        request.groupRefs.map((groupRef) => ({
          institutionId: input.institutionId,
          communicationId,
          groupRef,
          createdBy: input.actorUserId,
          createdAt: now,
        }))
      )
      .onConflictDoNothing();
  }

  const idempotencyKeyHash = createHmac("sha256", input.idempotencySecret)
    .update("flash-communication-bridge-job:v1\0")
    .update(input.institutionId)
    .update("\0")
    .update(communicationId)
    .update("\0")
    .update(versionId)
    .digest("hex");

  const insertedJob = await input.tx
    .insert(communicationJobs)
    .values({
      institutionId: input.institutionId,
      communicationId,
      versionId,
      version: FLASH_COMMUNICATION_VERSION,
      jobType: "prepare_delivery",
      status: "pending",
      idempotencyKeyHash,
      attemptCount: 0,
      runAfter: now,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing()
    .returning({ id: communicationJobs.id });

  return {
    enqueued: true,
    communicationId,
    versionId,
    jobCreated: insertedJob.length === 1,
  };
}
