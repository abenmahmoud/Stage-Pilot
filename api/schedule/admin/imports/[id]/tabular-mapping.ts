// LOT 3 du plan `docs/operations/PLAN_IMPORT_UTILISABLE_2026-09-07.md`.
//
// GET  : présente les en-têtes réels du fichier déposé (jamais devinés) et,
//        s'il en existe une, la dernière correspondance enregistrée pour ce
//        périmètre (classes ou professeurs) afin de préremplir le
//        formulaire.
// POST : valide la correspondance choisie par l'administrateur, relit le
//        fichier depuis le stockage privé pour l'appliquer (jamais de
//        confiance dans un calcul fait côté navigateur), crée une page
//        `schedule_page_indexes` par classe/professeur distinct trouvé,
//        fait passer la version en `review` avec le bon `page_count`, et
//        renvoie les créneaux calculés pour chaque page. L'écriture réelle
//        dans `schedule_slots` reste entièrement déléguée à la vérification
//        de page puis à la route existante
//        `pages/[pageId]/slots.ts` (`api/_shared/schedule-slot-write.ts`) :
//        cette route ne fait qu'amener les données tabulaires jusqu'à la
//        même porte que la saisie manuelle du PDF, elle n'écrit jamais elle
//        même dans `schedule_slots`.
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../../../../../db/index.js";
import {
  scheduleAudit,
  schedulePageIndexes,
  scheduleSourceVersions,
  scheduleTabularColumnMappings,
} from "../../../../../db/schema.js";
import {
  applyScheduleTabularColumnMapping,
  parseScheduleTabularColumnMapping,
} from "../../../../../shared/schedule-tabular-mapping.js";
import { HttpError, supabaseAdmin } from "../../../../_shared/auth.js";
import { handleApi, methodNotAllowed } from "../../../../_shared/response.js";
import { requireScheduleManager } from "../../../../_shared/schedule-imports.js";
import { boundedBlobToBuffer } from "../../../../../workers/bounded-download.mjs";
import {
  parseScheduleTabularBytes,
  SCHEDULE_TABULAR_MAX_BYTES,
  ScheduleTabularParseError,
} from "../../../../../workers/schedule-tabular-parser.mjs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function routeId(req: VercelRequest): string {
  const value = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (!value || !UUID.test(value)) throw new HttpError(400, "Version invalide.");
  return value;
}

function tabularHeaders(validationSummary: unknown): string[] {
  const summary = validationSummary as Record<string, unknown>;
  const headers = summary?.tabularHeaders;
  if (!Array.isArray(headers) || !headers.every((header) => typeof header === "string")) {
    throw new HttpError(409, "Les en-têtes de ce fichier ne sont pas disponibles.");
  }
  return headers;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "GET") {
    return handleApi(res, async () => {
      const context = await requireScheduleManager(req);
      const id = routeId(req);
      const [source] = await db
        .select({
          sourceKind: scheduleSourceVersions.sourceKind,
          status: scheduleSourceVersions.status,
          validationSummary: scheduleSourceVersions.validationSummary,
        })
        .from(scheduleSourceVersions)
        .where(
          and(
            eq(scheduleSourceVersions.id, id),
            eq(scheduleSourceVersions.institutionId, context.institutionId)
          )
        )
        .limit(1);
      if (!source) throw new HttpError(404, "Version introuvable.");
      if (source.status !== "mapping_pending") {
        throw new HttpError(409, "Cette version n'attend pas de correspondance de colonnes.");
      }
      const headers = tabularHeaders(source.validationSummary);
      const [saved] = await db
        .select({ mapping: scheduleTabularColumnMappings.mapping })
        .from(scheduleTabularColumnMappings)
        .where(
          and(
            eq(scheduleTabularColumnMappings.institutionId, context.institutionId),
            eq(scheduleTabularColumnMappings.sourceKind, source.sourceKind)
          )
        )
        .limit(1);
      const summary = source.validationSummary as Record<string, unknown>;
      return {
        headers,
        rowCount: typeof summary.tabularRowCount === "number" ? summary.tabularRowCount : 0,
        savedMapping: parseScheduleTabularColumnMapping(saved?.mapping, headers),
      };
    });
  }

  if (req.method === "POST") {
    return handleApi(res, async () => {
      const context = await requireScheduleManager(req);
      const id = routeId(req);
      const body = req.body as Record<string, unknown> | null;

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
      if (source.status !== "mapping_pending") {
        throw new HttpError(409, "Cette version n'attend pas de correspondance de colonnes.");
      }
      const declaredHeaders = tabularHeaders(source.validationSummary);
      const mapping = parseScheduleTabularColumnMapping(body?.mapping, declaredHeaders);
      if (!mapping) throw new HttpError(400, "La correspondance de colonnes est invalide.");

      const { data: downloaded, error: downloadError } = await supabaseAdmin.storage
        .from(source.storageBucket)
        .download(source.storagePath);
      if (downloadError || !downloaded) {
        throw new HttpError(409, "Le fichier n'est plus disponible dans l'espace privé.");
      }
      const bytes = await boundedBlobToBuffer(downloaded, Number(source.sizeBytes), SCHEDULE_TABULAR_MAX_BYTES);

      let parsed;
      try {
        parsed = parseScheduleTabularBytes({ bytes, fileName: source.originalName });
      } catch (error) {
        if (error instanceof ScheduleTabularParseError) {
          throw new HttpError(409, "Le fichier n'a pas pu être relu à l'identique.");
        }
        throw error;
      }
      if (
        parsed.headers.length !== declaredHeaders.length ||
        parsed.headers.some((header, index) => header !== declaredHeaders[index])
      ) {
        throw new HttpError(409, "Le fichier a changé depuis sa lecture technique initiale.");
      }

      const applied = applyScheduleTabularColumnMapping({
        mapping,
        headers: parsed.headers,
        rows: parsed.rows,
      });
      if (!applied.ok) {
        const messages: Record<string, string> = {
          too_many_rows: "Le fichier contient trop de lignes.",
          too_many_groups: "Le fichier contient trop de classes ou professeurs distincts.",
          group_too_large: `Trop de créneaux pour "${applied.detail}" en un seul envoi (80 maximum).`,
          no_valid_rows: "Aucune ligne exploitable n'a été trouvée avec cette correspondance.",
        };
        throw new HttpError(400, messages[applied.reason] ?? "La correspondance n'a produit aucune donnée exploitable.");
      }

      const subjectType = source.sourceKind === "classes" ? "class" : "teacher";
      const pages = await db.transaction(async (tx) => {
        await tx.execute(sql`
          select pg_advisory_xact_lock(hashtextextended(${id}::text, 61744))
        `);
        const [current] = await tx
          .select({ status: scheduleSourceVersions.status })
          .from(scheduleSourceVersions)
          .where(
            and(
              eq(scheduleSourceVersions.id, id),
              eq(scheduleSourceVersions.institutionId, context.institutionId)
            )
          )
          .limit(1);
        if (!current || current.status !== "mapping_pending") {
          throw new HttpError(409, "Cette version a déjà changé.");
        }

        await tx
          .insert(scheduleTabularColumnMappings)
          .values({
            institutionId: context.institutionId,
            sourceKind: source.sourceKind,
            mapping,
            updatedBy: context.user.id,
          })
          .onConflictDoUpdate({
            target: [scheduleTabularColumnMappings.institutionId, scheduleTabularColumnMappings.sourceKind],
            set: { mapping, updatedBy: context.user.id, updatedAt: new Date() },
          });

        // `schedule_page_indexes` porte un déclencheur qui n'accepte des
        // lignes que pour une version source déjà `review`, avec un
        // `page_number` borné par son `page_count` (voir
        // `schedule_validate_page_review_bounds` dans
        // `20260829113248_enforce_schedule_page_review_bounds.sql`) : il
        // faut donc faire passer la version en `review` avec le bon
        // `page_count` AVANT de créer la moindre page, jamais après —
        // l'ordre inverse est rejeté par la base, pas seulement une
        // convention applicative.
        await tx
          .update(scheduleSourceVersions)
          .set({
            status: "review",
            pageCount: applied.groups.length,
            validationSummary: {
              ...(source.validationSummary as Record<string, unknown>),
              humanMapping: "applied",
              pageCountVerified: true,
              pageCountMethod: "tabular_mapping",
              activation: "blocked",
              realDataAllowedInModel: false,
            },
          })
          .where(eq(scheduleSourceVersions.id, id));

        await tx.insert(scheduleAudit).values({
          institutionId: context.institutionId,
          sourceVersionId: id,
          action: "apply_tabular_mapping",
          actorId: context.user.id,
          summary: {
            groupCount: applied.groups.length,
            totalRowCount: applied.totalRowCount,
            rejectedRowCount: applied.rejectedRowCount,
          },
        });

        const created: { pageNumber: number; subjectRef: string; rows: (typeof applied.groups)[number]["rows"] }[] = [];
        for (const [index, group] of applied.groups.entries()) {
          const pageNumber = index + 1;
          const [page] = await tx
            .insert(schedulePageIndexes)
            .values({
              institutionId: context.institutionId,
              sourceVersionId: id,
              pageNumber,
              subjectType,
              subjectRef: group.subjectRef,
              reviewStatus: "draft",
            })
            .returning({ id: schedulePageIndexes.id });
          await tx.insert(scheduleAudit).values({
            institutionId: context.institutionId,
            sourceVersionId: id,
            pageIndexId: page.id,
            action: "index_page",
            actorId: context.user.id,
            summary: { pageNumber, subjectType, subjectRef: group.subjectRef, source: "tabular_mapping" },
          });
          created.push({ pageNumber, subjectRef: group.subjectRef, rows: group.rows });
        }

        return created;
      });

      return {
        pages: pages.map((page) => ({
          pageNumber: page.pageNumber,
          subjectType,
          subjectRef: page.subjectRef,
          rows: page.rows,
        })),
      };
    });
  }

  return methodNotAllowed(res, ["GET", "POST"]);
}

export const config = { api: { bodyParser: { sizeLimit: "64kb" } } };
