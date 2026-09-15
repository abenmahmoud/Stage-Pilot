import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../../../db/index.js';
import { identityDeviceFeatureEnabled } from '../../../shared/identity-device-access.js';
import { validPcSessionAccessPayload } from '../../../shared/pc-session-self-service.js';
import { HttpError } from '../../_shared/auth.js';
import { readIdentityDeviceSession } from '../../_shared/identity-device-access.js';
import { readOwnPcSessionAccess } from '../../_shared/pc-session-reader.js';
import { handleApi, methodNotAllowed } from '../../_shared/response.js';
import { enforceSupportRateLimit, personalHash } from '../../_shared/support.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('Vary', 'Cookie');
  if (!['GET', 'POST'].includes(req.method ?? '')) return methodNotAllowed(res, ['GET', 'POST']);
  return handleApi(res, async () => {
    if (Object.keys(req.query).length || (req.method === 'POST' && JSON.stringify(req.body ?? {}) !== '{}')) throw new HttpError(400, 'Requête invalide.');
    if (req.method === 'POST' && !String(req.headers['content-type'] ?? '').toLowerCase().startsWith('application/json')) throw new HttpError(415, 'Format de requête invalide.');
    if (!identityDeviceFeatureEnabled()) throw new HttpError(503, 'Le service est momentanément indisponible.');
    const identity = await readIdentityDeviceSession(req, res);
    if (!identity) throw new HttpError(401, 'Confirmez votre identité pour consulter votre accès PC.');
    await enforceSupportRateLimit({ scope: 'assistant_session', keyHash: personalHash(`pc-self:${identity.id}`), limit: 20, windowSeconds: 60 });
    const result = await db.transaction(tx => readOwnPcSessionAccess(tx, identity, req.method === 'POST'));
    if (!validPcSessionAccessPayload(result)) throw new HttpError(503, 'Les informations PC doivent être vérifiées.');
    return result;
  });
}
export const config = { api: { bodyParser: { sizeLimit: '1kb' } } };
