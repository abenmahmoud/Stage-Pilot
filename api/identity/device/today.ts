import type { VercelRequest, VercelResponse } from '@vercel/node';
import { identityDeviceFeatureEnabled } from '../../../shared/identity-device-access.js';
import { isPersonalHome } from '../../../shared/personal-home.js';
import { HttpError } from '../../_shared/auth.js';
import { readIdentityDeviceSession } from '../../_shared/identity-device-access.js';
import { personalHomeService } from '../../_shared/personal-home-service.js';
import { readPersonalNewsFeed } from '../../_shared/personal-news-reader.js';
import { readPersonalHomeRequests, readPersonalHomeTargets } from '../../_shared/personal-home-reader.js';
import { readCoursesForDayForVerifiedIdentity } from '../../_shared/schedule-identity-reader.js';
import { handleApi, methodNotAllowed } from '../../_shared/response.js';
import { enforceSupportRateLimit, personalHash } from '../../_shared/support.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('Vary', 'Cookie');
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  return handleApi(res, async () => {
    if (Object.keys(req.query).some(key => !['day', 'target'].includes(key))
      || (req.query.day !== undefined && !['today', 'tomorrow'].includes(String(req.query.day))) || Array.isArray(req.query.day)
      || (req.query.target !== undefined && (typeof req.query.target !== 'string' || !/^[a-f0-9]{64}$/.test(req.query.target)))) {
      throw new HttpError(400, 'Choisissez aujourd’hui ou demain dans votre espace.');
    }
    if (!identityDeviceFeatureEnabled()) return { status: 'unavailable' };
    const now = new Date();
    let limited = false;
    const result = await personalHomeService({ day: req.query.day === 'tomorrow' ? 1 : 0, target: req.query.target as string | undefined, now }, {
      identity: async () => {
        const identity = await readIdentityDeviceSession(req, res);
        if (identity && !limited) {
          limited = true;
          await enforceSupportRateLimit({ scope: 'assistant_session', keyHash: personalHash(`personal-home-read:${identity.id}`), limit: 40, windowSeconds: 60 });
        }
        return identity;
      },
      targets: identity => readPersonalHomeTargets(identity, now),
      schedule: (target, bounds) => readCoursesForDayForVerifiedIdentity({ req, targetPersonRef: target.personRef, now, dayStart: bounds.dayStart, dayEnd: bounds.dayEnd }),
      requests: identity => readPersonalHomeRequests(req, identity),
      news: (identity, targets) => readPersonalNewsFeed(identity, targets, now),
    });
    if (!isPersonalHome(result)) throw new Error('Invalid personal home result');
    return result;
  });
}
export const config = { api: { bodyParser: false } };
