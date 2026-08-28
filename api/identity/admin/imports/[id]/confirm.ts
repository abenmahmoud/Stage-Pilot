import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq } from "drizzle-orm";
import { db } from "../../../../../db/index.js";
import {
  identityDirectoryAudit,
  identityDirectoryImports,
} from "../../../../../db/schema.js";
import { HttpError, supabaseAdmin } from "../../../../_shared/auth.js";
import { requireIdentityDirectoryManager } from "../../../../_shared/identity-directory.js";
import { handleApi, methodNotAllowed } from "../../../../_shared/response.js";

function routeId(req: VercelRequest): string {
  const value = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (!value) throw new HttpError(400, "Import manquant");
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
    if (directoryImport.status === "uploaded") return { import: directoryImport };
    if (directoryImport.status !== "reserved") {
      throw new HttpError(409, "Ce dépôt ne peut plus être confirmé");
    }

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

    const [confirmed] = await db
      .update(identityDirectoryImports)
      .set({ status: "uploaded", uploadedAt: new Date(), validationSummary: {} })
      .where(
        and(
          eq(identityDirectoryImports.id, id),
          eq(identityDirectoryImports.institutionId, context.institutionId),
          eq(identityDirectoryImports.status, "reserved")
        )
      )
      .returning();
    if (!confirmed) {
      throw new HttpError(409, "Ce dépôt a déjà été traité");
    }
    await db.insert(identityDirectoryAudit).values({
      institutionId: context.institutionId,
      resourceType: "import",
      resourceId: id,
      action: "confirm_upload",
      actorId: context.user.id,
      summary: {
        mimeType: directoryImport.mimeType,
        sizeBytes: directoryImport.sizeBytes,
      },
    });
    return { import: confirmed };
  });
}
