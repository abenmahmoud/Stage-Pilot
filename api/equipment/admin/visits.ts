import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, asc, eq, gte } from "drizzle-orm";
import { db } from "../../../db/index.js";
import {
  equipmentServiceVisitEvents,
  equipmentServiceVisits,
} from "../../../db/schema.js";
import {
  isEquipmentVisitStatus,
  type EquipmentVisitStatus,
} from "../../../shared/equipment-support.js";
import { HttpError } from "../../_shared/auth.js";
import { requireEquipmentCoordinator } from "../../_shared/equipment-access.js";
import { handleApi, methodNotAllowed } from "../../_shared/response.js";

function bodyRecord(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new HttpError(400, "Le formulaire est invalide");
  }
  return body as Record<string, unknown>;
}

function text(value: unknown, label: string, maximum: number, required = false): string | null {
  if (value === undefined || value === null || value === "") {
    if (required) throw new HttpError(400, `${label} est requis`);
    return null;
  }
  if (typeof value !== "string") throw new HttpError(400, `${label} est invalide`);
  const clean = value.replace(/[\u0000-\u001F]/g, "").trim();
  if ((!clean && required) || clean.length > maximum) throw new HttpError(400, `${label} est invalide`);
  return clean || null;
}

function dateValue(value: unknown, label: string): Date {
  if (typeof value !== "string") throw new HttpError(400, `${label} est invalide`);
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new HttpError(400, `${label} est invalide`);
  return date;
}

function interval(startsAt: Date, endsAt: Date): void {
  const duration = endsAt.getTime() - startsAt.getTime();
  if (duration <= 0 || duration > 12 * 60 * 60 * 1000) {
    throw new HttpError(400, "La fin doit suivre le début, dans une plage de 12 heures maximum");
  }
}

function visitStatus(value: unknown, fallback?: EquipmentVisitStatus): EquipmentVisitStatus {
  if (value === undefined && fallback) return fallback;
  if (!isEquipmentVisitStatus(value)) throw new HttpError(400, "État du passage invalide");
  return value;
}

const visitProjection = {
  id: equipmentServiceVisits.id,
  provider: equipmentServiceVisits.provider,
  startsAt: equipmentServiceVisits.startsAt,
  endsAt: equipmentServiceVisits.endsAt,
  status: equipmentServiceVisits.status,
  location: equipmentServiceVisits.location,
  publicNote: equipmentServiceVisits.publicNote,
  internalNote: equipmentServiceVisits.internalNote,
  createdAt: equipmentServiceVisits.createdAt,
  updatedAt: equipmentServiceVisits.updatedAt,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "GET") {
    return handleApi(res, async () => {
      const context = await requireEquipmentCoordinator(req);
      const visits = await db
        .select(visitProjection)
        .from(equipmentServiceVisits)
        .where(and(
          eq(equipmentServiceVisits.institutionId, context.institutionId),
          gte(equipmentServiceVisits.endsAt, new Date(Date.now() - 90 * 24 * 60 * 60 * 1000))
        ))
        .orderBy(asc(equipmentServiceVisits.startsAt))
        .limit(100);
      return { visits };
    });
  }

  if (req.method === "POST") {
    return handleApi(res, async () => {
      const context = await requireEquipmentCoordinator(req);
      const input = bodyRecord(req.body);
      const startsAt = dateValue(input.startsAt, "Date de début");
      const endsAt = dateValue(input.endsAt, "Date de fin");
      interval(startsAt, endsAt);
      const values = {
        institutionId: context.institutionId,
        provider: text(input.provider, "Prestataire", 80) ?? "SPIE",
        startsAt,
        endsAt,
        status: visitStatus(input.status, "draft"),
        location: text(input.location, "Lieu", 120),
        publicNote: text(input.publicNote, "Note publique", 300),
        internalNote: text(input.internalNote, "Note interne", 1000),
        createdBy: context.user.id,
        updatedBy: context.user.id,
      };
      const visit = await db.transaction(async tx => {
        const [created] = await tx.insert(equipmentServiceVisits).values(values).returning(visitProjection);
        await tx.insert(equipmentServiceVisitEvents).values({
          institutionId: context.institutionId,
          visitId: created.id,
          eventType: "visit.created",
          actorId: context.user.id,
          nextValue: { status: created.status, startsAt: created.startsAt, endsAt: created.endsAt },
        });
        return created;
      });
      res.status(201);
      return { visit };
    });
  }

  if (req.method === "PATCH") {
    return handleApi(res, async () => {
      const context = await requireEquipmentCoordinator(req);
      const input = bodyRecord(req.body);
      const id = text(input.id, "Passage", 36, true)!;
      if (!/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(400, "Passage invalide");
      const expectedUpdatedAt = dateValue(input.expectedUpdatedAt, "Version du passage");
      const [current] = await db.select(visitProjection).from(equipmentServiceVisits).where(and(
        eq(equipmentServiceVisits.id, id),
        eq(equipmentServiceVisits.institutionId, context.institutionId)
      )).limit(1);
      if (!current) throw new HttpError(404, "Passage introuvable");
      const startsAt = input.startsAt === undefined ? current.startsAt : dateValue(input.startsAt, "Date de début");
      const endsAt = input.endsAt === undefined ? current.endsAt : dateValue(input.endsAt, "Date de fin");
      interval(startsAt, endsAt);
      const next = {
        provider: input.provider === undefined ? current.provider : text(input.provider, "Prestataire", 80, true)!,
        startsAt,
        endsAt,
        status: visitStatus(input.status, current.status as EquipmentVisitStatus),
        location: input.location === undefined ? current.location : text(input.location, "Lieu", 120),
        publicNote: input.publicNote === undefined ? current.publicNote : text(input.publicNote, "Note publique", 300),
        internalNote: input.internalNote === undefined ? current.internalNote : text(input.internalNote, "Note interne", 1000),
        updatedBy: context.user.id,
        updatedAt: new Date(),
      };
      const visit = await db.transaction(async tx => {
        const [updated] = await tx.update(equipmentServiceVisits).set(next).where(and(
          eq(equipmentServiceVisits.id, id),
          eq(equipmentServiceVisits.institutionId, context.institutionId),
          eq(equipmentServiceVisits.updatedAt, expectedUpdatedAt)
        )).returning(visitProjection);
        if (!updated) throw new HttpError(409, "Ce passage a été modifié ailleurs. Actualisez avant de recommencer.");
        await tx.insert(equipmentServiceVisitEvents).values({
          institutionId: context.institutionId,
          visitId: id,
          eventType: "visit.updated",
          actorId: context.user.id,
          previousValue: { status: current.status, startsAt: current.startsAt, endsAt: current.endsAt },
          nextValue: { status: updated.status, startsAt: updated.startsAt, endsAt: updated.endsAt },
        });
        return updated;
      });
      return { visit };
    });
  }

  return methodNotAllowed(res, ["GET", "POST", "PATCH"]);
}

export const config = { api: { bodyParser: { sizeLimit: "16kb" } } };
