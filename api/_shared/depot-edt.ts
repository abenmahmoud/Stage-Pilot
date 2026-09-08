import { randomUUID } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { scheduleAudit, scheduleSourceVersions } from "../../db/schema.js";
import {
  parseScheduleImportInput,
  type ScheduleImportInput,
} from "../../shared/schedule-import-input.js";
import { parisDateStringOf } from "../../shared/paris-time.js";
import { HttpError, supabaseAdmin } from "./auth.js";
import type { DepotMultipartPayload } from "./depot-multipart.js";
import {
  SCHEDULE_IMPORT_BUCKET,
  scheduleImportStoragePath,
} from "./schedule-imports.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(400, "La commande EDT est invalide");
  }
  return value as Record<string, unknown>;
}

function schoolYearFor(day: string): string {
  const year = Number(day.slice(0, 4));
  const month = Number(day.slice(5, 7));
  const start = month >= 8 ? year : year - 1;
  return `${start}-${start + 1}`;
}

function plusDays(day: string, count: number): string {
  const date = new Date(`${day}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}

function scheduleInput(input: {
  originalName: string;
  sizeBytes: number;
  fields?: Record<string, string>;
  json?: Record<string, unknown>;
}): ScheduleImportInput {
  const today = parisDateStringOf(new Date());
  const source = input.json ?? input.fields ?? {};
  try {
    return parseScheduleImportInput({
      sourceKind: source.sourceKind ?? source.source_kind ?? "classes",
      sourceFormat: "pdf_import",
      schoolYear: source.schoolYear ?? source.annee_scolaire ?? schoolYearFor(today),
      title: source.title ?? source.titre ?? "Emploi du temps reçu du Dépôt Lycée",
      purposeDescription:
        "Emploi du temps officiel à contrôler et valider humainement avant sa publication.",
      effectiveFrom: source.effectiveFrom ?? source.valide_du ?? today,
      effectiveUntil: source.effectiveUntil ?? source.valide_au ?? null,
      freshUntil: source.freshUntil ?? source.fraiche_jusquau ?? plusDays(today, 7),
      originalName: input.originalName,
      mimeType: "application/pdf",
      sizeBytes: input.sizeBytes,
    });
  } catch {
    throw new HttpError(400, "Les métadonnées de l'emploi du temps sont invalides");
  }
}

export type DepotEdtReservation = {
  importId: string;
  status: "reserved";
  upload: { bucket: string; path: string; token: string };
};

export async function reserveDepotEdt(params: {
  institutionId: string;
  actorId: string;
  input: ScheduleImportInput;
}): Promise<DepotEdtReservation> {
  const storagePath = scheduleImportStoragePath(
    params.institutionId,
    params.actorId,
    params.input.schoolYear,
    params.input.sourceKind,
    ".pdf"
  );
  const { data: upload, error: uploadError } = await supabaseAdmin.storage
    .from(SCHEDULE_IMPORT_BUCKET)
    .createSignedUploadUrl(storagePath);
  if (uploadError || !upload) throw new HttpError(503, "Le stockage privé des emplois du temps est indisponible");

  const [created] = await db.transaction(async (tx) => {
    await tx.execute(sql`
      select pg_advisory_xact_lock(
        hashtextextended(
          ${`${params.institutionId}:${params.input.sourceKind}:${params.input.schoolYear}`},
          61743
        )
      )
    `);
    const [latest] = await tx
      .select({ version: sql<number>`coalesce(max(${scheduleSourceVersions.version}), 0)` })
      .from(scheduleSourceVersions)
      .where(and(
        eq(scheduleSourceVersions.institutionId, params.institutionId),
        eq(scheduleSourceVersions.sourceKind, params.input.sourceKind),
        eq(scheduleSourceVersions.schoolYear, params.input.schoolYear)
      ));
    const rows = await tx.insert(scheduleSourceVersions).values({
      institutionId: params.institutionId,
      ...params.input,
      version: Number(latest?.version ?? 0) + 1,
      freshUntil: new Date(`${params.input.freshUntil}T23:59:59.999Z`),
      storageBucket: SCHEDULE_IMPORT_BUCKET,
      storagePath,
      status: "reserved",
      uploadedBy: params.actorId,
      validationSummary: {
        securityScan: "pending",
        indexing: "blocked",
        activation: "blocked",
        source: "depot_lycee",
        realDataAllowedInModel: false,
      },
    }).returning();
    const source = rows[0];
    await tx.insert(scheduleAudit).values({
      institutionId: params.institutionId,
      sourceVersionId: source.id,
      action: "reserve_upload",
      actorId: params.actorId,
      summary: {
        sourceKind: params.input.sourceKind,
        schoolYear: params.input.schoolYear,
        version: source.version,
        sizeBytes: params.input.sizeBytes,
        source: "depot_lycee",
      },
    });
    return rows;
  });
  return {
    importId: created.id,
    status: "reserved",
    upload: { bucket: SCHEDULE_IMPORT_BUCKET, path: upload.path, token: upload.token },
  };
}

export async function confirmDepotEdt(params: {
  institutionId: string;
  actorId: string;
  importId: string;
}): Promise<{ importId: string; status: string; duplicate: boolean }> {
  if (!UUID.test(params.importId)) throw new HttpError(400, "Version EDT invalide");
  const [source] = await db.select().from(scheduleSourceVersions).where(and(
    eq(scheduleSourceVersions.id, params.importId),
    eq(scheduleSourceVersions.institutionId, params.institutionId)
  )).limit(1);
  if (!source) throw new HttpError(404, "Version EDT introuvable");
  if (["quarantined", "processing", "review", "approved", "active"].includes(source.status)) {
    return { importId: source.id, status: source.status, duplicate: true };
  }
  if (source.status !== "reserved") throw new HttpError(409, "Cette version EDT ne peut plus être confirmée");
  const separator = source.storagePath.lastIndexOf("/");
  const folder = source.storagePath.slice(0, separator);
  const fileName = source.storagePath.slice(separator + 1);
  const { data: files, error } = await supabaseAdmin.storage
    .from(source.storageBucket)
    .list(folder, { search: fileName, limit: 10 });
  const uploaded = files?.find((file) => file.name === fileName);
  const metadata = (uploaded?.metadata ?? {}) as Record<string, unknown>;
  const mime = String(metadata.mimetype ?? metadata.mimeType ?? "");
  if (
    error || !uploaded || Number(metadata.size ?? 0) !== source.sizeBytes
    || (mime && mime !== "application/pdf")
  ) throw new HttpError(409, "Le PDF EDT n'a pas été reçu complètement");

  const jobId = randomUUID();
  const rows = await db.transaction(async (tx) => {
    const updated = await tx.update(scheduleSourceVersions).set({
      status: "quarantined",
      uploadedAt: new Date(),
      validationSummary: {
        securityScan: "queued",
        pageCountVerified: false,
        indexing: "blocked",
        activation: "blocked",
        source: "depot_lycee",
        realDataAllowedInModel: false,
      },
    }).where(and(
      eq(scheduleSourceVersions.id, params.importId),
      eq(scheduleSourceVersions.institutionId, params.institutionId),
      inArray(scheduleSourceVersions.status, ["reserved", "uploaded"])
    )).returning();
    if (!updated[0]) return [];
    await tx.insert(scheduleAudit).values({
      institutionId: params.institutionId,
      sourceVersionId: params.importId,
      action: "confirm_upload",
      actorId: params.actorId,
      summary: { mimeType: source.mimeType, sizeBytes: source.sizeBytes, jobId, source: "depot_lycee" },
    });
    await tx.execute(sql`
      select pgmq.send(
        'schedule_document_scan',
        jsonb_build_object(
          'job_id', ${jobId}::uuid,
          'job_type', 'scan_schedule_document',
          'institution_id', ${params.institutionId}::uuid,
          'source_version_id', ${params.importId}::uuid,
          'attempt', 0
        )
      )
    `);
    return updated;
  });
  if (!rows[0]) throw new HttpError(409, "Cette version EDT a déjà été traitée");
  return { importId: rows[0].id, status: rows[0].status, duplicate: false };
}

export async function receiveDepotEdtMultipart(params: {
  institutionId: string;
  actorId: string;
  payload: DepotMultipartPayload;
}) {
  const file = params.payload.files.fichier;
  if (!file || params.payload.files.rapport || !/\.pdf$/i.test(file.fileName) || file.mimeType !== "application/pdf") {
    throw new HttpError(415, "L'emploi du temps doit être un unique fichier PDF");
  }
  const input = scheduleInput({
    originalName: file.fileName,
    sizeBytes: file.bytes.length,
    fields: params.payload.fields,
  });
  const reservation = await reserveDepotEdt({ ...params, input });
  const { error } = await supabaseAdmin.storage
    .from(reservation.upload.bucket)
    .uploadToSignedUrl(reservation.upload.path, reservation.upload.token, file.bytes, {
      contentType: "application/pdf",
    });
  if (error) throw new HttpError(503, "Le transfert privé de l'emploi du temps a échoué");
  return confirmDepotEdt({
    institutionId: params.institutionId,
    actorId: params.actorId,
    importId: reservation.importId,
  });
}

export async function handleDepotEdtJson(params: {
  institutionId: string;
  actorId: string;
  body: unknown;
}): Promise<DepotEdtReservation | { importId: string; status: string; duplicate: boolean }> {
  const input = record(params.body);
  if (input.mode === "confirm") {
    const keys = Object.keys(input);
    if (keys.length !== 2 || !keys.includes("importId") || typeof input.importId !== "string") {
      throw new HttpError(400, "La confirmation EDT est invalide");
    }
    return confirmDepotEdt({ ...params, importId: input.importId });
  }
  const expected = [
    "mode", "originalName", "sizeBytes", "schoolYear", "title",
    "effectiveFrom", "effectiveUntil", "freshUntil", "sourceKind",
  ];
  const keys = Object.keys(input);
  if (input.mode !== "reserve" || keys.length !== expected.length || keys.some((key) => !expected.includes(key))) {
    throw new HttpError(400, "La réservation EDT est invalide");
  }
  if (typeof input.originalName !== "string") throw new HttpError(400, "La réservation EDT est invalide");
  const parsed = scheduleInput({
    originalName: input.originalName,
    sizeBytes: Number(input.sizeBytes),
    json: input,
  });
  return reserveDepotEdt({ ...params, input: parsed });
}
