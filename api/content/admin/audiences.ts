import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireSiteEditor } from '../../_shared/site-content.js';
import { readContentAudienceClasses } from '../../_shared/content-audiences.js';
import { handleApi, methodNotAllowed } from '../../_shared/response.js';
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  return handleApi(res, async () => { await requireSiteEditor(req); return { classes: await readContentAudienceClasses() }; });
}
