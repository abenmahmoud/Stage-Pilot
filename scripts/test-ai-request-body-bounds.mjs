import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const routes = [
  [
    "assistant public",
    "../api/support/assistant.ts",
    "32kb",
    "cleanMessages(input.messages)",
    "const deviceKey = await enforceAssistantRateLimits",
    "const result = await analyzeSupportConversation",
  ],
  [
    "rédaction du site",
    "../api/content/admin/assist.ts",
    "64kb",
    "parseSiteContentAiInput(req.body)",
    "await enforceSupportRateLimit",
    'fetch("https://api.openai.com/v1/responses"',
  ],
  [
    "communications",
    "../api/communications/admin/assist.ts",
    "64kb",
    "parseCommunicationAssistInput(req.body)",
    "await enforceSupportRateLimit",
    'fetch("https://api.openai.com/v1/responses"',
  ],
];

test("borne explicitement le corps HTTP des trois routes IA", () => {
  for (const [label, relativePath, limit] of routes) {
    const source = readFileSync(new URL(relativePath, import.meta.url), "utf8");
    assert.match(
      source,
      new RegExp(`bodyParser: \\{ sizeLimit: "${limit}" \\}`),
      `${label} doit conserver sa limite ${limit}`
    );
    assert.match(source, /req\.method !== "POST"/);
  }
});

test("valide et limite le débit avant chaque appel fournisseur", () => {
  for (const [label, relativePath, , validationMarker, rateMarker, providerMarker] of routes) {
    const source = readFileSync(new URL(relativePath, import.meta.url), "utf8");
    const validation = source.indexOf(validationMarker);
    const rateLimit = source.indexOf(rateMarker);
    const provider = source.indexOf(providerMarker);
    assert.notEqual(validation, -1, `${label} doit valider son entrée`);
    assert.notEqual(rateLimit, -1, `${label} doit limiter son débit`);
    assert.notEqual(provider, -1, `${label} doit identifier son appel fournisseur`);
    assert.ok(validation < provider, `${label} doit valider avant l'appel fournisseur`);
    assert.ok(rateLimit < provider, `${label} doit limiter le débit avant l'appel fournisseur`);
  }
});
