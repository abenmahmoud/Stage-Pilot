import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "../../db/index.js";
import { equipmentExternalAccessGrants } from "../../db/schema.js";
import { HttpError } from "./auth.js";
import { requireConfiguredInstitution } from "./institution-context.js";
import {
  createEquipmentExternalSession,
  equipmentExternalSecret,
  verifyEquipmentExternalSession,
} from "../../shared/equipment-external-access.mjs";

const COOKIE_NAME = "lycee_spie_access";

function secret(): string {
  try {
    return equipmentExternalSecret(process.env.SUPPORT_ACCESS_CODE_SECRET);
  } catch {
    throw new HttpError(503, "L’accès intervenant est momentanément indisponible.");
  }
}

function cookieValue(req: VercelRequest): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const item of header.split(";")) {
    const [name, ...parts] = item.trim().split("=");
    if (name === COOKIE_NAME) return decodeURIComponent(parts.join("="));
  }
  return null;
}

export function setEquipmentExternalSession(
  res: VercelResponse,
  input: { grantId: string; grantExpiresAt: Date }
): void {
  const expiresAt = new Date(Math.min(input.grantExpiresAt.getTime(), Date.now() + 8 * 60 * 60 * 1000));
  const token = createEquipmentExternalSession({
    grantId: input.grantId,
    expiresAt,
    secret: secret(),
  });
  const maxAge = Math.max(60, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`);
}

export function clearEquipmentExternalSession(res: VercelResponse): void {
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`);
}

export async function requireEquipmentExternalGrant(req: VercelRequest, expectedGrantId?: string) {
  const token = cookieValue(req);
  const session = token ? verifyEquipmentExternalSession({ token, secret: secret() }) : null;
  if (!session || (expectedGrantId && session.grantId !== expectedGrantId.toLowerCase())) {
    throw new HttpError(401, "Saisissez le code d’accès communiqué par le lycée.");
  }
  const institution = await requireConfiguredInstitution();
  const [grant] = await db.select().from(equipmentExternalAccessGrants).where(and(
    eq(equipmentExternalAccessGrants.id, session.grantId),
    eq(equipmentExternalAccessGrants.institutionId, institution.id),
    gt(equipmentExternalAccessGrants.expiresAt, new Date()),
    isNull(equipmentExternalAccessGrants.revokedAt),
    isNull(equipmentExternalAccessGrants.lockedAt)
  )).limit(1);
  if (!grant) throw new HttpError(410, "Cet accès a expiré ou a été désactivé.");
  return { institution, grant };
}
