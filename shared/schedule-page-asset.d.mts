export const SCHEDULE_PAGE_ASSET_BUCKET: "schedule-ingest";
export function schedulePageAssetStoragePath(
  institutionId: string,
  sourceVersionId: string,
  pageNumber: number
): string;
export function isExpectedSchedulePageAssetPath(
  value: string,
  institutionId: string,
  sourceVersionId: string,
  pageNumber: number
): boolean;
