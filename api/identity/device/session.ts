import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "../../../db/index.js";
import { identityDeviceSessions } from "../../../db/schema.js";
import { identityDeviceFeatureEnabled } from "../../../shared/identity-device-access.js";
import {
  clearIdentityDeviceSessionCookie,
  readIdentityDeviceSession,
  readIdentityDeviceSessionToken,
} from "../../_shared/identity-device-access.js";
import { requireConfiguredInstitution } from "../../_shared/institution-context.js";
import { handleApi, methodNotAllowed } from "../../_shared/response.js";
import { personalHash } from "../../_shared/support.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET" && req.method !== "DELETE") {
    return methodNotAllowed(res, ["GET", "DELETE"]);
  }
  return handleApi(res, async () => {
    if (req.method === "DELETE") {
      const token = readIdentityDeviceSessionToken(req);
      if (token) {
        const institution = await requireConfiguredInstitution();
        await db
          .update(identityDeviceSessions)
          .set({ revokedAt: new Date() })
          .where(
            and(
              eq(identityDeviceSessions.institutionId, institution.id),
              eq(
                identityDeviceSessions.sessionHash,
                personalHash(`identity-device-session:${token}`)
              ),
              isNull(identityDeviceSessions.revokedAt)
            )
          );
      }
      clearIdentityDeviceSessionCookie(res);
      return { available: identityDeviceFeatureEnabled(), status: "unavailable" as const };
    }
    if (!identityDeviceFeatureEnabled()) {
      clearIdentityDeviceSessionCookie(res);
      return { available: false, status: "unavailable" as const };
    }
    const session = await readIdentityDeviceSession(req, res);
    if (!session) return { available: true, status: "unavailable" as const };
    return {
      available: true,
      status: "verified" as const,
      personType: session.personType,
      expiresAt: session.expiresAt.toISOString(),
    };
  });
}

export const config = { api: { bodyParser: false } };
