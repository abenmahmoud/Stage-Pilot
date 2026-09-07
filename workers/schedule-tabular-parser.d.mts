export const SCHEDULE_TABULAR_MAX_BYTES: number;
export const SCHEDULE_TABULAR_MAX_ROWS: number;

export class ScheduleTabularParseError extends Error {
  code: string;
  constructor(code: string, message: string);
}

export type ScheduleTabularParseResult = {
  checksum: string;
  headers: string[];
  rows: string[][];
  rowCount: number;
};

export function parseScheduleTabularBytes(input: {
  bytes: Buffer;
  fileName: string;
}): ScheduleTabularParseResult;
