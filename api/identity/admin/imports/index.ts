import type { VercelRequest, VercelResponse } from "@vercel/node";
import { desc, eq } from "drizzle-orm";
import { db } from "../../../../db/index.js";
import {
  identityDirectoryAudit,
  identityDirectoryImports,
} from "../../../../db/schema.js";
import { parseIdentityDirectoryInput } from "../../../../shared/identity-directory-input.js";
import { supabaseAdmin } from "../../../_shared/auth.js";
import {
  IDENTITY_DIRECTORY_BUCKET,
  requireIdentityDirectoryManager,
} from "../../../_shared/identity-directory.js";
import { identityDirectoryStoragePath } from "../../../_shared/identity-directory-path.js";
import { identityDirectoryView } from "../../../_shared/identity-directory-view.js";
import { registryInputError } from "../../../_shared/knowledge-registry.js";
import { handleApi, methodNotAllowed } from "../../../_shared/response.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "GET") {
    return handleApi(res, async () => {
      const context = await requireIdentityDirectoryManager(req);
      const imports = await db
        .select()
        .from(identityDirectoryImports)
        .where(eq(identityDirectoryImports.institutionId, context.institutionId))
        .orderBy(desc(identityDirectoryImports.createdAt))
        .limit(100);
      return { imports: imports.map(identityDirectoryView) };
    });
  }

  if (req.method === "POST") {
    return handleApi(res, async () => {
      const context = await requireIdentityDirectoryManager(req);
      let input;
      try {
        input = parseIdentityDirectoryInput(req.body);
      } catch (error) {
        registryInputError(error);
      }

      const storagePath = identityDirectoryStoragePath(
        context.institutionId,
        context.user.id,
        input.originalName
      );
      const { data: upload, error: uploadError } = await supabaseAdmin.storage
        .from(IDENTITY_DIRECTORY_BUCKET)
        .createSignedUploadUrl(storagePath);
      if (uploadError || !upload) {
        throw new Error("Le dépôt privé des identités est momentanément indisponible");
      }

      const [directoryImport] = await db
        .insert(identityDirectoryImports)
        .values({
          institutionId: context.institutionId,
          ...input,
          storageBucket: IDENTITY_DIRECTORY_BUCKET,
          storagePath,
          uploadedBy: context.user.id,
          status: "reserved",
        })
        .returning();
      await db.insert(identityDirectoryAudit).values({
        institutionId: context.institutionId,
        resourceType: "import",
        resourceId: directoryImport.id,
        action: "reserve_upload",
        actorId: context.user.id,
        summary: {
          sourceType: directoryImport.sourceType,
          mimeType: directoryImport.mimeType,
          sizeBytes: directoryImport.sizeBytes,
        },
      });
      return {
        import: identityDirectoryView(directoryImport),
        upload: {
          bucket: IDENTITY_DIRECTORY_BUCKET,
          path: upload.path,
          token: upload.token,
        },
      };
    });
  }

  return methodNotAllowed(res, ["GET", "POST"]);
}

export const config = { api: { bodyParser: { sizeLimit: "8kb" } } };
