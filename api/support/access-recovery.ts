import { randomUUID } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { supportContacts, supportEvents, supportMagicTokens, supportRequests } from "../../db/schema.js";
import { HttpError } from "../_shared/auth.js";
import { handleApi, methodNotAllowed } from "../_shared/response.js";
import { requireConfiguredInstitution } from "../_shared/institution-context.js";
import { opaqueToken, personalHash, sha256, SUPPORT_MAGIC_TOKEN_MINUTES } from "../_shared/support.js";
import { enforceMagicTokenNetworkGuard, enforceSupportAccessRecoveryLimits } from "../_shared/support-rate-limits.js";
import { parseSupportAccessRecoveryInput, SUPPORT_ACCESS_RECOVERY_COOLDOWN_SECONDS } from "../../shared/support-access-recovery-policy.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  return handleApi(res, async () => {
    if (process.env.SUPPORT_ACCESS_RECOVERY_ENABLED !== "true") {
      throw new HttpError(503, "Le renvoi de lien est momentanément indisponible.");
    }
    await enforceMagicTokenNetworkGuard(req);
    let input;
    try { input = parseSupportAccessRecoveryInput(req.body); }
    catch { throw new HttpError(400, "Vérifiez le numéro de demande et l'adresse email."); }
    const institution = await requireConfiguredInstitution();
    await enforceSupportAccessRecoveryLimits({ ...input, institutionId: institution.id });
    const contactHash = personalHash(input.email);
    try {
      await db.transaction(async (tx) => {
        const contacts = await tx
          .select({ id: supportContacts.id, requestId: supportContacts.requestId })
          .from(supportContacts)
          .innerJoin(supportRequests, eq(supportRequests.id, supportContacts.requestId))
          .where(and(
            eq(supportRequests.institutionId, institution.id),
            eq(supportRequests.publicCode, input.publicCode),
            eq(supportContacts.normalizedHash, contactHash),
            eq(supportContacts.channel, "email"),
            eq(supportContacts.usageScope, "support"),
            isNull(supportContacts.disabledAt)
          ))
          .limit(2)
          .for("update", { of: supportContacts });
        if (contacts.length !== 1) return;
        const contact = contacts[0];
        const now = new Date();
        // Serialize retries on the contact without revoking an existing link.
        const [recent] = await tx.select({ id: supportMagicTokens.id }).from(supportMagicTokens)
          .where(and(
            eq(supportMagicTokens.requestId, contact.requestId),
            eq(supportMagicTokens.contactId, contact.id),
            eq(supportMagicTokens.purpose, "support_access"),
            gt(supportMagicTokens.createdAt, new Date(now.getTime() - SUPPORT_ACCESS_RECOVERY_COOLDOWN_SECONDS * 1000))
          )).limit(1);
        if (recent) return;
        const accessToken = opaqueToken();
        const jobId = randomUUID();
        await tx.insert(supportMagicTokens).values({
          requestId: contact.requestId, contactId: contact.id, tokenHash: sha256(accessToken),
          purpose: "support_access", expiresAt: new Date(now.getTime() + SUPPORT_MAGIC_TOKEN_MINUTES * 60 * 1000),
        });
        const payload = {
          job_id: jobId, job_type: "send_requester_access_link", institution_id: institution.id,
          request_id: contact.requestId, contact_id: contact.id, access_token: accessToken,
        };
        await tx.execute(sql`select pgmq.send('support_jobs', ${JSON.stringify(payload)}::jsonb)`);
        await tx.insert(supportEvents).values({
          requestId: contact.requestId, eventType: "access.recovery_queued", actorType: "system",
          toValue: { channel: "email" }, correlationId: randomUUID(),
        });
      });
    } catch {
      // Queue parameters contain a secret: never forward raw driver errors to logs.
      throw new HttpError(503, "Le renvoi de lien est momentanément indisponible.");
    }
    res.status(202);
    return { accepted: true };
  });
}

export const config = { api: { bodyParser: { sizeLimit: "2kb" } } };
