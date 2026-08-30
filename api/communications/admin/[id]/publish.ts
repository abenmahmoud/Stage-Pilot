import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../../../../db/index.js";
import {
  communicationEvents,
  communications,
  communicationVersions,
  siteContentAudit,
  siteContentItems,
  siteContentVersions,
} from "../../../../db/schema.js";
import {
  assertCommunicationPublicContent,
  communicationPublicCategory,
  communicationPublicSlug,
} from "../../../../shared/communication-publication.js";
import { HttpError } from "../../../_shared/auth.js";
import { requireCommunicationPublisher } from "../../../_shared/communications.js";
import { handleApi, methodNotAllowed } from "../../../_shared/response.js";

function routeId(req: VercelRequest): string {
  const value = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (!value) throw new HttpError(400, "Communication manquante");
  return value;
}

function requireConfirmation(value: unknown): void {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || Object.keys(value).some((key) => key !== "confirmation")
    || (value as Record<string, unknown>).confirmation !== "PUBLIER") {
    throw new HttpError(400, "Confirmez la publication sur le site.");
  }
}

function publicContentError(error: unknown): never {
  const reason = error instanceof Error ? error.message : "public_content_invalid";
  if (reason === "open_questions_remaining") {
    throw new HttpError(409, "Des informations restent à confirmer.");
  }
  if (reason === "secret_forbidden") {
    throw new HttpError(409, "Retirez tout mot de passe, code ou secret avant publication.");
  }
  if (reason === "email_address_forbidden" || reason === "phone_number_forbidden") {
    throw new HttpError(409, "Une coordonnée doit être vérifiée et publiée depuis le contenu officiel du site.");
  }
  if (reason === "public_content_too_long") {
    throw new HttpError(409, "Le message dépasse la taille autorisée pour le site.");
  }
  throw new HttpError(409, "Cette communication ne peut pas être publiée.");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  return handleApi(res, async () => {
    const context = await requireCommunicationPublisher(req);
    requireConfirmation(req.body);
    const id = routeId(req);
    return db.transaction(async (tx) => {
      await tx.execute(sql`
        select id from public.communications
        where id = ${id}::uuid and institution_id = ${context.institutionId}::uuid
        for update
      `);
      const [root] = await tx
        .select({
          id: communications.id,
          status: communications.status,
          visibility: communications.visibility,
          category: communications.category,
          currentVersion: communications.currentVersion,
          publicSlug: communications.publicSlug,
          siteContentId: communications.siteContentId,
          approvedBy: communications.approvedBy,
          approvedAt: communications.approvedAt,
          publishAt: communications.publishAt,
          expiresAt: communications.expiresAt,
          publishedAt: communications.publishedAt,
        })
        .from(communications)
        .where(and(
          eq(communications.id, id),
          eq(communications.institutionId, context.institutionId)
        ))
        .limit(1);
      if (!root) throw new HttpError(404, "Communication introuvable");
      if (root.status === "published") {
        return {
          communication: {
            id: root.id,
            status: root.status,
            visibility: root.visibility,
            publicSlug: root.publicSlug,
            publishedAt: root.publishedAt,
          },
          duplicate: true,
        };
      }
      if (root.status !== "approved" || !root.approvedBy || !root.approvedAt) {
        throw new HttpError(409, "La direction doit d’abord valider cette communication.");
      }
      if (root.visibility !== "public") {
        throw new HttpError(409, "Cette communication n’est pas destinée au site public.");
      }
      if (root.siteContentId || root.publicSlug || root.publishedAt) {
        throw new HttpError(409, "Les références de publication sont incohérentes.");
      }
      const [current] = await tx
        .select({
          id: communicationVersions.id,
          status: communicationVersions.status,
          version: communicationVersions.version,
          title: communicationVersions.title,
          summary: communicationVersions.summary,
          bodyMarkdown: communicationVersions.bodyMarkdown,
          openQuestions: communicationVersions.openQuestions,
          approvedAt: communicationVersions.approvedAt,
        })
        .from(communicationVersions)
        .where(and(
          eq(communicationVersions.communicationId, id),
          eq(communicationVersions.institutionId, context.institutionId),
          eq(communicationVersions.version, root.currentVersion)
        ))
        .limit(1);
      if (!current || current.status !== "approved" || !current.approvedAt) {
        throw new HttpError(409, "La version validée est introuvable.");
      }
      try {
        assertCommunicationPublicContent(current);
      } catch (error) {
        publicContentError(error);
      }
      const now = new Date();
      if (root.publishAt && root.publishAt > now) {
        throw new HttpError(409, "La date de publication n’est pas encore atteinte.");
      }
      if (root.expiresAt && root.expiresAt <= now) {
        throw new HttpError(409, "Cette communication est déjà expirée.");
      }
      const slug = communicationPublicSlug(current.title, root.id);
      const category = communicationPublicCategory(root.category);
      const [content] = await tx
        .insert(siteContentItems)
        .values({
          contentType: "article",
          slug,
          title: current.title,
          summary: current.summary,
          bodyMarkdown: current.bodyMarkdown,
          category,
          audience: "tous",
          status: "publie",
          featured: false,
          metaTitle: current.title,
          metaDescription: current.summary.slice(0, 320) || null,
          publishAt: root.publishAt ?? now,
          expiresAt: root.expiresAt,
          publishedAt: now,
          importKey: `communication:${root.id}`,
          needsReview: false,
          reviewedAt: root.approvedAt,
          reviewedBy: root.approvedBy,
          createdBy: context.user.id,
          updatedBy: context.user.id,
          approvedBy: root.approvedBy,
          version: 1,
          publishedVersion: 1,
        })
        .returning({ id: siteContentItems.id });
      if (!content) throw new Error("La page publique n’a pas été créée.");
      await tx.insert(siteContentVersions).values({
        contentId: content.id,
        version: 1,
        snapshot: {
          contentType: "article",
          slug,
          title: current.title,
          summary: current.summary,
          bodyMarkdown: current.bodyMarkdown,
          category,
          audience: "tous",
          templateId: null,
          featured: false,
          metaTitle: current.title,
          metaDescription: current.summary.slice(0, 320) || null,
          publishAt: (root.publishAt ?? now).toISOString(),
          expiresAt: root.expiresAt?.toISOString() ?? null,
          status: "publie",
          assets: [],
          version: 1,
        },
        createdBy: context.user.id,
      });
      const [communication] = await tx
        .update(communications)
        .set({
          status: "published",
          publicSlug: slug,
          siteContentId: content.id,
          publishedAt: now,
        })
        .where(and(
          eq(communications.id, id),
          eq(communications.institutionId, context.institutionId),
          eq(communications.status, "approved"),
          eq(communications.currentVersion, root.currentVersion)
        ))
        .returning({
          id: communications.id,
          status: communications.status,
          visibility: communications.visibility,
          publicSlug: communications.publicSlug,
          publishedAt: communications.publishedAt,
        });
      if (!communication) throw new HttpError(409, "Cette communication a déjà changé.");
      await tx.insert(siteContentAudit).values({
        resourceType: "content",
        resourceId: content.id,
        action: "publish",
        actorId: context.user.id,
        summary: { source: "communication", communicationId: root.id, version: root.currentVersion },
      });
      await tx.insert(communicationEvents).values({
        institutionId: context.institutionId,
        communicationId: root.id,
        resourceType: "communication",
        resourceId: root.id,
        eventType: "communication.published",
        actorUserId: context.user.id,
        actorType: "user",
        summary: { version: root.currentVersion, siteContentId: content.id },
      });
      return { communication, duplicate: false };
    });
  });
}

export const config = { api: { bodyParser: { sizeLimit: "4kb" } } };
