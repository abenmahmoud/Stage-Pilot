import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../../../../../db/index.js';
import { parseSchedulePreviewRequest } from '../../../../../shared/schedule-admin-preview.js';
import { requireScheduleManager } from '../../../../_shared/schedule-imports.js';
import { HttpError } from '../../../../_shared/auth.js';
import { handleApi, methodNotAllowed } from '../../../../_shared/response.js';
import { readScheduleAdminPreview, SchedulePreviewError } from '../../../../_shared/schedule-admin-preview-reader.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  return handleApi(res, async () => {
    const context = await requireScheduleManager(req);
    const input = parseSchedulePreviewRequest({ sourceId: req.query.id, calendarId: req.query.calendarId, day: req.query.day });
    if (!input) throw new HttpError(400, 'Choisissez un calendrier et une date valides.');
    try {
      return await db.transaction(tx => readScheduleAdminPreview(tx, context.institutionId, input), {
        isolationLevel: 'repeatable read', accessMode: 'read only',
      });
    } catch (error) {
      if (error instanceof SchedulePreviewError) throw new HttpError(error.status, error.message);
      throw error;
    }
  });
}
