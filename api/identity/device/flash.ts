import type { VercelRequest,VercelResponse } from '@vercel/node';
import { client } from '../../../db/index.js';
import { identityDeviceFeatureEnabled } from '../../../shared/identity-device-access.js';
import { flashViewerGroups } from '../../../shared/flash-audience-groups.mjs';
import { parsePersonalFlash } from '../../../shared/personal-flash.js';
import { HttpError } from '../../_shared/auth.js';
import { readIdentityDeviceSession } from '../../_shared/identity-device-access.js';
import { readPersonalHomeTargets } from '../../_shared/personal-home-reader.js';
import { enforceSupportRateLimit,personalHash } from '../../_shared/support.js';
import { handleApi,methodNotAllowed } from '../../_shared/response.js';

export default async function handler(req:VercelRequest,res:VercelResponse) {
  res.setHeader('Cache-Control','private, no-store, max-age=0');res.setHeader('Vary','Cookie');
  if(req.method!=='GET')return methodNotAllowed(res,['GET']);
  return handleApi(res,async()=>{
    if(Object.keys(req.query).length)throw new HttpError(400,'Aucun filtre personnel ne peut être fourni.');
    const identity=identityDeviceFeatureEnabled()?await readIdentityDeviceSession(req,res):null;
    if(!identity)throw new HttpError(401,'Identifiez-vous pour consulter vos informations.');
    await enforceSupportRateLimit({scope:'assistant_session',keyHash:personalHash(`personal-flash:${identity.id}`),limit:40,windowSeconds:60});
    const targets=await readPersonalHomeTargets(identity,new Date());
    const groups=flashViewerGroups(identity.personType,targets.map(t=>t.classRef ?? null));
    const rows=await client`select distinct v.id,v.title,v.body_markdown,v.importance,v.expires_at,v.published_at
      from flash_infos f join flash_info_versions v on v.flash_info_id=f.id and v.version=f.published_version and v.institution_id=f.institution_id
      join flash_info_audiences a on a.version_id=v.id and a.institution_id=v.institution_id
      where f.institution_id=${identity.institutionId} and v.status='publiee' and v.expires_at>now()
        and a.group_ref=any(${groups}::text[]) order by v.published_at desc limit 20`;
    const confirmed=await readIdentityDeviceSession(req);
    if(!confirmed||confirmed.id!==identity.id||confirmed.personRef!==identity.personRef||confirmed.sourceImportId!==identity.sourceImportId||confirmed.institutionId!==identity.institutionId||confirmed.expiresAt<=new Date())throw new HttpError(401,'Votre accès a expiré. Identifiez-vous de nouveau.');
    const items=rows.filter(r=>new Date(r.expires_at).getTime()>Date.now()).map(r=>({id:r.id,title:r.title,bodyMarkdown:r.body_markdown,importance:r.importance,expiresAt:new Date(r.expires_at).toISOString()}));
    const payload=parsePersonalFlash({items,validUntil:new Date(Math.min(Date.now()+60000,confirmed.expiresAt.getTime(),...items.map(i=>Date.parse(i.expiresAt)))).toISOString()});
    if(!payload)throw new HttpError(503,'Les informations ne peuvent pas être affichées pour le moment.');
    return payload;
  });
}
export const config={api:{bodyParser:false}};
