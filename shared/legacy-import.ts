export const LEGACY_IMPORT_MAX_FILE_SIZE = 10 * 1024 * 1024;

function normalizedMimeType(value: string | null | undefined): string {
  return String(value ?? "").split(";", 1)[0].trim().toLowerCase();
}

export function assertLegacyMediaType(expected: string, received: string | null): void {
  const expectedType = normalizedMimeType(expected);
  const receivedType = normalizedMimeType(received);
  if (!receivedType) return;
  if (receivedType !== expectedType) {
    throw new Error(`Type de fichier inattendu (${receivedType})`);
  }
}

export async function readLimitedResponseBytes(
  response: Response,
  maximum = LEGACY_IMPORT_MAX_FILE_SIZE
): Promise<Buffer> {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maximum) {
    throw new Error(`Taille refusée (${declaredLength} octets)`);
  }
  if (!response.body) throw new Error("Fichier source vide");

  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let received = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      received += chunk.value.byteLength;
      if (received > maximum) {
        await reader.cancel();
        throw new Error(`Taille refusée (plus de ${maximum} octets)`);
      }
      chunks.push(Buffer.from(chunk.value));
    }
  } finally {
    reader.releaseLock();
  }
  if (!received) throw new Error("Fichier source vide");
  return Buffer.concat(chunks, received);
}

export function isPostgresUniqueViolation(error: unknown): boolean {
  let current = error;
  for (let depth = 0; depth < 5; depth += 1) {
    if (!current || typeof current !== "object") return false;
    const record = current as Record<string, unknown>;
    if (record.code === "23505") return true;
    current = record.cause;
  }
  return false;
}
