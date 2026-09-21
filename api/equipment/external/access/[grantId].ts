import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq, gt, isNull, lt, sql } from "drizzle-orm";
import { db } from "../../../../db/index.js";
import { equipmentExternalAccessGrants } from "../../../../db/schema.js";
import {
  equipmentExternalCodeMatches,
  equipmentExternalSecret,
} from "../../../../shared/equipment-external-access.mjs";
import { HttpError } from "../../../_shared/auth.js";
import { setEquipmentExternalSession } from "../../../_shared/equipment-external-session.js";
import { requireConfiguredInstitution } from "../../../_shared/institution-context.js";
import { handleApi, methodNotAllowed } from "../../../_shared/response.js";
import { enforceMagicTokenNetworkGuard } from "../../../_shared/support-rate-limits.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function routeId(value: string | string[] | undefined): string {
  const id = Array.isArray(value) ? value[0] : value;
  if (!id || !UUID.test(id)) throw new HttpError(400, "Lien d’accès invalide");
  return id.toLowerCase();
}

function codeInput(value: unknown): string {
  const code = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>).code : null;
  if (typeof code !== "string" || !/^\d{8}$/.test(code)) throw new HttpError(400, "Le code doit contenir 8 chiffres");
  return code;
}

function secret(): string {
  try { return equipmentExternalSecret(process.env.SUPPORT_ACCESS_CODE_SECRET); }
  catch { throw new HttpError(503, "L’accès intervenant est momentanément indisponible"); }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  return handleApi(res, async () => {
    await enforceMagicTokenNetworkGuard(req);
    const id = routeId(req.query.grantId);
    const code = codeInput(req.body);
    const institution = await requireConfiguredInstitution();
    const now = new Date();
    const [grant] = await db.select().from(equipmentExternalAccessGrants).where(and(
      eq(equipmentExternalAccessGrants.id, id),
      eq(equipmentExternalAccessGrants.institutionId, institution.id),
      gt(equipmentExternalAccessGrants.expiresAt, now),
      isNull(equipmentExternalAccessGrants.revokedAt),
      isNull(equipmentExternalAccessGrants.lockedAt),
      lt(equipmentExternalAccessGrants.attemptCount, 5)
    )).limit(1);
    const matches = grant ? equipmentExternalCodeMatches({ grantId: id, code, codeHash: grant.codeHash, secret: secret() }) : false;
    if (!grant || !matches) {
      if (grant) {
        await db.update(equipmentExternalAccessGrants).set({
          attemptCount: sql`least(${equipmentExternalAccessGrants.attemptCount} + 1, 5)`,
          lockedAt: sql`case when ${equipmentExternalAccessGrants.attemptCount} + 1 >= 5 then now() else ${equipmentExternalAccessGrants.lockedAt} end`,
          updatedAt: now,
        }).where(and(
          eq(equipmentExternalAccessGrants.id, id),
          isNull(equipmentExternalAccessGrants.lockedAt),
          lt(equipmentExternalAccessGrants.attemptCount, 5)
        ));
      }
      throw new HttpError(401, "Code incorrect ou accès expiré");
    }
    await db.update(equipmentExternalAccessGrants).set({ attemptCount: 0, lastUsedAt: now, updatedAt: now }).where(eq(equipmentExternalAccessGrants.id, id));
    setEquipmentExternalSession(res, { grantId: id, grantExpiresAt: grant.expiresAt });
    return { ok: true, label: grant.label, expiresAt: grant.expiresAt };
  });
}

export const config = { api: { bodyParser: { sizeLimit: "4kb" } } };
