import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const source = await readFile(
  new URL("../src/pages/prototype/LyceeConnectPrototype.tsx", import.meta.url),
  "utf8"
);

test("refreshes the staff session before loading the agent queue", () => {
  assert.match(source, /supabase\.auth\.refreshSession\(\)/);
  assert.match(source, /if \(!sessionReady\) return;/);
  assert.match(source, /serviceFilter, sessionReady/);
});
