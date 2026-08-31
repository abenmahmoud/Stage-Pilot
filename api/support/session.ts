import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "../../db/index.js";
import { supportDeviceSessions } from "../../db/schema.js";
import { handleApi, methodNotAllowed } from "../_shared/response.js";
import {
  clearSupportSessionCookie,
  readSupportSessionToken,
  sha256,
} from "../_shared/support.js";
import { isSupportSessionClearPayload } from "../../shared/support-public-mutation-payload-policy.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "DELETE") return methodNotAllowed(res, ["DELETE"]);

  return handleApi(res, async () => {
    const token = readSupportSessionToken(req);
    if (token) {
      await db
        .update(supportDeviceSessions)
        .set({ revokedAt: new Date() })
        .where(
          and(
            eq(supportDeviceSessions.sessionHash, sha256(token)),
            isNull(supportDeviceSessions.revokedAt)
          )
        );
    }
    clearSupportSessionCookie(res);
    const payload = { cleared: true as const };
    if (!isSupportSessionClearPayload(payload)) {
      throw new Error("Support session closure payload is invalid");
    }
    return payload;
  });
}

export const config = { api: { bodyParser: false } };
