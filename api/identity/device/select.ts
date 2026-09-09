import type { VercelRequest, VercelResponse } from '@vercel/node';
import { and, eq, gt } from 'drizzle-orm';
import { db } from '../../../db/index.js';
import { identityDeviceChallenges, identityDirectoryLookupRequests } from '../../../db/schema.js';
import { identityDeviceFeatureEnabled, IDENTITY_DEVICE_CHALLENGE_SECONDS } from '../../../shared/identity-device-access.js';
import { identityLookupApiConfig, openIdentityLookupReceipt, sealIdentityLookupReceipt } from '../../../shared/identity-directory-lookup-crypto.mjs';
import { maskIdentityContact } from '../../../shared/identity-contact-choices.mjs';
import { challengeReceiptClaims, readChallengeReceipt, setChallengeReceiptCookie, identityDeviceCode, identityDeviceCodeHash } from '../../_shared/identity-device-access.js';
import { readDeviceChoiceResult } from '../../_shared/identity-contact-choices.js';
import { deliverIdentityCode } from '../../_shared/identity-code-delivery.js';
import { enforceIdentityOtpContactLimits } from '../../_shared/support-rate-limits.js';
import { personalHash } from '../../_shared/support.js';
import { HttpError } from '../../_shared/auth.js';
import { handleApi, methodNotAllowed } from '../../_shared/response.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  return handleApi(res, async () => {
    if (!identityDeviceFeatureEnabled()) throw new HttpError(503, 'La vérification est indisponible.');
    if (!req.body || Object.keys(req.body).length !== 1 || !['phone', 'academic_email', 'personal_email'].includes(req.body.optionId)) {
      throw new HttpError(400, 'Choisissez un des moyens proposés.');
    }
    const config = identityLookupApiConfig();
    let claims;
    try { claims = challengeReceiptClaims(openIdentityLookupReceipt(readChallengeReceipt(req) ?? '', config.receiptKey)); }
    catch { throw new HttpError(401, 'Cette recherche a expiré. Recommencez.'); }
    if (claims.schema !== 2 || new Date(claims.expiresAt) <= new Date()) throw new HttpError(410, 'Cette recherche a expiré. Recommencez.');
    const [row] = await db.select({ challenge: identityDeviceChallenges, lookup: identityDirectoryLookupRequests })
      .from(identityDeviceChallenges).innerJoin(identityDirectoryLookupRequests, eq(identityDirectoryLookupRequests.id, identityDeviceChallenges.lookupRequestId))
      .where(and(eq(identityDeviceChallenges.id, claims.challengeId), eq(identityDeviceChallenges.institutionId, claims.institutionId),
        eq(identityDeviceChallenges.lookupRequestId, claims.requestId), eq(identityDirectoryLookupRequests.publicActorId, claims.challengeId))).limit(1);
    if (!row || row.challenge.status !== 'lookup_queued') throw new HttpError(409, 'Un choix a déjà été envoyé. Consultez le code reçu ou recommencez.');
    const result = await readDeviceChoiceResult(claims, row.lookup);
    const chosen = result.contacts.find(option => option.id === req.body.optionId);
    if (!chosen) throw new HttpError(400, 'Ce moyen ne fait pas partie des coordonnées proposées.');
    await enforceIdentityOtpContactLimits({ institutionId: claims.institutionId, contact: chosen.value });
    const expiresAt = new Date(Date.now() + IDENTITY_DEVICE_CHALLENGE_SECONDS * 1000);
    // Only the winner sends. Repeated clicks/status polls cannot resend this OTP.
    const [won] = await db.update(identityDeviceChallenges).set({
      status: 'delivery_pending', codeHash: identityDeviceCodeHash(claims.challengeId, identityDeviceCode(claims.challengeId)),
      contactHash: personalHash(`identity-device-contact:${claims.institutionId}:${chosen.type}:${chosen.value}`),
      matchedImportId: result.directoryVersionId, matchedPersonRef: result.personRef, matchedPersonType: result.personType,
      expiresAt, updatedAt: new Date(),
    }).where(and(eq(identityDeviceChallenges.id, claims.challengeId), eq(identityDeviceChallenges.status, 'lookup_queued'), gt(identityDeviceChallenges.expiresAt, new Date())))
      .returning({ id: identityDeviceChallenges.id });
    if (!won) throw new HttpError(409, 'Votre choix est déjà en cours de traitement.');
    setChallengeReceiptCookie(res, sealIdentityLookupReceipt({ ...claims, contactType: chosen.type, contact: chosen.value, expiresAt: expiresAt.toISOString() }, config.receiptKey), IDENTITY_DEVICE_CHALLENGE_SECONDS);
    try {
      await deliverIdentityCode({ challengeId: claims.challengeId, contactType: chosen.type, contact: chosen.value, firstName: result.firstName });
      await db.update(identityDeviceChallenges).set({ status: 'code_sent', codeSentAt: new Date() })
        .where(and(eq(identityDeviceChallenges.id, claims.challengeId), eq(identityDeviceChallenges.status, 'delivery_pending')));
    } catch {
      await db.update(identityDeviceChallenges).set({ status: 'failed' }).where(eq(identityDeviceChallenges.id, claims.challengeId));
      throw new HttpError(503, 'L’envoi du code n’a pas pu être confirmé. Réessayez dans quelques instants.');
    }
    return { status: 'code_sent', destination: maskIdentityContact(chosen.type, chosen.value), expiresAt: expiresAt.toISOString() };
  });
}
export const config = { api: { bodyParser: { sizeLimit: '1kb' } } };
