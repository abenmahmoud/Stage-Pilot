import { randomUUID } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "../../../../../db/index.js";
import {
  identityDirectoryAudit,
  identityDirectoryImports,
} from "../../../../../db/schema.js";
import { isIdentityDirectoryActionPayload } from "../../../../../shared/identity-directory-admin-payload-policy.js";
import { HttpError, supabaseAdmin } from "../../../../_shared/auth.js";
import { requireIdentityDirectoryManager } from "../../../../_shared/identity-directory.js";
import { identityDirectoryActionView } from "../../../../_shared/identity-directory-view.js";
import { handleApi, methodNotAllowed } from "../../../../_shared/response.js";

function routeId(req: VercelRequest): string {
  const value = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (!value || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new HttpError(400, "Import invalide");
  }
  return value;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  return handleApi(res, async () => {
    const context = await requireIdentityDirectoryManager(req);
    const id = routeId(req);
    const [directoryImport] = await db
      .select()
      .from(identityDirectoryImports)
      .where(
        and(
          eq(identityDirectoryImports.id, id),
          eq(identityDirectoryImports.institutionId, context.institutionId)
        )
      )
      .limit(1);
    if (!directoryImport) throw new HttpError(404, "Import introuvable");
    if (["quarantined", "parsing", "review", "approved", "active"].includes(directoryImport.status)) {
      const payload = { import: identityDirectoryActionView(directoryImport), duplicate: true };
      if (!isIdentityDirectoryActionPayload(
        payload,
        id,
        ["quarantined", "parsing", "review", "approved", "active"]
      )) {
        throw new HttpError(503, "La confirmation du dépôt privé est invalide.");
      }
      return payload;
    }
    if (!["reserved", "uploaded"].includes(directoryImport.status)) {
      throw new HttpError(409, "Ce dépôt ne peut plus être confirmé");
    }

    if (directoryImport.status === "reserved") {
      const separator = directoryImport.storagePath.lastIndexOf("/");
      const folder = directoryImport.storagePath.slice(0, separator);
      const fileName = directoryImport.storagePath.slice(separator + 1);
      const { data: files, error } = await supabaseAdmin.storage
        .from(directoryImport.storageBucket)
        .list(folder, { search: fileName, limit: 10 });
      const uploaded = files?.find((file) => file.name === fileName);
      if (error || !uploaded) {
        throw new HttpError(409, "Le fichier n’a pas été reçu complètement");
      }

      const metadata = (uploaded.metadata ?? {}) as Record<string, unknown>;
      const uploadedSize = Number(metadata.size ?? 0);
      const uploadedMime = String(metadata.mimetype ?? metadata.mimeType ?? "");
      if (
        uploadedSize !== directoryImport.sizeBytes ||
        (uploadedMime && uploadedMime !== directoryImport.mimeType)
      ) {
        await supabaseAdmin.storage
          .from(directoryImport.storageBucket)
          .remove([directoryImport.storagePath]);
        await db
          .update(identityDirectoryImports)
          .set({
            status: "rejected",
            validationSummary: { reason: "uploaded_file_mismatch" },
          })
          .where(eq(identityDirectoryImports.id, id));
        await db.insert(identityDirectoryAudit).values({
          institutionId: context.institutionId,
          resourceType: "import",
          resourceId: id,
          action: "reject_upload",
          actorId: context.user.id,
          summary: {
            uploadedSize,
            declaredSize: directoryImport.sizeBytes,
            uploadedMime,
            declaredMime: directoryImport.mimeType,
          },
        });
        throw new HttpError(400, "Le fichier reçu ne correspond pas au fichier annoncé");
      }
    }

    const jobId = randomUUID();
    const [confirmed] = await db.transaction(async (tx) => {
      const updated = await tx
        .update(identityDirectoryImports)
        .set({
          status: "quarantined",
          uploadedAt: directoryImport.uploadedAt ?? new Date(),
          validationSummary: { antivirus: "pending" },
        })
        .where(
          and(
            eq(identityDirectoryImports.id, id),
            eq(identityDirectoryImports.institutionId, context.institutionId),
            inArray(identityDirectoryImports.status, ["reserved", "uploaded"])
          )
        )
        .returning();
      if (!updated[0]) return [];
      await tx.insert(identityDirectoryAudit).values([
        {
          institutionId: context.institutionId,
          resourceType: "import",
          resourceId: id,
          action: "confirm_upload",
          actorId: context.user.id,
          summary: {
            mimeType: directoryImport.mimeType,
            sizeBytes: directoryImport.sizeBytes,
          },
        },
        {
          institutionId: context.institutionId,
          resourceType: "import",
          resourceId: id,
          action: "queue_scan",
          actorId: context.user.id,
          summary: { jobId },
        },
      ]);
      await tx.execute(sql`
        select pgmq.send(
          'identity_directory_scan',
          jsonb_build_object(
            'job_id', ${jobId}::uuid,
            'job_type', 'scan_identity_directory',
            'institution_id', ${context.institutionId}::uuid,
            'import_id', ${id}::uuid,
            'attempt', 0
          )
        )
      `);
      return updated;
    });
    if (!confirmed) {
      throw new HttpError(409, "Ce dépôt a déjà été traité");
    }
    res.status(202);
    const payload = { import: identityDirectoryActionView(confirmed), duplicate: false };
    if (!isIdentityDirectoryActionPayload(payload, id, ["quarantined"])) {
      throw new HttpError(503, "La confirmation du dépôt privé est invalide.");
    }
    return payload;
  });
}

export const config = { api: { bodyParser: false } };
