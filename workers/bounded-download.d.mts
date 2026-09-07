export class BoundedDownloadError extends Error {
  code: string;
  constructor(code?: string);
}

export function boundedBlobToBuffer(
  blob: { arrayBuffer: () => Promise<ArrayBuffer>; size: number },
  expectedBytes: number,
  maxBytes: number
): Promise<Buffer>;

export function readBoundedResponseBytes(response: Response, maxBytes: number): Promise<Buffer>;

export function readBoundedJsonResponse(response: Response, maxBytes: number): Promise<Record<string, unknown>>;
