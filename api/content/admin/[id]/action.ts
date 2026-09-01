import type { VercelRequest, VercelResponse } from "@vercel/node";
import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "../../../../db/index.js";
import {
  siteContentAssetLinks,
  siteContentAssets,
  siteContentAudit,
  siteContentItems,
  siteContentVersions,
} from "../../../../db/schema.js";
import {
  parseLegacyEditorialCorrectionCommand,
  type LegacyEditorialCorrectionCommand,
} from "../../../../shared/legacy-editorial-action.js";
import { applyLegacyPreviewEditorialCorrections } from "../../../../shared/legacy-editorial-corrections.js";
import { parseSiteContentInput } from "../../../../shared/site-content.js";
import { projectSiteContentAdminMutationPayload } from "../../../../shared/site-content-admin-payload.js";
import {
  siteContentActionAccess,
  siteContentStatusAllowsAction,
  type SiteContentAction,
} from "../../../../shared/site-content-policy.js";
import { HttpError, requireAal2 } from "../../../_shared/auth.js";
import {
  contentSnapshot,
  inputError,
  requireSiteEditor,
  requireSitePublisher,
} from "../../../_shared/site-content.js";
import { handleApi, methodNotAllowed } from "../../../_shared/response.js";

const legacyEditorialCorrectionsEnabled =
  process.env.LEGACY_EDITORIAL_CORRECTIONS_ENABLED === "true";

function routeId(req: VercelRequest): string {
  const value = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (!value) throw new HttpError(400, "Contenu manquant");
  return value;
}

function requestedAction(body: unknown): SiteContentAction {
  const value = body && typeof body === "object" ? (body as Record<string, unknown>).action : null;
  if (!["submit_review", "publish", "archive", "duplicate", "restore", "verify_source", "apply_editorial_corrections"].includes(String(value))) {
    throw new HttpError(400, "Action invalide");
  }
  return value as SiteContentAction;
}

async function contentLinks(contentId: string) {
  return db
    .select({
      assetId: siteContentAssetLinks.assetId,
      assetRole: siteContentAssetLinks.assetRole,
      publicLabel: siteContentAssetLinks.publicLabel,
      position: siteContentAssetLinks.position,
      status: siteContentAssets.status,
    })
    .from(siteContentAssetLinks)
    .innerJoin(siteContentAssets, eq(siteContentAssets.id, siteContentAssetLinks.assetId))
    .where(eq(siteContentAssetLinks.contentId, contentId))
    .orderBy(asc(siteContentAssetLinks.position));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  return handleApi(res, async () => {
    const action = requestedAction(req.body);
    const user = siteContentActionAccess(action) === "publisher"
      ? await requireSitePublisher(req)
      : await requireSiteEditor(req);
    let correctionCommand: LegacyEditorialCorrectionCommand | null = null;
    if (action === "apply_editorial_corrections") {
      if (!legacyEditorialCorrectionsEnabled) {
        throw new HttpError(404, "Action indisponible");
      }
      await requireAal2(req);
      try {
        correctionCommand = parseLegacyEditorialCorrectionCommand(req.body);
      } catch (error) {
        inputError(error);
      }
    }
    const id = routeId(req);
    const [current] = await db.select().from(siteContentItems).where(eq(siteContentItems.id, id)).limit(1);
    if (!current) throw new HttpError(404, "Contenu introuvable");
    if (!siteContentStatusAllowsAction(current.status, action)) {
      throw new HttpError(409, action === "publish" ? "Restaurez d’abord ce contenu" : "Ce contenu est archivé");
    }

    if (action === "apply_editorial_corrections") {
      if (!correctionCommand) throw new HttpError(400, "Commande de correction manquante");
      const command = correctionCommand;
      if (
        current.sourceSystem !== "wordpress"
        || !current.importKey
        || current.status !== "brouillon"
        || !current.needsReview
      ) {
        throw new HttpError(409, "Seul un brouillon WordPress encore à vérifier peut être corrigé");
      }
      if (current.version !== command.expectedVersion) {
        throw new HttpError(409, "Ce brouillon a changé. Rechargez-le avant de recommencer.");
      }
      const editorial = applyLegacyPreviewEditorialCorrections({
        title: current.title,
        summary: current.summary,
        bodyMarkdown: current.bodyMarkdown,
      });
      if (editorial.corrections.length === 0) {
        throw new HttpError(409, "Aucune correction sûre n’est disponible pour ce brouillon");
      }
      const links = await contentLinks(id);
      let correctedInput: ReturnType<typeof parseSiteContentInput>;
      try {
        correctedInput = parseSiteContentInput({
          contentType: current.contentType,
          slug: current.slug,
          title: editorial.draft.title,
          summary: editorial.draft.summary,
          bodyMarkdown: editorial.draft.bodyMarkdown,
          category: current.category,
          audience: current.audience,
          templateId: current.templateId,
          featured: current.featured,
          metaTitle: current.metaTitle === current.title ? editorial.draft.title : current.metaTitle,
          metaDescription: current.metaDescription,
          publishAt: current.publishAt,
          expiresAt: current.expiresAt,
          assets: links.map(({ status: _status, ...asset }) => asset),
        });
      } catch (error) {
        inputError(error);
      }
      const nextVersion = command.expectedVersion + 1;
      const importKey = current.importKey;
      return db.transaction(async (tx) => {
        const [item] = await tx
          .update(siteContentItems)
          .set({
            title: correctedInput.title,
            summary: correctedInput.summary,
            bodyMarkdown: correctedInput.bodyMarkdown,
            metaTitle: correctedInput.metaTitle,
            status: "brouillon",
            needsReview: true,
            reviewedAt: null,
            reviewedBy: null,
            version: nextVersion,
            updatedBy: user.id,
          })
          .where(and(
            eq(siteContentItems.id, id),
            eq(siteContentItems.version, command.expectedVersion),
            eq(siteContentItems.status, "brouillon"),
            eq(siteContentItems.needsReview, true),
            eq(siteContentItems.sourceSystem, "wordpress"),
            eq(siteContentItems.importKey, importKey),
          ))
          .returning();
        if (!item) {
          throw new HttpError(409, "Ce brouillon a changé. Rechargez-le avant de recommencer.");
        }
        await tx.insert(siteContentVersions).values({
          contentId: id,
          version: nextVersion,
          snapshot: contentSnapshot(correctedInput, "brouillon", nextVersion),
          createdBy: user.id,
        });
        await tx.insert(siteContentAudit).values({
          resourceType: "content",
          resourceId: id,
          action: "apply_editorial_corrections",
          actorId: user.id,
          summary: {
            previousVersion: command.expectedVersion,
            version: nextVersion,
            correctionCount: editorial.corrections.reduce(
              (total, correction) => total + correction.occurrences,
              0,
            ),
            corrections: editorial.corrections,
          },
        });
        return projectSiteContentAdminMutationPayload(item, action, id);
      });
    }

    if (action === "verify_source") {
      if (!current.needsReview) throw new HttpError(409, "Ce contenu est déjà vérifié");
      const [item] = await db
        .update(siteContentItems)
        .set({
          needsReview: false,
          reviewedAt: new Date(),
          reviewedBy: user.id,
          updatedBy: user.id,
        })
        .where(eq(siteContentItems.id, id))
        .returning();
      await db.insert(siteContentAudit).values({
        resourceType: "content",
        resourceId: id,
        action: "verify_source",
        actorId: user.id,
        summary: { sourceSystem: current.sourceSystem, sourceUpdatedAt: current.sourceUpdatedAt },
      });
      return projectSiteContentAdminMutationPayload(item, action, id);
    }

    if (action === "submit_review") {
      const [item] = await db
        .update(siteContentItems)
        .set({ status: "a_valider", updatedBy: user.id })
        .where(eq(siteContentItems.id, id))
        .returning();
      await db.insert(siteContentAudit).values({
        resourceType: "content",
        resourceId: id,
        action: "submit_review",
        actorId: user.id,
        summary: { version: current.version },
      });
      return projectSiteContentAdminMutationPayload(item, action, id);
    }

    if (action === "publish") {
      if (current.needsReview) {
        throw new HttpError(409, "Vérifiez d’abord les informations reprises de l’ancien site");
      }
      const links = await contentLinks(id);
      if (links.some((asset) => asset.status !== "ready")) {
        throw new HttpError(409, "Un fichier n’est pas prêt à être publié");
      }
      if (current.contentType === "document" && !links.some((asset) => asset.assetRole === "document")) {
        throw new HttpError(409, "Ajoutez au moins un document avant publication");
      }
      if (current.contentType !== "document" && !current.bodyMarkdown.trim()) {
        throw new HttpError(409, "Ajoutez un contenu avant publication");
      }
      const [item] = await db
        .update(siteContentItems)
        .set({
          status: "publie",
          approvedBy: user.id,
          publishedAt: new Date(),
          publishedVersion: current.version,
          updatedBy: user.id,
        })
        .where(eq(siteContentItems.id, id))
        .returning();
      await db.insert(siteContentAudit).values({
        resourceType: "content",
        resourceId: id,
        action: "publish",
        actorId: user.id,
        summary: { version: current.version, publishAt: current.publishAt, expiresAt: current.expiresAt },
      });
      return projectSiteContentAdminMutationPayload(item, action, id);
    }

    if (action === "archive") {
      const [item] = await db
        .update(siteContentItems)
        .set({ status: "archive", updatedBy: user.id })
        .where(eq(siteContentItems.id, id))
        .returning();
      await db.insert(siteContentAudit).values({
        resourceType: "content",
        resourceId: id,
        action: "archive",
        actorId: user.id,
        summary: { publishedVersion: current.publishedVersion },
      });
      return projectSiteContentAdminMutationPayload(item, action, id);
    }

    const links = await contentLinks(id);

    if (action === "duplicate") {
      const suffix = randomUUID().slice(0, 8);
      const slug = `${current.slug}-copie-${suffix}`.slice(0, 140);
      return db.transaction(async (tx) => {
        const [item] = await tx
          .insert(siteContentItems)
          .values({
            contentType: current.contentType,
            slug,
            title: `${current.title} - copie`.slice(0, 180),
            summary: current.summary,
            bodyMarkdown: current.bodyMarkdown,
            category: current.category,
            audience: current.audience,
            templateId: current.templateId,
            featured: false,
            metaTitle: current.metaTitle,
            metaDescription: current.metaDescription,
            sourceSystem: null,
            sourceUrl: null,
            sourceUpdatedAt: null,
            importKey: null,
            sourceDisposition: null,
            needsReview: false,
            importedAt: null,
            reviewedAt: null,
            reviewedBy: null,
            createdBy: user.id,
            updatedBy: user.id,
          })
          .returning();
        const input = parseSiteContentInput({
          ...item,
          assets: links.map(({ status: _status, ...asset }) => asset),
        });
        await tx.insert(siteContentVersions).values({
          contentId: item.id,
          version: 1,
          snapshot: contentSnapshot(input, "brouillon", 1),
          createdBy: user.id,
        });
        if (links.length > 0) {
          await tx.insert(siteContentAssetLinks).values(
            links.map(({ status: _status, ...asset }) => ({ contentId: item.id, ...asset }))
          );
        }
        await tx.insert(siteContentAudit).values({
          resourceType: "content",
          resourceId: item.id,
          action: "duplicate",
          actorId: user.id,
          summary: { sourceId: id },
        });
        return projectSiteContentAdminMutationPayload(item, action, id);
      });
    }

    const body = req.body as Record<string, unknown>;
    const requestedVersion = Number(body.version ?? current.version);
    if (!Number.isInteger(requestedVersion) || requestedVersion < 1) {
      throw new HttpError(400, "Version invalide");
    }
    const versions = await db
      .select()
      .from(siteContentVersions)
      .where(eq(siteContentVersions.contentId, id));
    const versionToRestore = versions.find((version) => version.version === requestedVersion);
    if (!versionToRestore) throw new HttpError(404, "Version introuvable");
    let restored;
    try {
      restored = parseSiteContentInput(versionToRestore.snapshot);
    } catch (error) {
      inputError(error);
    }
    const assetIds = restored.assets.map((asset) => asset.assetId);
    if (assetIds.length > 0) {
      const ready = await db
        .select({ id: siteContentAssets.id })
        .from(siteContentAssets)
        .where(and(inArray(siteContentAssets.id, assetIds), eq(siteContentAssets.status, "ready")));
      if (ready.length !== assetIds.length) throw new HttpError(409, "Un ancien fichier n’est plus disponible");
    }
    const nextVersion = current.version + 1;
    return db.transaction(async (tx) => {
      const [item] = await tx
        .update(siteContentItems)
        .set({
          contentType: restored.contentType,
          slug: restored.slug,
          title: restored.title,
          summary: restored.summary,
          bodyMarkdown: restored.bodyMarkdown,
          category: restored.category,
          audience: restored.audience,
          templateId: restored.templateId,
          featured: restored.featured,
          metaTitle: restored.metaTitle,
          metaDescription: restored.metaDescription,
          publishAt: restored.publishAt,
          expiresAt: restored.expiresAt,
          status: "brouillon",
          needsReview: Boolean(current.importKey),
          reviewedAt: null,
          reviewedBy: null,
          version: nextVersion,
          updatedBy: user.id,
        })
        .where(eq(siteContentItems.id, id))
        .returning();
      await tx.delete(siteContentAssetLinks).where(eq(siteContentAssetLinks.contentId, id));
      if (restored.assets.length > 0) {
        await tx.insert(siteContentAssetLinks).values(
          restored.assets.map((asset) => ({ contentId: id, ...asset }))
        );
      }
      await tx.insert(siteContentVersions).values({
        contentId: id,
        version: nextVersion,
        snapshot: contentSnapshot(restored, "brouillon", nextVersion),
        createdBy: user.id,
      });
      await tx.insert(siteContentAudit).values({
        resourceType: "content",
        resourceId: id,
        action: "restore",
        actorId: user.id,
        summary: { restoredVersion: requestedVersion, version: nextVersion },
      });
      return projectSiteContentAdminMutationPayload(item, action, id);
    });
  });
}

export const config = { api: { bodyParser: { sizeLimit: "8kb" } } };
