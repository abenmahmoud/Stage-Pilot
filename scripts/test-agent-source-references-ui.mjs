import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(
  new URL("../src/pages/prototype/LyceeConnectPrototype.tsx", import.meta.url),
  "utf8"
);
const styles = readFileSync(
  new URL("../src/pages/prototype/lycee-connect.css", import.meta.url),
  "utf8"
);
const agent = readFileSync(
  new URL("../api/_shared/support-agent.ts", import.meta.url),
  "utf8"
);

test("shows only human-readable dated references below the corresponding answer", () => {
  assert.match(page, /message\.sourceReferences\?\.length/);
  assert.match(page, /Sources utilisées/);
  assert.match(page, /Mis à jour le/);
  assert.match(page, /source\.title/);
  assert.doesNotMatch(page, /source\.sourceId/);
  assert.match(styles, /\.lycee-agent-sources/);
});

test("keeps source metadata under server control", () => {
  const schema = agent.slice(
    agent.indexOf("const RESULT_SCHEMA"),
    agent.indexOf("const INSTRUCTIONS")
  );
  assert.doesNotMatch(schema, /sourceReferences/);
  assert.match(agent, /const sourceReferences = \[\.\.\.new Map\(/);
  assert.match(agent, /sourceReferences,\s*\n\s*\};/);
  assert.match(agent, /sourceId \}\) => \(\{/);
});
