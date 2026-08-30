import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  AI_PROVIDER_RESPONSE_MAX_BYTES,
  readAiProviderJsonResponse,
} from "../shared/ai-provider-response.ts";

const consumers = [
  "../api/_shared/support-agent.ts",
  "../api/_shared/support-translation.ts",
  "../api/content/admin/assist.ts",
  "../api/communications/admin/assist.ts",
];

test("borne toutes les réponses des quatre parcours IA", () => {
  for (const file of consumers) {
    const source = readFileSync(new URL(file, import.meta.url), "utf8");
    assert.match(source, /readAiProviderJsonResponse/);
    assert.doesNotMatch(source, /response\.json\(\)/);
  }
});

test("accepte une petite réponse structurée du fournisseur", async () => {
  const payload = await readAiProviderJsonResponse(new Response(JSON.stringify({
    output: [{ content: [{ type: "output_text", text: "{}" }] }],
  }), { headers: { "content-type": "application/json" } }));
  assert.equal(typeof payload, "object");
});

test("refuse une taille fournisseur annoncée au-dessus de deux mégaoctets", async () => {
  await assert.rejects(
    () => readAiProviderJsonResponse(new Response("{}", {
      headers: {
        "content-type": "application/json",
        "content-length": String(AI_PROVIDER_RESPONSE_MAX_BYTES + 1),
      },
    })),
    /réponse du service est invalide/u
  );
});

test("annule un flux fournisseur dès son dépassement réel", async () => {
  let cancelled = false;
  const chunk = new Uint8Array(1024 * 1024 + 1).fill(0x61);
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('{"value":"'));
      controller.enqueue(chunk);
      controller.enqueue(chunk);
    },
    cancel() {
      cancelled = true;
    },
  });
  await assert.rejects(
    () => readAiProviderJsonResponse(new Response(body, {
      headers: { "content-type": "application/json" },
    })),
    /réponse du service est invalide/u
  );
  assert.equal(cancelled, true);
});
