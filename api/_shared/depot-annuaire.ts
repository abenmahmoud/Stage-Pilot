import { createHash, randomUUID } from "node:crypto";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { identityDirectoryAudit, identityDirectoryImports } from "../../db/schema.js";
import { HttpError, supabaseAdmin } from "./auth.js";
import { IDENTITY_DIRECTORY_BUCKET } from "./identity-directory.js";
import {
  identityDirectoryStoragePath,
  identityDirectoryVerificationReportPath,
} from "./identity-directory-path.js";
import type { DepotMultipartPayload } from "./depot-multipart.js";

export type DepotAnnuaireResult = {
  importId: string;
  status: string;
  duplicate: boolean;
};

export async function receiveDepotAnnuaire(params: {
  institutionId: string;
  actorId: string;
  payload: DepotMultipartPayload;
}): Promise<DepotAnnuaireResult> {
  const file = params.payload.files.fichier;
  const report = params.payload.files.rapport;
  if (!file || !report) {
    throw new HttpError(400, "Les champs fichier et rapport sont obligatoires pour l'annuaire");
  }
  if (!/\.csv$/i.test(file.fileName) || file.mimeType !== "text/csv") {
    throw new HttpError(415, "L'annuaire doit être un fichier CSV");
  }
  if (!/\.txt$/i.test(report.fileName) || report.mimeType !== "text/plain") {
    throw new HttpError(415, "Le rapport associé doit être un fichier texte");
  }
  const checksum = createHash("sha256").update(file.bytes).digest("hex");
  const [existing] = await db
    .select({ id: identityDirectoryImports.id, status: identityDirectoryImports.status })
    .from(identityDirectoryImports)
    .where(and(
      eq(identityDirectoryImports.institutionId, params.institutionId),
      eq(identityDirectoryImports.checksum, checksum),
      inArray(identityDirectoryImports.status, ["review", "approved", "active", "superseded", "retired"])
    ))
    .orderBy(desc(identityDirectoryImports.createdAt))
    .limit(1);
  if (existing) return { importId: existing.id, status: existing.status, duplicate: true };

  const storagePath = identityDirectoryStoragePath(
    params.institutionId,
    params.actorId,
    file.fileName
  );
  const reportPath = identityDirectoryVerificationReportPath(params.institutionId, params.actorId);
  const mainUpload = await supabaseAdmin.storage.from(IDENTITY_DIRECTORY_BUCKET).upload(
    storagePath,
    file.bytes,
    { contentType: "text/csv", upsert: false }
  );
  if (mainUpload.error) throw new HttpError(503, "Le stockage privé de l'annuaire est indisponible");
  const reportUpload = await supabaseAdmin.storage.from(IDENTITY_DIRECTORY_BUCKET).upload(
    reportPath,
    report.bytes,
    { contentType: "text/plain", upsert: false }
  );
  if (reportUpload.error) {
    await supabaseAdmin.storage.from(IDENTITY_DIRECTORY_BUCKET).remove([storagePath]);
    throw new HttpError(503, "Le stockage privé du rapport est indisponible");
  }

  try {
    const jobId = randomUUID();
    const [created] = await db.transaction(async (tx) => {
      await tx.execute(sql`
        select pg_advisory_xact_lock(
          hashtextextended(${`depot-annuaire:${params.institutionId}:${checksum}`}, 91327)
        )
      `);
      const [duplicate] = await tx
        .select({ id: identityDirectoryImports.id, status: identityDirectoryImports.status })
        .from(identityDirectoryImports)
        .where(and(
          eq(identityDirectoryImports.institutionId, params.institutionId),
          eq(identityDirectoryImports.checksum, checksum),
          inArray(identityDirectoryImports.status, ["review", "approved", "active", "superseded", "retired"])
        ))
        .limit(1);
      if (duplicate) return [{ ...duplicate, duplicate: true }];
      const rows = await tx.insert(identityDirectoryImports).values({
        institutionId: params.institutionId,
        title: params.payload.fields.titre || "Annuaire officiel reçu du Dépôt Lycée",
        purposeDescription:
          "Export officiel destiné uniquement à la vérification d'identité et des droits associés.",
        sourceType: "official_export",
        originalName: file.fileName,
        mimeType: "text/csv",
        sizeBytes: file.bytes.length,
        storageBucket: IDENTITY_DIRECTORY_BUCKET,
        storagePath,
        checksum,
        status: "quarantined",
        uploadedBy: params.actorId,
        uploadedAt: new Date(),
        validationSummary: {
          antivirus: "pending",
          verificationReport: {
            originalName: report.fileName,
            mimeType: "text/plain",
            sizeBytes: report.bytes.length,
            storageBucket: IDENTITY_DIRECTORY_BUCKET,
            storagePath: reportPath,
          },
        },
      }).returning();
      const createdImport = rows[0];
      await tx.insert(identityDirectoryAudit).values([
        {
          institutionId: params.institutionId,
          resourceType: "import",
          resourceId: createdImport.id,
          action: "confirm_upload",
          actorId: params.actorId,
          summary: { sourceType: "depot_lycee", sizeBytes: file.bytes.length },
        },
        {
          institutionId: params.institutionId,
          resourceType: "import",
          resourceId: createdImport.id,
          action: "queue_scan",
          actorId: params.actorId,
          summary: { jobId },
        },
      ]);
      await tx.execute(sql`
        select pgmq.send(
          'identity_directory_scan',
          jsonb_build_object(
            'job_id', ${jobId}::uuid,
            'job_type', 'scan_identity_directory',
            'institution_id', ${params.institutionId}::uuid,
            'import_id', ${createdImport.id}::uuid,
            'attempt', 0
          )
        )
      `);
      return [{ id: createdImport.id, status: createdImport.status, duplicate: false }];
    });
    if (created.duplicate) {
      await supabaseAdmin.storage.from(IDENTITY_DIRECTORY_BUCKET).remove([storagePath, reportPath]);
    }
    return { importId: created.id, status: created.status, duplicate: created.duplicate };
  } catch (error) {
    await supabaseAdmin.storage.from(IDENTITY_DIRECTORY_BUCKET).remove([storagePath, reportPath]);
    throw error;
  }
}
