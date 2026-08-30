const BOUNDED_BLOB_HARD_MAX_BYTES = 50 * 1024 * 1024;

type BlobLike = Pick<Blob, "size" | "arrayBuffer">;

function validByteCount(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 1;
}

export async function readBoundedBlobBytes(
  blob: BlobLike,
  expectedBytes: number,
  maxBytes: number
): Promise<Uint8Array> {
  if (!blob
    || typeof blob.arrayBuffer !== "function"
    || !validByteCount(expectedBytes)
    || !validByteCount(maxBytes)
    || maxBytes > BOUNDED_BLOB_HARD_MAX_BYTES
    || expectedBytes > maxBytes
    || !validByteCount(blob.size)
    || blob.size !== expectedBytes) {
    throw new Error("bounded_blob_invalid");
  }

  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (bytes.byteLength !== expectedBytes || bytes.byteLength > maxBytes) {
    throw new Error("bounded_blob_invalid");
  }
  return bytes;
}
