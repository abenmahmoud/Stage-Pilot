import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import test from "node:test";
process.env.NEXT_PUBLIC_SUPABASE_URL ||= "http://127.0.0.1:54321";
process.env.SUPABASE_SERVICE_ROLE_KEY ||= "fictitious-service-role-key";
const {
  depotIngressType,
  requireDepotBearer,
} = await import("../api/_shared/depot-ingress.ts");
const { readDepotMultipart } = await import("../api/_shared/depot-multipart.ts");

const token = "jeton-fictif-reserve-au-test";

test("authentifie le dépôt par empreinte sans renvoyer le jeton", () => {
  const previous = process.env.LYCEEGEST_DEPOT_TOKEN_SHA256;
  process.env.LYCEEGEST_DEPOT_TOKEN_SHA256 = createHash("sha256").update(token).digest("hex");
  try {
    const request = { headers: { authorization: `Bearer ${token}` }, query: { type: "annuaire" } };
    assert.doesNotThrow(() => requireDepotBearer(request));
    assert.equal(depotIngressType(request), "annuaire");
    assert.throws(
      () => requireDepotBearer({ ...request, headers: { authorization: "Bearer incorrect" } }),
      (error) => error.status === 401 && !error.message.includes("incorrect")
    );
  } finally {
    if (previous === undefined) delete process.env.LYCEEGEST_DEPOT_TOKEN_SHA256;
    else process.env.LYCEEGEST_DEPOT_TOKEN_SHA256 = previous;
  }
});

function multipartRequest(parts) {
  const boundary = "----lyceegest-fictif-boundary";
  const chunks = [];
  for (const part of parts) {
    chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${part.name}"${part.fileName ? `; filename="${part.fileName}"` : ""}\r\n${part.mimeType ? `Content-Type: ${part.mimeType}\r\n` : ""}\r\n`));
    chunks.push(Buffer.isBuffer(part.value) ? part.value : Buffer.from(part.value));
    chunks.push(Buffer.from("\r\n"));
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  const request = Readable.from(Buffer.concat(chunks));
  request.headers = { "content-type": `multipart/form-data; boundary=${boundary}` };
  return request;
}

test("lit uniquement les deux fichiers et les métadonnées prévues", async () => {
  const payload = await readDepotMultipart(multipartRequest([
    { name: "fichier", fileName: "annuaire_import.csv", mimeType: "text/csv", value: "a,b\n1,2" },
    { name: "rapport", fileName: "rapport_verification.txt", mimeType: "text/plain", value: "rapport fictif" },
    { name: "titre", value: "Version fictive" },
  ]));
  assert.equal(payload.files.fichier.fileName, "annuaire_import.csv");
  assert.equal(payload.files.rapport.bytes.toString("utf8"), "rapport fictif");
  assert.equal(payload.fields.titre, "Version fictive");
});

test("refuse un champ multipart supplémentaire", async () => {
  await assert.rejects(
    readDepotMultipart(multipartRequest([
      { name: "fichier", fileName: "annuaire_import.csv", mimeType: "text/csv", value: "a,b" },
      { name: "champ_interdit", value: "fictif" },
    ])),
    (error) => error.status === 400 && !error.message.includes("fictif")
  );
});
