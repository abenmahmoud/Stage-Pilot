import { createHash } from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../../../db/index.js';
import { identityDirectoryAudit } from '../../../db/schema.js';
import { parseCrossDataQuery } from '../../../shared/admin-cross-data.js';
import { HttpError, requireRole } from '../../_shared/auth.js';
import { requireIdentityDirectoryManager } from '../../_shared/identity-directory.js';
import { readAdminCrossData } from '../../_shared/admin-cross-data-reader.js';
import { handleApi, methodNotAllowed } from '../../_shared/response.js';

export default async function handler(req:VercelRequest,res:VercelResponse) {
  if(req.method!=='POST') return methodNotAllowed(res,['POST']);
  return handleApi(res,async()=>{
    await requireRole(req,['superadmin']);
    const context=await requireIdentityDirectoryManager(req);
    let query; try {query=parseCrossDataQuery(req.body);} catch {throw new HttpError(400,'Recherche invalide.');}
    try {
      const data=await readAdminCrossData(context.institutionId,query);
      if(data.revision) await db.insert(identityDirectoryAudit).values({institutionId:context.institutionId,resourceType:'import',resourceId:data.revision,actorId:context.user.id,action:'read_lookup',summary:{scope:'cross_data',filter:query.filter,profile:query.profile,detail:!!query.personRef,...(query.personRef?{personRefHash:createHash('sha256').update(query.personRef).digest('hex')}:{})}});
      return data;
    } catch(error) {
      if(error instanceof HttpError) throw error;
      // Never serialize private query parameters or decrypted attributes into logs.
      console.error('[cross-data] read_failed');
      throw new HttpError(503,'Les données croisées sont momentanément indisponibles. Réessayez.');
    }
  });
}
export const config={api:{bodyParser:{sizeLimit:'4kb'}}};
