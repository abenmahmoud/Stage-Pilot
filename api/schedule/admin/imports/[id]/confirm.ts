import { randomUUID } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "../../../../../db/index.js";
import { scheduleAudit, scheduleSourceVersions } from "../../../../../db/schema.js";
import { HttpError, supabaseAdmin } from "../../../../_shared/auth.js";
import { handleApi, methodNotAllowed } from "../../../../_shared/response.js";
import { requireScheduleManager } from "../../../../_shared/schedule-imports.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function routeId(req: VercelRequest): string {
  const value = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (!value || !UUID.test(value)) throw new HttpError(400, "Version invalide.");
  return value;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  return handleApi(res, async () => {
    const context = await requireScheduleManager(req);
    const id = routeId(req);
    const [source] = await db
      .select()
      .from(scheduleSourceVersions)
      .where(
        and(
          eq(scheduleSourceVersions.id, id),
          eq(scheduleSourceVersions.institutionId, context.institutionId)
        )
      )
      .limit(1);
    if (!source) throw new HttpError(404, "Version introuvable.");
    if (["quarantined", "processing", "review", "approved", "active"].includes(source.status)) {
      return { import: source, duplicate: true };
    }
    if (!["reserved", "uploaded"].includes(source.status)) {
      throw new HttpError(409, "Ce dépôt ne peut plus être confirmé.");
    }

    if (source.status === "reserved") {
      const separator = source.storagePath.lastIndexOf("/");
      const folder = source.storagePath.slice(0, separator);
      const fileName = source.storagePath.slice(separator + 1);
      const { data: files, error } = await supabaseAdmin.storage
        .from(source.storageBucket)
        .list(folder, { search: fileName, limit: 10 });
      const uploaded = files?.find((file) => file.name === fileName);
      if (error || !uploaded) {
        throw new HttpError(409, "Le PDF n'a pas été reçu complètement.");
      }

      const metadata = (uploaded.metadata ?? {}) as Record<string, unknown>;
      const uploadedSize = Number(metadata.size ?? 0);
      const uploadedMime = String(metadata.mimetype ?? metadata.mimeType ?? "");
      if (
        uploadedSize !== source.sizeBytes ||
        (uploadedMime && uploadedMime !== source.mimeType)
      ) {
        await supabaseAdmin.storage.from(source.storageBucket).remove([source.storagePath]);
        await db.transaction(async (tx) => {
          await tx
            .update(scheduleSourceVersions)
            .set({
              status: "rejected",
              validationSummary: {
                reason: "uploaded_file_mismatch",
                expectedSize: source.sizeBytes,
                receivedSize: uploadedSize,
                expectedMime: source.mimeType,
                receivedMime: uploadedMime || "unknown",
              },
            })
            .where(eq(scheduleSourceVersions.id, id));
          await tx.insert(scheduleAudit).values({
            institutionId: context.institutionId,
            sourceVersionId: id,
            action: "reject_upload",
            actorId: context.user.id,
            summary: {
              expectedSize: source.sizeBytes,
              receivedSize: uploadedSize,
              expectedMime: source.mimeType,
              receivedMime: uploadedMime || "unknown",
            },
          });
        });
        throw new HttpError(400, "Le PDF reçu ne correspond pas au fichier annoncé.");
      }
    }

    const jobId = randomUUID();
    const confirmed = await db.transaction(async (tx) => {
      const rows = await tx
        .update(scheduleSourceVersions)
        .set({
          status: "quarantined",
          uploadedAt: new Date(),
          validationSummary: {
            securityScan: "queued",
            pageCountVerified: false,
            indexing: "blocked",
            activation: "blocked",
            realDataAllowedInModel: false,
          },
        })
        .where(
          and(
            eq(scheduleSourceVersions.id, id),
            eq(scheduleSourceVersions.institutionId, context.institutionId),
            inArray(scheduleSourceVersions.status, ["reserved", "uploaded"])
          )
        )
        .returning();
      if (!rows[0]) return [];
      await tx.insert(scheduleAudit).values({
        institutionId: context.institutionId,
        sourceVersionId: id,
        action: "confirm_upload",
        actorId: context.user.id,
        summary: { mimeType: source.mimeType, sizeBytes: source.sizeBytes, jobId },
      });
      await tx.execute(sql`
        select pgmq.send(
          'schedule_document_scan',
          jsonb_build_object(
            'job_id', ${jobId}::uuid,
            'job_type', 'scan_schedule_document',
            'institution_id', ${context.institutionId}::uuid,
            'source_version_id', ${id}::uuid,
            'attempt', 0
          )
        )
      `);
      return rows;
    });
    if (!confirmed[0]) throw new HttpError(409, "Ce dépôt a déjà été traité.");
    res.status(202);
    return { import: confirmed[0], duplicate: false };
  });
}
