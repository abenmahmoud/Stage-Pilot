import { createHash, randomUUID } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { scheduleAudit, scheduleSourceVersions } from "../../db/schema.js";
import {
  parseScheduleImportInput,
  scheduleImportFileExtension,
  SCHEDULE_IMPORT_MIME,
  SCHEDULE_TABULAR_MIME_TYPES,
  type ScheduleImportInput,
  type ScheduleSourceFormat,
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

function edtFileMetadata(originalName: string): {
  sourceFormat: ScheduleSourceFormat;
  mimeType: ScheduleImportInput["mimeType"];
} {
  const lower = originalName.toLowerCase();
  if (lower.endsWith(".ics")) return { sourceFormat: "ical_import", mimeType: "text/calendar" };
  if (lower.endsWith(".csv")) {
    return { sourceFormat: "tabular_import", mimeType: "text/csv" };
  }
  if (lower.endsWith(".xlsx")) {
    return {
      sourceFormat: "tabular_import",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };
  }
  return { sourceFormat: "pdf_import", mimeType: SCHEDULE_IMPORT_MIME };
}

function scheduleInput(input: {
  originalName: string;
  sizeBytes: number;
  fields?: Record<string, string>;
  json?: Record<string, unknown>;
}): ScheduleImportInput {
  const today = parisDateStringOf(new Date());
  const source = input.json ?? input.fields ?? {};
  const inferred = edtFileMetadata(input.originalName);
  try {
    return parseScheduleImportInput({
      sourceKind: source.sourceKind ?? source.source_kind ?? "classes",
      sourceFormat: source.sourceFormat ?? source.source_format ?? inferred.sourceFormat,
      schoolYear: source.schoolYear ?? source.annee_scolaire ?? schoolYearFor(today),
      title: source.title ?? source.titre ?? "Emploi du temps reçu du Dépôt Lycée",
      purposeDescription:
        "Emploi du temps officiel à contrôler et valider humainement avant sa publication.",
      effectiveFrom: source.effectiveFrom ?? source.valide_du ?? today,
      effectiveUntil: source.effectiveUntil ?? source.valide_au ?? null,
      freshUntil: source.freshUntil ?? source.fraiche_jusquau ?? plusDays(today, 7),
      originalName: input.originalName,
      mimeType: source.mimeType ?? source.mime_type ?? inferred.mimeType,
      sizeBytes: input.sizeBytes,
    });
  } catch {
    throw new HttpError(400, "Les métadonnées de l'emploi du temps sont invalides");
  }
}

export type DepotEdtReservation = {
  importId: string;
  status: "reserved";
  duplicate: boolean;
  upload: { bucket: string; path: string; token: string; signedUrl: string };
};

type DepotEdtDuplicate = { importId: string; status: string; duplicate: true };

const DEDUPLICATED_EDT_STATUSES = [
  "reserved", "uploaded", "quarantined", "processing",
  "mapping_pending", "review", "approved", "active", "superseded",
] as const;

async function findDepotEdtDuplicate(params: {
  institutionId: string;
  input: ScheduleImportInput;
  checksum: string;
}): Promise<DepotEdtDuplicate | DepotEdtReservation | null> {
  const [existing] = await db.select({
    id: scheduleSourceVersions.id,
    status: scheduleSourceVersions.status,
    storageBucket: scheduleSourceVersions.storageBucket,
    storagePath: scheduleSourceVersions.storagePath,
  }).from(scheduleSourceVersions).where(and(
    eq(scheduleSourceVersions.institutionId, params.institutionId),
    eq(scheduleSourceVersions.sourceKind, params.input.sourceKind),
    eq(scheduleSourceVersions.schoolYear, params.input.schoolYear),
    eq(scheduleSourceVersions.checksum, params.checksum),
    inArray(scheduleSourceVersions.status, [...DEDUPLICATED_EDT_STATUSES])
  )).limit(1);
  if (!existing) return null;
  if (existing.status !== "reserved") {
    return { importId: existing.id, status: existing.status, duplicate: true };
  }
  const { data: upload, error } = await supabaseAdmin.storage
    .from(existing.storageBucket)
    .createSignedUploadUrl(existing.storagePath, { upsert: true });
  if (error || !upload) throw new HttpError(503, "La reprise du transfert EDT est indisponible");
  return {
    importId: existing.id,
    status: "reserved",
    duplicate: true,
    upload: {
      bucket: existing.storageBucket,
      path: upload.path,
      token: upload.token,
      signedUrl: upload.signedUrl,
    },
  };
}

export async function reserveDepotEdt(params: {
  institutionId: string;
  actorId: string;
  input: ScheduleImportInput;
  checksum?: string;
}): Promise<DepotEdtReservation> {
  const storagePath = scheduleImportStoragePath(
    params.institutionId,
    params.actorId,
    params.input.schoolYear,
    params.input.sourceKind,
    scheduleImportFileExtension(params.input.sourceFormat, params.input.mimeType)
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
      checksum: params.checksum,
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
    duplicate: false,
    upload: {
      bucket: SCHEDULE_IMPORT_BUCKET,
      path: upload.path,
      token: upload.token,
      signedUrl: upload.signedUrl,
    },
  };
}

async function reserveDepotEdtIdempotently(params: {
  institutionId: string;
  actorId: string;
  input: ScheduleImportInput;
  checksum?: string;
}): Promise<DepotEdtReservation | DepotEdtDuplicate> {
  if (!params.checksum) return reserveDepotEdt(params);
  const existing = await findDepotEdtDuplicate({
    institutionId: params.institutionId,
    input: params.input,
    checksum: params.checksum,
  });
  if (existing) return existing;
  try {
    return await reserveDepotEdt(params);
  } catch (error) {
    const concurrentDuplicate = await findDepotEdtDuplicate({
      institutionId: params.institutionId,
      input: params.input,
      checksum: params.checksum,
    });
    if (concurrentDuplicate) return concurrentDuplicate;
    throw error;
  }
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
    || (mime && mime !== source.mimeType)
  ) throw new HttpError(409, "Le fichier EDT n'a pas été reçu complètement");

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
  const inferred = file ? edtFileMetadata(file.fileName) : null;
  const validFile = file && inferred && (
    (inferred.sourceFormat === "pdf_import"
      && /\.pdf$/i.test(file.fileName)
      && file.mimeType === SCHEDULE_IMPORT_MIME)
    || (inferred.sourceFormat === "tabular_import"
      && SCHEDULE_TABULAR_MIME_TYPES.includes(file.mimeType as (typeof SCHEDULE_TABULAR_MIME_TYPES)[number])
      && file.mimeType === inferred.mimeType)
  );
  if (!validFile || params.payload.files.rapport) {
    throw new HttpError(415, "L'emploi du temps doit être un unique fichier PDF, CSV ou Excel (.xlsx)");
  }
  const input = scheduleInput({
    originalName: file.fileName,
    sizeBytes: file.bytes.length,
    fields: params.payload.fields,
  });
  const checksum = createHash("sha256").update(file.bytes).digest("hex");
  const reservation = await reserveDepotEdtIdempotently({ ...params, input, checksum });
  if (!("upload" in reservation)) return reservation;
  const { error } = await supabaseAdmin.storage
    .from(reservation.upload.bucket)
    .uploadToSignedUrl(reservation.upload.path, reservation.upload.token, file.bytes, {
      contentType: input.mimeType,
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
  const allowed = [...expected, "sourceFormat", "mimeType", "checksum"];
  const keys = Object.keys(input);
  if (
    input.mode !== "reserve"
    || expected.some((key) => !keys.includes(key))
    || keys.some((key) => !allowed.includes(key))
  ) {
    throw new HttpError(400, "La réservation EDT est invalide");
  }
  if (typeof input.originalName !== "string") throw new HttpError(400, "La réservation EDT est invalide");
  const checksum = input.checksum === undefined
    ? undefined
    : typeof input.checksum === "string" && /^[a-f0-9]{64}$/i.test(input.checksum)
      ? input.checksum.toLowerCase()
      : (() => { throw new HttpError(400, "L'empreinte EDT est invalide"); })();
  const parsed = scheduleInput({
    originalName: input.originalName,
    sizeBytes: Number(input.sizeBytes),
    json: input,
  });
  return reserveDepotEdtIdempotently({ ...params, input: parsed, checksum });
}
