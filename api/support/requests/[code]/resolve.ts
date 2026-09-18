import { randomUUID } from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../../../../db/index.js';
import { supportEvents, supportRequests } from '../../../../db/schema.js';
import { HttpError } from '../../../_shared/auth.js';
import { handleApi, methodNotAllowed } from '../../../_shared/response.js';
import { enforceSupportRateLimit, personalHash, requireSupportAccess } from '../../../_shared/support.js';
import { SUPPORT_RATE_LIMIT_POLICIES } from '../../../../shared/support-rate-limit-policy.js';
import { REQUESTER_RESOLVABLE_STATUSES } from '../../../../shared/support-requester-resolution.js';
import { singleSupportQueryValue } from '../../../../shared/support-public-mutation-input-policy.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  return handleApi(res, async () => {
    const code = singleSupportQueryValue(req.query.code);
    if (!code || !/^BC-\d{4}-\d{6}$/.test(code)) throw new HttpError(400, 'Numéro de demande invalide');
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)
      || Object.keys(req.body).length !== 1 || req.body.resolved !== true) {
      throw new HttpError(400, 'Confirmation de résolution invalide');
    }
    const access = await requireSupportAccess(req, code);
    await enforceSupportRateLimit({
      ...SUPPORT_RATE_LIMIT_POLICIES.messageSessionBurst,
      keyHash: personalHash(`resolve:${access.sessionId}`),
    });
    const result = await db.transaction(async tx => {
      const now = new Date();
      const [updated] = await tx.update(supportRequests)
        .set({ status: 'resolu', resolvedAt: now, updatedAt: now })
        .where(and(
          eq(supportRequests.institutionId, access.institutionId),
          eq(supportRequests.id, access.requestId),
          inArray(supportRequests.status, [...REQUESTER_RESOLVABLE_STATUSES]),
        ))
        .returning({ status: supportRequests.status, resolvedAt: supportRequests.resolvedAt });
      if (updated) {
        await tx.insert(supportEvents).values({
          requestId: access.requestId,
          eventType: 'request.resolved_by_requester',
          actorType: 'requester',
          actorId: access.sessionId,
          toValue: { status: 'resolu' },
          correlationId: randomUUID(),
        });
        return { status: 'resolu', resolvedAt: updated.resolvedAt?.toISOString() ?? now.toISOString(), alreadyResolved: false };
      }
      const [current] = await tx.select({ status: supportRequests.status, resolvedAt: supportRequests.resolvedAt })
        .from(supportRequests)
        .where(and(eq(supportRequests.institutionId, access.institutionId), eq(supportRequests.id, access.requestId)))
        .limit(1);
      if (current?.status === 'resolu') {
        return { status: 'resolu', resolvedAt: current.resolvedAt?.toISOString() ?? null, alreadyResolved: true };
      }
      throw new HttpError(409, 'Ce dossier ne peut plus être marqué comme résolu depuis cet accès.');
    });
    res.status(200);
    return result;
  });
}

export const config = { api: { bodyParser: { sizeLimit: '1kb' } } };
