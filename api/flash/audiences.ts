import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleApi, methodNotAllowed } from '../_shared/response.js';
import { requireFlashActor } from '../_shared/flash-access.js';
import { readContentAudienceClasses } from '../_shared/content-audiences.js';
import { flashAudienceOptions } from '../../shared/flash-audience-groups.mjs';
export default async function handler(req:VercelRequest,res:VercelResponse) {
  if(req.method!=='GET')return methodNotAllowed(res,['GET']);
  return handleApi(res,async()=>{
    await requireFlashActor(req);
    return {groups:flashAudienceOptions(await readContentAudienceClasses()),pushAvailable:process.env.SUPPORT_FLASH_PUSH_ENABLED==='true'};
  });
}

export const config={api:{bodyParser:false}};
