import assert from "node:assert/strict";
import test from "node:test";
import { readJsonApiResponse } from "../shared/json-api-response.ts";

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
