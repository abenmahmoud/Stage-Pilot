const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46];
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];
const ZIP_SIGNATURES = [
  [0x50, 0x4b, 0x03, 0x04],
  [0x50, 0x4b, 0x05, 0x06],
  [0x50, 0x4b, 0x07, 0x08],
] as const;

function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  return signature.every((byte, index) => bytes[index] === byte);
}

function containsAscii(bytes: Uint8Array, value: string): boolean {
  const pattern = new TextEncoder().encode(value);
  if (pattern.length === 0 || pattern.length > bytes.length) return false;
  for (let offset = 0; offset <= bytes.length - pattern.length; offset += 1) {
    let matches = true;
    for (let index = 0; index < pattern.length; index += 1) {
      if (bytes[offset + index] !== pattern[index]) {
        matches = false;
        break;
      }
    }
    if (matches) return true;
  }
  return false;
}

function isZip(bytes: Uint8Array): boolean {
  return ZIP_SIGNATURES.some((signature) => startsWith(bytes, signature));
}

export function matchesSiteContentFileSignature(
  bytes: Uint8Array,
  declaredMime: string
): boolean {
  if (bytes.length < 4) return false;

  if (declaredMime === "application/pdf") return startsWith(bytes, PDF_SIGNATURE);
  if (declaredMime === "image/png") return startsWith(bytes, PNG_SIGNATURE);
  if (declaredMime === "image/jpeg") return startsWith(bytes, JPEG_SIGNATURE);
  if (declaredMime === "image/webp") {
    return containsAscii(bytes.subarray(0, 4), "RIFF")
      && containsAscii(bytes.subarray(8, 12), "WEBP");
  }
  if (!isZip(bytes) || !containsAscii(bytes, "[Content_Types].xml")) return false;
  if (declaredMime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    return containsAscii(bytes, "word/");
  }
  if (declaredMime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
    return containsAscii(bytes, "xl/");
  }
  return false;
}
