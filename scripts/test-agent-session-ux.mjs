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

test("opens the verified request form after explicit assistant consent", () => {
  assert.match(source, /resolveAssistantConversationTransition\(nextMessages\)/);
  assert.match(source, /transition\.stage === "action_confirmed"/);
  assert.match(source, /result\.action === "offer_case"/);
  assert.match(source, /result\.readyToCreate/);
  assert.match(source, /setShowDetails\(true\)/);
  assert.match(source, /caseFormRef\.current\?\.scrollIntoView/);
});
