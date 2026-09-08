import type { VercelRequest, VercelResponse } from "@vercel/node";
import { desc, eq } from "drizzle-orm";
import { db } from "../../../../db/index.js";
import {
  identityDirectoryAudit,
  identityDirectoryImports,
} from "../../../../db/schema.js";
import { parseIdentityDirectoryInput } from "../../../../shared/identity-directory-input.js";
import {
  isIdentityDirectoryListPayload,
  isIdentityDirectoryReservationPayload,
} from "../../../../shared/identity-directory-admin-payload-policy.js";
import { HttpError, supabaseAdmin } from "../../../_shared/auth.js";
import {
  IDENTITY_DIRECTORY_BUCKET,
  requireIdentityDirectoryManager,
} from "../../../_shared/identity-directory.js";
import {
  identityDirectoryStoragePath,
  identityDirectoryVerificationReportPath,
} from "../../../_shared/identity-directory-path.js";
import {
  identityDirectoryActionView,
  identityDirectoryListView,
} from "../../../_shared/identity-directory-view.js";
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
      const payload = { imports: imports.map(identityDirectoryListView) };
      if (!isIdentityDirectoryListPayload(payload)) {
        throw new HttpError(503, "La liste du répertoire privé est invalide.");
      }
      return payload;
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
      const verificationReportPath = input.verificationReport
        ? identityDirectoryVerificationReportPath(context.institutionId, context.user.id)
        : null;
      const [mainUploadResult, reportUploadResult] = await Promise.all([
        supabaseAdmin.storage
          .from(IDENTITY_DIRECTORY_BUCKET)
          .createSignedUploadUrl(storagePath),
        verificationReportPath
          ? supabaseAdmin.storage
            .from(IDENTITY_DIRECTORY_BUCKET)
            .createSignedUploadUrl(verificationReportPath)
          : Promise.resolve({ data: null, error: null }),
      ]);
      const upload = mainUploadResult.data;
      const reportUpload = reportUploadResult.data;
      if (
        mainUploadResult.error || !upload
        || (verificationReportPath && (reportUploadResult.error || !reportUpload))
      ) {
        throw new Error("Le dépôt privé des identités est momentanément indisponible");
      }

      const { verificationReport, ...directoryInput } = input;
      const [directoryImport] = await db
        .insert(identityDirectoryImports)
        .values({
          institutionId: context.institutionId,
          ...directoryInput,
          storageBucket: IDENTITY_DIRECTORY_BUCKET,
          storagePath,
          uploadedBy: context.user.id,
          status: "reserved",
          validationSummary: verificationReport && verificationReportPath
            ? {
              verificationReport: {
                ...verificationReport,
                storageBucket: IDENTITY_DIRECTORY_BUCKET,
                storagePath: verificationReportPath,
              },
            }
            : {},
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
          verificationReportRequired: Boolean(verificationReport),
        },
      });
      const payload = {
        import: identityDirectoryActionView(directoryImport),
        upload: {
          bucket: IDENTITY_DIRECTORY_BUCKET,
          path: upload.path,
          token: upload.token,
        },
        verificationReportUpload: reportUpload && verificationReportPath
          ? {
            bucket: IDENTITY_DIRECTORY_BUCKET,
            path: reportUpload.path,
            token: reportUpload.token,
          }
          : null,
      };
      if (!isIdentityDirectoryReservationPayload(payload)) {
        throw new HttpError(503, "La réservation du dépôt privé est invalide.");
      }
      return payload;
    });
  }

  return methodNotAllowed(res, ["GET", "POST"]);
}

export const config = { api: { bodyParser: { sizeLimit: "8kb" } } };
