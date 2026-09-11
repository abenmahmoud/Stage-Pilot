import type { VercelRequest, VercelResponse } from '@vercel/node';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../../../db/index.js';
import { siteContentAssets } from '../../../db/schema.js';
import { identityDeviceFeatureEnabled } from '../../../shared/identity-device-access.js';
import { isNewsId, isPersonalNewsArticle } from '../../../shared/personal-news.js';
import { schoolCalendarIcal } from '../../../shared/school-calendar-ical.js';
import { readIdentityDeviceSession } from '../../_shared/identity-device-access.js';
import { readPersonalHomeTargets } from '../../_shared/personal-home-reader.js';
import { readAuthorizedNews } from '../../_shared/personal-news-reader.js';
import { signedAssetUrl } from '../../_shared/site-content.js';
import { enforceSupportRateLimit, personalHash } from '../../_shared/support.js';
import { HttpError } from '../../_shared/auth.js';
import { handleApi, methodNotAllowed } from '../../_shared/response.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control','private, no-store, max-age=0'); res.setHeader('Vary','Cookie');
  res.setHeader('Referrer-Policy','no-referrer');
  if (req.method !== 'GET') return methodNotAllowed(res,['GET']);
  return handleApi(res, async () => {
    if (Object.keys(req.query).some(k=>!['article','asset','format'].includes(k)) || !isNewsId(req.query.article)
      || (req.query.asset !== undefined && !isNewsId(req.query.asset)) || (req.query.format !== undefined && req.query.format !== 'ics')
      || (req.query.asset && req.query.format)) throw new HttpError(400,'Choisissez une information dans votre espace.');
    if (!identityDeviceFeatureEnabled()) throw new HttpError(401,'Identifiez-vous pour ouvrir votre espace.');
    const identity = await readIdentityDeviceSession(req, res);
    if (!identity) throw new HttpError(401,'Identifiez-vous pour ouvrir votre espace.');
    await enforceSupportRateLimit({ scope: 'assistant_session', keyHash: personalHash(`personal-news:${identity.id}`), limit:40, windowSeconds:60 });
    const now = new Date();
    const targets = await readPersonalHomeTargets(identity, now);
    const [entry] = await readAuthorizedNews(identity, targets, now, req.query.article);
    if (!entry) throw new HttpError(404,'Cette information n’est plus disponible dans votre espace.');
    const ids = entry.content.assets.map(a=>a.assetId);
    const assets = ids.length ? await db.select({id:siteContentAssets.id, mimeType:siteContentAssets.mimeType, path:siteContentAssets.storagePath}).from(siteContentAssets)
      .where(and(inArray(siteContentAssets.id, ids),eq(siteContentAssets.status,'ready'))) : [];
    const confirmed = await readIdentityDeviceSession(req,res);
    if (!confirmed || confirmed.id !== identity.id || confirmed.personRef !== identity.personRef || confirmed.institutionId !== identity.institutionId
      || confirmed.sourceImportId !== identity.sourceImportId || confirmed.expiresAt <= new Date()) throw new HttpError(401,'Votre accès doit être confirmé de nouveau.');
    const validUntil = new Date(Math.min(Date.now()+60_000, confirmed.expiresAt.getTime(), entry.content.expiresAt?.getTime() ?? Infinity));
    if (validUntil.getTime() <= Date.now()) throw new HttpError(404,'Cette information n’est plus disponible.');
    if (req.query.asset) {
      const asset = assets.find(a=>a.id === req.query.asset);
      if (!asset) throw new HttpError(404,'Ce document n’est plus disponible.');
      const url = await signedAssetUrl(asset.path, Math.max(1,Math.floor((validUntil.getTime()-Date.now())/1000)));
      if (!url) throw new HttpError(503,'Le document ne peut pas être ouvert pour le moment.');
      res.redirect(302,url); return;
    }
    if (req.query.format === 'ics') {
      const events = entry.preview.calendarEvents.map(e=>({...e,id:`${entry.preview.id}:${e.key}`,articleId:entry.preview.id,articleSlug:entry.content.slug,articleTitle:entry.preview.title,category:entry.preview.category,summary:entry.preview.summary,version:entry.preview.version,updatedAt:entry.preview.publishedAt,articleExpired:false,image:null}));
      res.setHeader('Content-Type','text/calendar; charset=utf-8'); res.setHeader('Content-Disposition','attachment; filename="mes-dates-blaise-cendrars.ics"');
      res.status(200).send(schoolCalendarIcal(events,{personal:true})); return;
    }
    const result = {item:entry.preview,bodyMarkdown:entry.content.bodyMarkdown,validUntil:validUntil.toISOString(),assets:entry.content.assets.flatMap(link=>{
      const asset = assets.find(a=>a.id === link.assetId); return asset ? [{id:asset.id,label:link.publicLabel,mimeType:asset.mimeType}] : [];
    })};
    if (!isPersonalNewsArticle(result)) throw new Error('Invalid personal article');
    return result;
  });
}
