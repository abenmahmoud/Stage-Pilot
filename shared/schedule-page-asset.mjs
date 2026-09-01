const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const SCHEDULE_PAGE_ASSET_BUCKET = "schedule-ingest";

export function schedulePageAssetStoragePath(institutionId, sourceVersionId, pageNumber) {
  if (
    !UUID_PATTERN.test(institutionId)
    || !UUID_PATTERN.test(sourceVersionId)
    || !Number.isInteger(pageNumber)
    || pageNumber < 1
    || pageNumber > 500
  ) {
    throw new Error("Invalid schedule page asset scope");
  }
  return [
    "page-assets",
    institutionId.toLowerCase(),
    sourceVersionId.toLowerCase(),
    `${String(pageNumber).padStart(4, "0")}.pdf`,
  ].join("/");
}

export function isExpectedSchedulePageAssetPath(
  value,
  institutionId,
  sourceVersionId,
  pageNumber
) {
  try {
    return value === schedulePageAssetStoragePath(
      institutionId,
      sourceVersionId,
      pageNumber
    );
  } catch {
    return false;
  }
}
