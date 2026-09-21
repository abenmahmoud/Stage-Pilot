import { randomUUID } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, asc, eq, gt, isNull } from "drizzle-orm";
import { db } from "../../../db/index.js";
import {
  equipmentExternalAccessGrants,
  equipmentServiceVisitEvents,
  equipmentServiceVisits,
} from "../../../db/schema.js";
import {
  equipmentExternalCodeHash,
  equipmentExternalSecret,
  generateEquipmentExternalCode,
} from "../../../shared/equipment-external-access.mjs";
import { HttpError } from "../../_shared/auth.js";
import { requireEquipmentCoordinator } from "../../_shared/equipment-access.js";
import { handleApi, methodNotAllowed } from "../../_shared/response.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const projection = {
  id: equipmentExternalAccessGrants.id,
  visitId: equipmentExternalAccessGrants.visitId,
  label: equipmentExternalAccessGrants.label,
  expiresAt: equipmentExternalAccessGrants.expiresAt,
  lockedAt: equipmentExternalAccessGrants.lockedAt,
  revokedAt: equipmentExternalAccessGrants.revokedAt,
  lastUsedAt: equipmentExternalAccessGrants.lastUsedAt,
  createdAt: equipmentExternalAccessGrants.createdAt,
};

function bodyRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new HttpError(400, "Le formulaire est invalide");
  return value as Record<string, unknown>;
}

function uuid(value: unknown, label: string): string {
  if (typeof value !== "string" || !UUID.test(value)) throw new HttpError(400, `${label} invalide`);
  return value.toLowerCase();
}

function secret(): string {
  try { return equipmentExternalSecret(process.env.SUPPORT_ACCESS_CODE_SECRET); }
  catch { throw new HttpError(503, "La création d’accès SPIE est momentanément indisponible"); }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "GET") {
    return handleApi(res, async () => {
      const context = await requireEquipmentCoordinator(req);
      const grants = await db.select(projection).from(equipmentExternalAccessGrants).where(
        eq(equipmentExternalAccessGrants.institutionId, context.institutionId)
      ).orderBy(asc(equipmentExternalAccessGrants.expiresAt)).limit(100);
      return { grants };
    });
  }

  if (req.method === "POST") {
    return handleApi(res, async () => {
      const context = await requireEquipmentCoordinator(req);
      const input = bodyRecord(req.body);
      const selectedVisitId = uuid(input.visitId, "Passage");
      const label = typeof input.label === "string" ? input.label.replace(/[\u0000-\u001F]/g, "").trim() : "Intervenant SPIE";
      if (label.length < 2 || label.length > 120) throw new HttpError(400, "Nom de l’intervenant invalide");
      if (typeof input.expiresAt !== "string") throw new HttpError(400, "Expiration invalide");
      const expiresAt = new Date(input.expiresAt);
      if (!Number.isFinite(expiresAt.getTime()) || expiresAt <= new Date() || expiresAt.getTime() > Date.now() + 120 * 86400_000) {
        throw new HttpError(400, "Choisissez une expiration comprise entre maintenant et 120 jours");
      }
      const [visit] = await db.select({ id: equipmentServiceVisits.id }).from(equipmentServiceVisits).where(and(
        eq(equipmentServiceVisits.id, selectedVisitId),
        eq(equipmentServiceVisits.institutionId, context.institutionId)
      )).limit(1);
      if (!visit) throw new HttpError(404, "Passage introuvable");

      const id = randomUUID();
      const code = generateEquipmentExternalCode();
      const now = new Date();
      const grant = await db.transaction(async tx => {
        await tx.update(equipmentExternalAccessGrants).set({ revokedAt: now, updatedAt: now }).where(and(
          eq(equipmentExternalAccessGrants.institutionId, context.institutionId),
          eq(equipmentExternalAccessGrants.visitId, selectedVisitId),
          isNull(equipmentExternalAccessGrants.revokedAt),
          gt(equipmentExternalAccessGrants.expiresAt, now)
        ));
        const [created] = await tx.insert(equipmentExternalAccessGrants).values({
          id,
          institutionId: context.institutionId,
          visitId: selectedVisitId,
          label,
          codeHash: equipmentExternalCodeHash({ grantId: id, code, secret: secret() }),
          expiresAt,
          createdBy: context.user.id,
        }).returning(projection);
        await tx.insert(equipmentServiceVisitEvents).values({
          institutionId: context.institutionId,
          visitId: selectedVisitId,
          eventType: "visit.external_access_created",
          actorId: context.user.id,
          nextValue: { grantId: id, label, expiresAt },
        });
        return created;
      });
      res.status(201);
      return { grant, code, linkPath: `/intervention-spie/${grant.id}` };
    });
  }

  if (req.method === "PATCH") {
    return handleApi(res, async () => {
      const context = await requireEquipmentCoordinator(req);
      const input = bodyRecord(req.body);
      const id = uuid(input.id, "Accès");
      const now = new Date();
      const [grant] = await db.update(equipmentExternalAccessGrants).set({ revokedAt: now, updatedAt: now }).where(and(
        eq(equipmentExternalAccessGrants.id, id),
        eq(equipmentExternalAccessGrants.institutionId, context.institutionId),
        isNull(equipmentExternalAccessGrants.revokedAt)
      )).returning(projection);
      if (!grant) throw new HttpError(404, "Accès introuvable ou déjà désactivé");
      await db.insert(equipmentServiceVisitEvents).values({
        institutionId: context.institutionId,
        visitId: grant.visitId,
        eventType: "visit.external_access_revoked",
        actorId: context.user.id,
        nextValue: { grantId: id },
      });
      return { grant };
    });
  }

  return methodNotAllowed(res, ["GET", "POST", "PATCH"]);
}

export const config = { api: { bodyParser: { sizeLimit: "8kb" } } };
