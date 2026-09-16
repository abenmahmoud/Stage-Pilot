import { createHash } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, asc, eq, ne } from "drizzle-orm";
import { db } from "../../db/index.js";
import { regionalDeviceHandoffEvents, regionalDeviceHandoffs } from "../../db/schema.js";
import { HttpError, requireAal2 } from "../_shared/auth.js";
import { handleApi, methodNotAllowed } from "../_shared/response.js";
import { requireSupportAgent } from "../_shared/support-agent-access.js";

const SCHOOL_YEAR = "2026-2027";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function cleanText(value: unknown, label: string, max: number): string {
  if (typeof value !== "string") throw new HttpError(400, `${label} manquant.`);
  const text = value.trim().replace(/\s+/g, " ");
  if (!text || text.length > max || /[\p{Cc}\p{Cf}]/u.test(text)) {
    throw new HttpError(400, `${label} invalide.`);
  }
  return text;
}

function studentKey(name: string, className: string): string {
  const normalize = (value: string) => value.normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr-FR")
    .replace(/[^\p{L}\p{N}]/gu, "");
  return createHash("sha256").update(`${normalize(name)}|${normalize(className)}`).digest("hex");
}

async function requireManager(req: VercelRequest) {
  const context = await requireSupportAgent(req);
  if (context.user.role !== "superadmin") throw new HttpError(403, "Accès réservé au superadministrateur.");
  await requireAal2(req);
  return context;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "GET") return handleApi(res, async () => {
    const { institutionId } = await requireManager(req);
    const items = await db.select({
      id: regionalDeviceHandoffs.id,
      studentName: regionalDeviceHandoffs.studentName,
      className: regionalDeviceHandoffs.className,
      status: regionalDeviceHandoffs.status,
      createdAt: regionalDeviceHandoffs.createdAt,
      deliveredAt: regionalDeviceHandoffs.deliveredAt,
      deliveredBy: regionalDeviceHandoffs.deliveredBy,
    }).from(regionalDeviceHandoffs).where(and(
      eq(regionalDeviceHandoffs.institutionId, institutionId),
      eq(regionalDeviceHandoffs.schoolYear, SCHOOL_YEAR),
      ne(regionalDeviceHandoffs.status, "removed"),
    )).orderBy(asc(regionalDeviceHandoffs.studentName)).limit(5000);
    return { schoolYear: SCHOOL_YEAR, items };
  });

  if (req.method === "POST") return handleApi(res, async () => {
    const { institutionId, user } = await requireManager(req);
    const raw = req.body?.items;
    if (!Array.isArray(raw) || raw.length < 1 || raw.length > 100) {
      throw new HttpError(400, "Ajoutez entre 1 et 100 élèves par lot.");
    }
    const items = raw.map((entry: unknown) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        throw new HttpError(400, "Ligne d’élève invalide.");
      }
      const data = entry as Record<string, unknown>;
      const studentName = cleanText(data.studentName, "Nom de l’élève", 160);
      const className = cleanText(data.className, "Classe", 60);
      if (studentName.length < 2) throw new HttpError(400, "Nom de l’élève trop court.");
      return { studentName, className, studentKey: studentKey(studentName, className) };
    });
    let added = 0;
    await db.transaction(async (tx) => {
      for (const item of items) {
        const [created] = await tx.insert(regionalDeviceHandoffs).values({
          institutionId, schoolYear: SCHOOL_YEAR, ...item, addedBy: user.id,
        }).onConflictDoNothing().returning({ id: regionalDeviceHandoffs.id });
        if (created) {
          await tx.insert(regionalDeviceHandoffEvents).values({
            institutionId, handoffId: created.id, action: "created", actorId: user.id,
          });
          added++;
        }
      }
    });
    return { added, duplicates: items.length - added };
  });

  if (req.method === "PATCH") return handleApi(res, async () => {
    const { institutionId, user } = await requireManager(req);
    const id = req.body?.id;
    const action = req.body?.action;
    if (typeof id !== "string" || !UUID.test(id) || !["deliver", "reopen", "remove"].includes(action)) {
      throw new HttpError(400, "Action ou élève invalide.");
    }
    const previousStatus = action === "reopen" ? "delivered" : "pending";
    const nextStatus = action === "deliver" ? "delivered" : action === "reopen" ? "pending" : "removed";
    const now = new Date();
    const [updated] = await db.transaction(async (tx) => {
      const changed = await tx.update(regionalDeviceHandoffs).set({
        status: nextStatus,
        deliveredAt: action === "deliver" ? now : null,
        deliveredBy: action === "deliver" ? user.id : null,
        updatedAt: now,
      }).where(and(
        eq(regionalDeviceHandoffs.id, id),
        eq(regionalDeviceHandoffs.institutionId, institutionId),
        eq(regionalDeviceHandoffs.schoolYear, SCHOOL_YEAR),
        eq(regionalDeviceHandoffs.status, previousStatus),
      )).returning({ id: regionalDeviceHandoffs.id });
      if (changed) await tx.insert(regionalDeviceHandoffEvents).values({
        institutionId, handoffId: id,
        action: action === "deliver" ? "delivered" : action === "reopen" ? "reopened" : "removed",
        actorId: user.id,
      });
      return changed;
    });
    if (!updated) throw new HttpError(409, "La ligne a changé ou n’est plus disponible. Actualisez la liste.");
    return { ok: true };
  });

  return methodNotAllowed(res, ["GET", "POST", "PATCH"]);
}

export const config = { api: { bodyParser: { sizeLimit: "32kb" } } };
