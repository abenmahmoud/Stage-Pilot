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

test("opens contact collection as soon as the assistant request is actionable", () => {
  assert.match(source, /const shouldCollectContact =/);
  assert.match(source, /result\.action === "offer_case"/);
  assert.match(source, /result\.readyToCreate/);
  assert.match(source, /setShowDetails\(true\)/);
  assert.match(source, /caseFormRef\.current\?\.scrollIntoView/);
  assert.match(source, /!conversationStopped && !\(canCreateRequest && showDetails\)/);
});

test("asks for an identity and at least one reply channel without forcing both", () => {
  assert.match(source, /Votre prénom/);
  assert.match(source, /Votre nom/);
  assert.match(source, /Email ou téléphone obligatoire\. Ajoutez les deux si possible\./);
  assert.match(source, /Si ce contact est incorrect ou inaccessible, la réponse pourra arriver plus tard\./);
  assert.match(source, /Vous pouvez choisir l’un des deux sans fournir les deux\./);
  assert.match(source, /if \(!email && !phone\)/);
});
