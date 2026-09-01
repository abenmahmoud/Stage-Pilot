import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, desc, eq, gt, isNotNull, isNull, lt, ne, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import {
  supportMagicTokens,
  supportRequests,
} from "../../db/schema.js";
import { HttpError } from "../_shared/auth.js";
import { handleApi, methodNotAllowed } from "../_shared/response.js";
import {
  opaqueToken,
  readSupportSessionToken,
  setSupportSessionCookie,
} from "../_shared/support.js";
import { openSupportAccessSession } from "../_shared/support-access-session.js";
import { enforceMagicTokenNetworkGuard } from "../_shared/support-rate-limits.js";
import { requireConfiguredInstitution } from "../_shared/institution-context.js";
import {
  supportAccessCodeMatches,
  supportAccessCodeSecret,
} from "../../shared/support-access-code.mjs";
import { parseSupportAccessCodeInput } from "../../shared/support-access-code-payload-policy.js";
import { isSupportMagicAccessPayload } from "../../shared/support-magic-access-payload-policy.js";

const MAX_CODE_ATTEMPTS = 5;
const MAX_CODE_CANDIDATES = 5;

function accessCodeInput(body: unknown) {
  try {
    return parseSupportAccessCodeInput(body);
  } catch {
    throw new HttpError(400, "Le numéro de demande ou le code est invalide.");
  }
}

function accessCodeSecret(): string {
  try {
    return supportAccessCodeSecret(process.env.SUPPORT_ACCESS_CODE_SECRET);
  } catch {
    throw new HttpError(503, "L’accès par code est momentanément indisponible.");
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);

  return handleApi(res, async () => {
    const input = accessCodeInput(req.body);
    const secret = accessCodeSecret();
    await enforceMagicTokenNetworkGuard(req);
    const institution = await requireConfiguredInstitution();
    const existingSessionToken = readSupportSessionToken(req);
    const newSessionToken = opaqueToken();
    const result = await db.transaction(async (tx) => {
      const now = new Date();
      const candidates = await tx
        .select({
          id: supportMagicTokens.id,
          requestId: supportMagicTokens.requestId,
          contactId: supportMagicTokens.contactId,
          tokenHash: supportMagicTokens.tokenHash,
          publicCode: supportRequests.publicCode,
        })
        .from(supportMagicTokens)
        .innerJoin(supportRequests, eq(supportRequests.id, supportMagicTokens.requestId))
        .where(
          and(
            eq(supportRequests.publicCode, input.publicCode),
            eq(supportRequests.institutionId, institution.id),
            eq(supportMagicTokens.purpose, "support_access"),
            gt(supportMagicTokens.expiresAt, now),
            isNull(supportMagicTokens.usedAt),
            isNotNull(supportMagicTokens.contactId),
            lt(supportMagicTokens.attemptCount, MAX_CODE_ATTEMPTS)
          )
        )
        .orderBy(desc(supportMagicTokens.createdAt))
        .limit(MAX_CODE_CANDIDATES);

      const paddedTokenHashes = [
        ...candidates.map((candidate) => candidate.tokenHash),
        ...Array(MAX_CODE_CANDIDATES - candidates.length).fill("0".repeat(64)),
      ];
      const matchedIndex = paddedTokenHashes
        .map((tokenHash) => supportAccessCodeMatches({ code: input.code, tokenHash, secret }))
        .findIndex((matches, index) => matches && index < candidates.length);
      const matched = matchedIndex >= 0 ? candidates[matchedIndex] : undefined;

      if (!matched) {
        const latest = candidates[0];
        if (latest) {
          await tx
            .update(supportMagicTokens)
            .set({ attemptCount: sql`${supportMagicTokens.attemptCount} + 1` })
            .where(
              and(
                eq(supportMagicTokens.id, latest.id),
                gt(supportMagicTokens.expiresAt, now),
                isNull(supportMagicTokens.usedAt),
                lt(supportMagicTokens.attemptCount, MAX_CODE_ATTEMPTS)
              )
            );
        }
        return { ok: false as const };
      }

      const [consumed] = await tx
        .update(supportMagicTokens)
        .set({
          usedAt: now,
          attemptCount: sql`${supportMagicTokens.attemptCount} + 1`,
        })
        .where(
          and(
            eq(supportMagicTokens.id, matched.id),
            gt(supportMagicTokens.expiresAt, now),
            isNull(supportMagicTokens.usedAt),
            lt(supportMagicTokens.attemptCount, MAX_CODE_ATTEMPTS)
          )
        )
        .returning({ id: supportMagicTokens.id });
      if (!consumed || !matched.contactId) return { ok: false as const };

      await tx
        .update(supportMagicTokens)
        .set({ usedAt: now })
        .where(
          and(
            eq(supportMagicTokens.requestId, matched.requestId),
            eq(supportMagicTokens.contactId, matched.contactId),
            eq(supportMagicTokens.purpose, "support_access"),
            isNull(supportMagicTokens.usedAt),
            ne(supportMagicTokens.id, matched.id)
          )
        );

      await openSupportAccessSession({
        tx,
        institutionId: institution.id,
        requestId: matched.requestId,
        contactId: matched.contactId,
        existingSessionToken,
        newSessionToken,
        label: "Code email",
        verificationSource: "email_one_time_code",
        now,
      });
      return { ok: true as const, publicCode: matched.publicCode };
    });

    if (!result.ok) {
      throw new HttpError(401, "Le code est incorrect, expiré ou déjà utilisé.");
    }
    const payload = { request: { publicCode: result.publicCode } };
    if (!isSupportMagicAccessPayload(payload, result.publicCode)) {
      throw new HttpError(503, "La confirmation du code de suivi est invalide.");
    }
    setSupportSessionCookie(res, newSessionToken);
    return payload;
  });
}

export const config = { api: { bodyParser: { sizeLimit: "2kb" } } };
