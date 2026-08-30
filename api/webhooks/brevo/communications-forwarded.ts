import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq } from "drizzle-orm";
import { db } from "../../../db/index.js";
import {
  communicationEvents,
  communicationInbound,
  communications,
  communicationVersions,
  institutionMemberships,
} from "../../../db/schema.js";
import {
  communicationForwardAllowedAliasHashes,
  communicationForwardAllowedSourceHashes,
  communicationForwardWebhookEnabled,
  parseCommunicationBrevoForwardedEnvelope,
  verifyCommunicationForwardBearerHeader,
} from "../../../shared/communication-brevo-forwarded.js";
import { communicationDraftContentHash } from "../../../shared/communication-draft.js";
import { prepareCommunicationForwardedEmailDraft } from "../../../shared/communication-forwarded-email.js";
import { HttpError } from "../../_shared/auth.js";
import { requireConfiguredInstitution } from "../../_shared/institution-context.js";
import { handleApi, methodNotAllowed } from "../../_shared/response.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function authorize(req: VercelRequest): void {
  if (!communicationForwardWebhookEnabled()) throw new HttpError(404, "Webhook indisponible");
  if (!verifyCommunicationForwardBearerHeader(
    req.headers.authorization,
    process.env.COMMUNICATION_FORWARD_WEBHOOK_TOKEN
  )) {
    throw new HttpError(401, "Webhook refusé");
  }
}

function configuredActorId(): string {
  const actorId = process.env.COMMUNICATION_FORWARD_ACTOR_USER_ID ?? "";
  if (!UUID_PATTERN.test(actorId)) throw new HttpError(503, "Configuration incomplète");
  return actorId;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  return handleApi(res, async () => {
    authorize(req);
    const institution = await requireConfiguredInstitution();
    const actorUserId = configuredActorId();
    let forwarded;
    let prepared;
    try {
      forwarded = parseCommunicationBrevoForwardedEnvelope(
        req.body,
        process.env.COMMUNICATION_PROVIDER_MESSAGE_HMAC_SECRET ?? "",
        communicationForwardAllowedSourceHashes(),
        communicationForwardAllowedAliasHashes()
      );
      prepared = prepareCommunicationForwardedEmailDraft(
        { subject: forwarded.subject, extractedText: forwarded.extractedText },
        {
          sourceAuthorized: forwarded.sourceAuthorized,
          externalMessageHash: forwarded.externalMessageHash,
          attachmentCount: forwarded.attachmentCount,
        }
      );
    } catch {
      throw new HttpError(400, "Transfert entrant invalide");
    }

    return db.transaction(async (tx) => {
      const [actor] = await tx
        .select({ userId: institutionMemberships.userId })
        .from(institutionMemberships)
        .where(and(
          eq(institutionMemberships.institutionId, institution.id),
          eq(institutionMemberships.userId, actorUserId),
          eq(institutionMemberships.status, "active"),
          eq(institutionMemberships.role, "admin")
        ))
        .limit(1);
      if (!actor) throw new HttpError(503, "Acteur technique indisponible");

      const [inbound] = await tx
        .insert(communicationInbound)
        .values({
          institutionId: institution.id,
          provider: "brevo_forward",
          externalMessageHash: forwarded.externalMessageHash,
          status: "received",
          classification: "forwarded_source",
        })
        .onConflictDoNothing()
        .returning({ id: communicationInbound.id });
      if (!inbound) {
        return { accepted: true, duplicate: true, draftCreated: false, reviewRequired: true };
      }

      const [draft] = await tx
        .insert(communications)
        .values({
          institutionId: institution.id,
          sourceType: "forwarded_email",
          sourceFingerprint: prepared.sourceFingerprint,
          sourceLabel: "Email transféré",
          status: "draft",
          visibility: "internal",
          category: prepared.draft.category,
          templateKey: null,
          currentVersion: 1,
          createdBy: actorUserId,
        })
        .onConflictDoNothing({
          target: [communications.institutionId, communications.sourceFingerprint],
        })
        .returning({ id: communications.id });
      if (!draft) throw new Error("Forwarded draft conflict");

      await tx.insert(communicationVersions).values({
        institutionId: institution.id,
        communicationId: draft.id,
        version: 1,
        status: "draft",
        title: prepared.draft.title,
        summary: prepared.draft.summary,
        bodyMarkdown: prepared.draft.bodyMarkdown,
        structuredFacts: prepared.draft.structuredFacts,
        openQuestions: prepared.draft.openQuestions,
        contentHash: communicationDraftContentHash(prepared.draft),
        createdBy: actorUserId,
      });

      await tx
        .update(communicationInbound)
        .set({
          communicationId: draft.id,
          createdDraftId: draft.id,
          status: "processed",
          processedAt: new Date(),
        })
        .where(and(
          eq(communicationInbound.id, inbound.id),
          eq(communicationInbound.institutionId, institution.id),
          eq(communicationInbound.status, "received")
        ));

      await tx.insert(communicationEvents).values({
        institutionId: institution.id,
        communicationId: draft.id,
        resourceType: "inbound",
        resourceId: inbound.id,
        eventType: "inbound.draft_created",
        actorUserId,
        actorType: "system",
        externalEventHash: forwarded.externalMessageHash,
        summary: {
          sourceType: "forwarded_email",
          attachmentCount: forwarded.attachmentCount,
          privacySignals: prepared.privacySignals,
          redactionRequiredBeforeAi: prepared.redactionRequiredBeforeAi,
          requiresHumanReview: true,
          visibility: "internal",
        },
      });

      return { accepted: true, duplicate: false, draftCreated: true, reviewRequired: true };
    });
  });
}

export const config = { api: { bodyParser: { sizeLimit: "3mb" } } };
