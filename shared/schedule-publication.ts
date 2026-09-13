import { parseSchedulePromotionInput } from './schedule-promotion-input.js';

export const publicationUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const hash = /^[a-f0-9]{64}$/;
export type SchedulePublicationPlan = {
  sourceId: string; token: string; readyCount: number; waitingCount: number;
  excludedCount: number; activeSourceId: string | null; alreadyPublished: boolean;
};
function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
export function parseSchedulePublicationPlan(value: unknown, sourceId: string): SchedulePublicationPlan | null {
  const row = object(value);
  if (!row || Object.keys(row).sort().join() !== 'activeSourceId,alreadyPublished,excludedCount,readyCount,sourceId,token,waitingCount' || row.sourceId !== sourceId || !publicationUuid.test(sourceId)
    || typeof row.token !== 'string' || !hash.test(row.token) || typeof row.alreadyPublished !== 'boolean'
    || !(row.activeSourceId === null || (typeof row.activeSourceId === 'string' && publicationUuid.test(row.activeSourceId)))) return null;
  const counts = [row.readyCount, row.waitingCount, row.excludedCount];
  if (counts.some(n => !Number.isInteger(n) || Number(n) < 0 || Number(n) > 250) || counts.reduce<number>((sum, n) => sum + Number(n), 0) > 250) return null;
  if (row.alreadyPublished && !row.activeSourceId) return null;
  return row as SchedulePublicationPlan;
}
export function parseSchedulePublicationInput(value: unknown): { token: string; justification: string } {
  const row = object(value);
  if (!row || Object.keys(row).sort().join() !== 'confirmation,justification,token' || typeof row.token !== 'string' || !hash.test(row.token)) throw new Error('Actualisez le bilan avant de confirmer.');
  return { token: row.token, ...parseSchedulePromotionInput(row, 'ACTIVER') };
}
export function parseSchedulePublicationReceipt(value: unknown, expected: SchedulePublicationPlan) {
  const row = object(value);
  if (!row || Object.keys(row).sort().join() !== 'activeSourceId,duplicate,readyCount,sourceId,token,waitingCount'
    || row.sourceId !== expected.sourceId || row.token !== expected.token || row.readyCount !== expected.readyCount
    || row.waitingCount !== expected.waitingCount || typeof row.duplicate !== 'boolean'
    || typeof row.activeSourceId !== 'string' || !publicationUuid.test(row.activeSourceId)) return null;
  return row as { sourceId: string; token: string; activeSourceId: string; readyCount: number; waitingCount: number; duplicate: boolean };
}
