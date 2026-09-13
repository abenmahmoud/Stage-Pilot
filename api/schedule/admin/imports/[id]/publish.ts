import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from 'drizzle-orm';
import { db } from '../../../../../db/index.js';
import { publicationUuid, parseSchedulePublicationInput } from '../../../../../shared/schedule-publication.js';
import { readSchedulePublication, publishScheduleCalendars, SchedulePublicationError } from '../../../../_shared/schedule-publication.js';
import { requireScheduleManager } from '../../../../_shared/schedule-imports.js';
import { HttpError, supabaseAdmin } from '../../../../_shared/auth.js';
import { handleApi, methodNotAllowed } from '../../../../_shared/response.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') return methodNotAllowed(res, ['GET','POST']);
  return handleApi(res, async () => {
    const context = await requireScheduleManager(req);
    const id = req.query.id;
    if (typeof id !== 'string' || !publicationUuid.test(id)) throw new HttpError(400, 'Version invalide.');
    let copiedPath: string | null = null;
    try {
      if (req.method === 'GET') return await db.transaction(async tx => (await readSchedulePublication(tx, context.institutionId, id)).plan,
        { isolationLevel: 'repeatable read', accessMode: 'read only' });
      let input;
      try { input = parseSchedulePublicationInput(req.body); }
      catch (error) { throw new HttpError(400, error instanceof Error ? error.message : 'Confirmation invalide.'); }
      return await db.transaction(tx => publishScheduleCalendars(tx, { institutionId: context.institutionId, sourceId: id, actorId: context.user.id, ...input }, async (from, to) => {
        copiedPath = to;
        const { data, error } = await supabaseAdmin.storage.from('schedule-ingest').copy(from, to);
        if (error || !data?.path) throw new SchedulePublicationError(503, 'La copie privée de l’export n’a pas abouti. Aucun calendrier n’a été activé.');
      }));
    } catch (error) {
      if (copiedPath) {
        // A lost COMMIT response is not proof of rollback. Wait for the source lock,
        // then delete this attempt's copy only if no committed source references it.
        const path = copiedPath;
        try {
          await db.transaction(async tx => {
            await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${id}::text,61744))`);
            const result = await tx.execute(sql`select id from public.schedule_source_versions where storage_bucket='schedule-ingest' and storage_path=${path} limit 1`);
            const references = Array.isArray(result) ? result : (result as { rows: unknown[] }).rows;
            if (!references.length) {
              const removed = await supabaseAdmin.storage.from('schedule-ingest').remove([path]);
              if (removed.error) console.error('[schedule-publication] private copy cleanup pending');
            }
          });
        } catch { console.error('[schedule-publication] private copy cleanup unconfirmed'); }
      }
      if (error instanceof SchedulePublicationError) throw new HttpError(error.status, error.message);
      // Never log SQL parameters, references, storage paths or actual timetable contents.
      if (error instanceof HttpError) throw error;
      throw new HttpError(503, 'L’activation n’a pas pu être confirmée. Actualisez le bilan avant de réessayer.');
    }
  });
}
export const config = { api: { bodyParser: { sizeLimit: '4kb' } } };
