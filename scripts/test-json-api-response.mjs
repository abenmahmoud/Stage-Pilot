import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { readJsonApiResponse } from "../shared/json-api-response.ts";

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
