import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { runEdtSync } from "./sync-edt-client.mjs";

const TOKEN = "jeton-fictif-de-synchronisation-edt-assez-long";

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return Buffer.concat(chunks);
}

test("synchronise une nouvelle version, mémorise son empreinte et ignore le fichier inchangé", async () => {
  const directory = await mkdtemp(join(tmpdir(), "lyceegest-edt-sync-"));
  const filePath = join(directory, "classes.csv");
  const configPath = join(directory, "config.json");
  const statePath = join(directory, "state.json");
  const bytes = Buffer.from(
    "classe,matiere,date,debut,fin\n2A,Maths,2026-09-08,08:00,09:00\n",
    "utf8"
  );
  await writeFile(filePath, bytes);
  const old = new Date(Date.now() - 120_000);
  await utimes(filePath, old, old);

  const importId = randomUUID();
  const received = { reservations: 0, uploads: 0, confirmations: 0, body: null, uploaded: null };
  const server = createServer(async (request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");
    if (request.method === "POST" && url.pathname === "/api/depot/edt") {
      const body = JSON.parse((await readBody(request)).toString("utf8"));
      assert.equal(request.headers.authorization, `Bearer ${TOKEN}`);
      if (body.mode === "reserve") {
        received.reservations += 1;
        received.body = body;
        response.writeHead(201, { "content-type": "application/json" });
        response.end(JSON.stringify({
          ok: true,
          type: "edt",
          importId,
          status: "reserved",
          duplicate: false,
          upload: {
            bucket: "schedule-ingest",
            path: `${randomUUID()}/2026-2027/classes/${randomUUID()}/${randomUUID()}.csv`,
            token: "signed-upload-token-fictif",
            signedUrl: `http://127.0.0.1:${server.address().port}/storage/v1/object/upload/sign/schedule-ingest/fictif.csv?token=signed-upload-token-fictif`,
          },
        }));
        return;
      }
      received.confirmations += 1;
      assert.deepEqual(body, { mode: "confirm", importId });
      response.writeHead(202, { "content-type": "application/json" });
      response.end(JSON.stringify({ ok: true, type: "edt", importId, status: "quarantined", duplicate: false }));
      return;
    }
    if (request.method === "PUT" && url.pathname.startsWith("/storage/v1/object/upload/sign/schedule-ingest/")) {
      received.uploads += 1;
      received.uploaded = await readBody(request);
      assert.equal(request.headers["content-type"], "text/csv");
      assert.equal(request.headers["x-upsert"], "false");
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ Key: "schedule-ingest/fictif.csv" }));
      return;
    }
    response.writeHead(404).end();
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  try {
    await writeFile(configPath, JSON.stringify({
      endpoint: `http://127.0.0.1:${server.address().port}/api/depot/edt`,
      allowHttpLocalhost: true,
      minimumAgeSeconds: 30,
      freshDays: 2,
      statePath,
      sources: [{ path: filePath, sourceKind: "classes", title: "EDT classes fictif" }],
    }));
    const first = await runEdtSync({ configPath, token: TOKEN, now: new Date("2026-09-08T12:00:00.000Z") });
    assert.equal(first.status, "complete");
    assert.equal(first.results[0].status, "synchronized");
    assert.equal(received.reservations, 1);
    assert.equal(received.uploads, 1);
    assert.equal(received.confirmations, 1);
    assert.deepEqual(received.uploaded, bytes);
    assert.equal(received.body.sourceFormat, "tabular_import");
    assert.equal(received.body.mimeType, "text/csv");
    assert.equal(received.body.checksum, createHash("sha256").update(bytes).digest("hex"));

    const stateText = await readFile(statePath, "utf8");
    assert.doesNotMatch(stateText, new RegExp(TOKEN));
    assert.doesNotMatch(stateText, /signed-upload-token/u);
    const second = await runEdtSync({ configPath, token: TOKEN });
    assert.equal(second.results[0].status, "unchanged");
    assert.equal(received.reservations, 1);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  }
});

test("refuse une URL d'envoi signée qui sort de Supabase", async () => {
  const directory = await mkdtemp(join(tmpdir(), "lyceegest-edt-sync-url-"));
  const filePath = join(directory, "classes.pdf");
  const configPath = join(directory, "config.json");
  await writeFile(filePath, Buffer.from("%PDF-1.4\n%%EOF", "utf8"));
  const old = new Date(Date.now() - 120_000);
  await utimes(filePath, old, old);
  const server = createServer(async (request, response) => {
    await readBody(request);
    response.writeHead(201, { "content-type": "application/json" });
    response.end(JSON.stringify({
      ok: true,
      type: "edt",
      importId: randomUUID(),
      status: "reserved",
      duplicate: false,
      upload: {
        bucket: "schedule-ingest",
        path: "fictif.pdf",
        token: "signed-upload-token-fictif",
        signedUrl: "https://example.test/storage/v1/object/upload/sign/schedule-ingest/fictif.pdf?token=exfiltration",
      },
    }));
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  try {
    await writeFile(configPath, JSON.stringify({
      endpoint: `http://127.0.0.1:${server.address().port}/api/depot/edt`,
      allowHttpLocalhost: true,
      minimumAgeSeconds: 30,
      sources: [{ path: filePath, sourceKind: "classes", title: "EDT classes fictif" }],
    }));
    await assert.rejects(
      runEdtSync({ configPath, token: TOKEN }),
      (error) => error.code === "invalid_signed_upload_url"
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  }
});

test("signale un export absent sans créer de demande", async () => {
  const directory = await mkdtemp(join(tmpdir(), "lyceegest-edt-sync-missing-"));
  const configPath = join(directory, "config.json");
  try {
    await writeFile(configPath, JSON.stringify({
      endpoint: "http://127.0.0.1:9/api/depot/edt",
      allowHttpLocalhost: true,
      minimumAgeSeconds: 30,
      sources: [{ path: join(directory, "absent.xlsx"), sourceKind: "classes", title: "EDT classes fictif" }],
    }));
    const result = await runEdtSync({ configPath, token: TOKEN });
    assert.deepEqual(result.results, [{ sourceKind: "classes", status: "skipped", reason: "file_missing" }]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
