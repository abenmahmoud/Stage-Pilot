import { randomUUID } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq } from "drizzle-orm";
import { db } from "../../../../db/index.js";
import {
  equipmentExternalUpdates,
  equipmentServiceVisitRequests,
  supportEvents,
  supportMessages,
  supportRequests,
} from "../../../../db/schema.js";
import { HttpError } from "../../../_shared/auth.js";
import { requireEquipmentExternalGrant } from "../../../_shared/equipment-external-session.js";
import { handleApi, methodNotAllowed } from "../../../_shared/response.js";
import { idempotencyKey, sha256 } from "../../../_shared/support.js";
import { enforceAgentWriteRateLimit } from "../../../_shared/support-rate-limits.js";

const PUBLIC_CODE = /^BC-\d{4}-\d{6}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OUTCOMES = new Set(["diagnosed", "repaired", "needs_followup", "not_found", "unavailable"]);
const LABELS: Record<string, string> = {
  diagnosed: "Diagnostic réalisé",
  repaired: "Matériel réparé",
  needs_followup: "Intervention complémentaire nécessaire",
  not_found: "Matériel non trouvé",
  unavailable: "Intervention impossible",
};

function routeCode(value: string | string[] | undefined): string {
  const code = Array.isArray(value) ? value[0] : value;
  if (!code || !PUBLIC_CODE.test(code)) throw new HttpError(400, "Numéro de dossier invalide");
  return code;
}

function input(value: unknown): { grantId: string; outcome: string; note: string | null } {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new HttpError(400, "Le compte rendu est invalide");
  const body = value as Record<string, unknown>;
  if (typeof body.grantId !== "string" || !UUID.test(body.grantId)) throw new HttpError(400, "Accès invalide");
  if (typeof body.outcome !== "string" || !OUTCOMES.has(body.outcome)) throw new HttpError(400, "Résultat invalide");
  const note = typeof body.note === "string" ? body.note.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim() : "";
  if (note.length > 2000) throw new HttpError(400, "Le commentaire est trop long");
  return { grantId: body.grantId.toLowerCase(), outcome: body.outcome, note: note || null };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  return handleApi(res, async () => {
    const publicCode = routeCode(req.query.code);
    const parsed = input(req.body);
    const { grant } = await requireEquipmentExternalGrant(req, parsed.grantId);
    await enforceAgentWriteRateLimit(grant.id);
    const keyHash = sha256(idempotencyKey(req));
    const [assigned] = await db.select({ id: supportRequests.id }).from(equipmentServiceVisitRequests)
      .innerJoin(supportRequests, eq(supportRequests.id, equipmentServiceVisitRequests.requestId))
      .where(and(
        eq(equipmentServiceVisitRequests.institutionId, grant.institutionId),
        eq(equipmentServiceVisitRequests.visitId, grant.visitId),
        eq(supportRequests.publicCode, publicCode),
        eq(supportRequests.category, "ordinateur")
      )).limit(1);
    if (!assigned) throw new HttpError(404, "Ce dossier n’est pas affecté à ce passage");

    const result = await db.transaction(async tx => {
      const [created] = await tx.insert(equipmentExternalUpdates).values({
        institutionId: grant.institutionId,
        grantId: grant.id,
        visitId: grant.visitId,
        requestId: assigned.id,
        clientIdempotencyKeyHash: keyHash,
        outcome: parsed.outcome,
        note: parsed.note,
      }).onConflictDoNothing({
        target: [equipmentExternalUpdates.grantId, equipmentExternalUpdates.clientIdempotencyKeyHash],
      }).returning({ id: equipmentExternalUpdates.id, createdAt: equipmentExternalUpdates.createdAt });
      if (!created) {
        const [existing] = await tx.select({
          id: equipmentExternalUpdates.id,
          requestId: equipmentExternalUpdates.requestId,
          outcome: equipmentExternalUpdates.outcome,
          note: equipmentExternalUpdates.note,
          createdAt: equipmentExternalUpdates.createdAt,
        }).from(equipmentExternalUpdates).where(and(
          eq(equipmentExternalUpdates.grantId, grant.id),
          eq(equipmentExternalUpdates.clientIdempotencyKeyHash, keyHash)
        )).limit(1);
        if (!existing || existing.requestId !== assigned.id || existing.outcome !== parsed.outcome || existing.note !== parsed.note) {
          throw new HttpError(409, "Cette confirmation a déjà été utilisée pour un autre compte rendu");
        }
        return { ...existing, duplicate: true };
      }
      const messageHash = sha256(`spie:${grant.id}:${created.id}:${keyHash}`);
      const [message] = await tx.insert(supportMessages).values({
        requestId: assigned.id,
        direction: "internal",
        channel: "system",
        authorLabel: `SPIE · ${grant.label}`,
        bodyText: `Compte rendu SPIE — ${LABELS[parsed.outcome]}${parsed.note ? `\n${parsed.note}` : ""}`,
        clientIdempotencyKeyHash: messageHash,
        deliveryStatus: "stored",
      }).returning({ id: supportMessages.id });
      await tx.insert(supportEvents).values({
        requestId: assigned.id,
        eventType: "equipment.external_update",
        actorType: "external_provider",
        actorId: grant.id,
        toValue: { updateId: created.id, messageId: message?.id, outcome: parsed.outcome, visitId: grant.visitId },
        correlationId: randomUUID(),
      });
      return { ...created, duplicate: false };
    });
    res.status(result.duplicate ? 200 : 201);
    return { update: result };
  });
}

export const config = { api: { bodyParser: { sizeLimit: "8kb" } } };
