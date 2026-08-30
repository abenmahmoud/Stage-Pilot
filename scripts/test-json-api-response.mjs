import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { readJsonApiResponse } from "../shared/json-api-response.ts";
import {
  isAllowedExternalApiFileUrl,
  readApiPdfResponse,
} from "../shared/api-file-response.ts";

const apiClient = readFileSync(new URL("../src/lib/api.ts", import.meta.url), "utf8");

test("retourne un objet JSON valide", async () => {
  const payload = await readJsonApiResponse(new Response(JSON.stringify({ ok: true }), {
    headers: { "content-type": "application/json" },
  }));
  assert.deepEqual(payload, { ok: true });
});

test("conserve une erreur API française bornée", async () => {
  await assert.rejects(
    () => readJsonApiResponse(new Response(JSON.stringify({ error: "Accès expiré" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    })),
    /Accès expiré/u
  );
});

test("masque le HTML, les réponses primitives et les erreurs démesurées", async () => {
  await assert.rejects(
    () => readJsonApiResponse(new Response("<!doctype html><h1>Internal trace</h1>", { status: 502 })),
    /^Error: Le service ne répond pas pour le moment\.$/u
  );
  await assert.rejects(
    () => readJsonApiResponse(new Response("true", { status: 200 })),
    /réponse du service est invalide/u
  );
  await assert.rejects(
    () => readJsonApiResponse(new Response(JSON.stringify({ error: "x".repeat(501) }), { status: 500 })),
    /^Error: Le service ne répond pas pour le moment\.$/u
  );
});

test("refuse une taille annoncée supérieure au plafond avant lecture", async () => {
  await assert.rejects(
    () => readJsonApiResponse(new Response(JSON.stringify({ ok: true }), {
      headers: {
        "content-type": "application/json",
        "content-length": "65",
      },
    }), { maxBytes: 64 }),
    /réponse du service est invalide/u
  );
});

test("interrompt un flux sans taille annoncée dès le dépassement", async () => {
  let cancelled = false;
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('{"part":"' + "a".repeat(40)));
      controller.enqueue(new TextEncoder().encode("b".repeat(40) + '"}'));
    },
    cancel() {
      cancelled = true;
    },
  });
  await assert.rejects(
    () => readJsonApiResponse(new Response(body, {
      headers: { "content-type": "application/json" },
    }), { maxBytes: 64 }),
    /réponse du service est invalide/u
  );
  assert.equal(cancelled, true);
});

test("accepte un plafond explicite valide", async () => {
  const payload = await readJsonApiResponse(new Response(JSON.stringify({ ok: true }), {
    headers: { "content-type": "application/json" },
  }), { maxBytes: 128 });
  assert.deepEqual(payload, { ok: true });
});

test("route les succès et erreurs JSON du client privé vers le lecteur borné", () => {
  const apiFetchSource = apiClient.slice(
    apiClient.indexOf("export async function apiFetch"),
    apiClient.indexOf("export async function openApiFile")
  );
  assert.equal(apiFetchSource.match(/readJsonApiResponse<T>\(res\)/g)?.length, 2);
  assert.doesNotMatch(apiFetchSource, /res\.json\(\)/);
  assert.match(apiFetchSource, /if \(!contentType\.includes\("application\/json"\)\)/);
});

test("accepte uniquement les URL de document sur les origines HTTPS approuvées", () => {
  const app = "https://gestion.example.fr";
  const storage = "https://school-project.supabase.co";
  assert.equal(isAllowedExternalApiFileUrl(`${app}/api/document.pdf`, app, storage), true);
  assert.equal(isAllowedExternalApiFileUrl(`${storage}/storage/v1/object/sign/private/file.pdf?token=signed`, app, storage), true);
  assert.equal(isAllowedExternalApiFileUrl("https://evil.example/document.pdf", app, storage), false);
  assert.equal(isAllowedExternalApiFileUrl("http://gestion.example.fr/document.pdf", app, storage), false);
  assert.equal(isAllowedExternalApiFileUrl("https://user@gestion.example.fr/document.pdf", app, storage), false);
  assert.equal(isAllowedExternalApiFileUrl(`${app}/document.pdf#secret`, app, storage), false);
});

test("lit un PDF authentifié borné avec une signature valide", async () => {
  const bytes = new TextEncoder().encode("%PDF-1.7\n%%EOF");
  const blob = await readApiPdfResponse(new Response(bytes, {
    headers: { "content-type": "application/pdf", "content-length": String(bytes.length) },
  }), 128);
  assert.equal(blob.type, "application/pdf");
  assert.equal(blob.size, bytes.length);
});

test("refuse le mauvais type, la fausse signature et la taille annoncée", async () => {
  await assert.rejects(
    () => readApiPdfResponse(new Response("%PDF-1.7", { headers: { "content-type": "text/html" } }), 128),
    /document reçu est invalide/u
  );
  await assert.rejects(
    () => readApiPdfResponse(new Response("not-a-pdf", { headers: { "content-type": "application/pdf" } }), 128),
    /document reçu est invalide/u
  );
  await assert.rejects(
    () => readApiPdfResponse(new Response("%PDF-1.7", {
      headers: { "content-type": "application/pdf", "content-length": "129" },
    }), 128),
    /document reçu est invalide/u
  );
});

test("interrompt un flux PDF sans taille annoncée au dépassement", async () => {
  let cancelled = false;
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode("%PDF-" + "a".repeat(40)));
      controller.enqueue(new TextEncoder().encode("b".repeat(40)));
    },
    cancel() {
      cancelled = true;
    },
  });
  await assert.rejects(
    () => readApiPdfResponse(new Response(body, { headers: { "content-type": "application/pdf" } }), 64),
    /document reçu est invalide/u
  );
  assert.equal(cancelled, true);
});

test("sécurise l'ouverture des fichiers dans le client authentifié", () => {
  const fileSource = apiClient.slice(apiClient.indexOf("export async function openApiFile"));
  assert.doesNotMatch(fileSource, /res\.json\(\)|res\.blob\(\)/);
  assert.match(fileSource, /readJsonApiResponse<Record<string, unknown>>\(res\)/);
  assert.match(fileSource, /readApiPdfResponse\(res\)/);
  assert.match(fileSource, /isAllowedExternalApiFileUrl/);
  assert.match(fileSource, /popup\.opener = null/g);
  assert.match(fileSource, /noopener,noreferrer/);
});
