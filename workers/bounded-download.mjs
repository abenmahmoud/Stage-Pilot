export class BoundedDownloadError extends Error {
  constructor(code = "download_size_invalid") {
    super(code);
    this.name = "BoundedDownloadError";
    this.code = code;
  }
}

function validLimit(value) {
  return Number.isInteger(value) && value >= 1 && value <= 50 * 1024 * 1024;
}

export async function boundedBlobToBuffer(blob, expectedBytes, maxBytes) {
  if (!blob
    || typeof blob.arrayBuffer !== "function"
    || !validLimit(maxBytes)
    || !Number.isInteger(expectedBytes)
    || expectedBytes < 1
    || expectedBytes > maxBytes
    || !Number.isInteger(blob.size)
    || blob.size !== expectedBytes) {
    throw new BoundedDownloadError();
  }
  const bytes = Buffer.from(await blob.arrayBuffer());
  if (bytes.length !== expectedBytes || bytes.length > maxBytes) {
    throw new BoundedDownloadError();
  }
  return bytes;
}

export async function readBoundedResponseBytes(response, maxBytes) {
  if (!response?.ok || !validLimit(maxBytes)) throw new BoundedDownloadError();
  const declaredLength = response.headers.get("content-length");
  if (declaredLength !== null
    && (!/^\d+$/.test(declaredLength)
      || Number(declaredLength) < 1
      || Number(declaredLength) > maxBytes)) {
    throw new BoundedDownloadError();
  }
  if (!response.body) throw new BoundedDownloadError();

  const reader = response.body.getReader();
  const chunks = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new BoundedDownloadError();
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  if (totalBytes < 1) throw new BoundedDownloadError();
  return Buffer.concat(chunks, totalBytes);
}

export async function readBoundedJsonResponse(response, maxBytes) {
  const responseForBody = response.ok
    ? response
    : new Response(response.body, { status: 200, headers: response.headers });
  const bytes = await readBoundedResponseBytes(responseForBody, maxBytes);
  let payload;
  try {
    payload = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new BoundedDownloadError("download_json_invalid");
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new BoundedDownloadError("download_json_invalid");
  }
  return payload;
}
