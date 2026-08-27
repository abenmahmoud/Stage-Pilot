import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const editorSource = await readFile(new URL("../src/pages/admin/ContentManagerPage.tsx", import.meta.url), "utf8");
const prototypeSource = await readFile(new URL("../src/pages/prototype/LyceeConnectPrototype.tsx", import.meta.url), "utf8");

test("warns before an unfinished editorial draft is lost", () => {
  assert.match(editorSource, /beforeunload/);
  assert.match(editorSource, /Des modifications ne sont pas enregistrées/);
  assert.match(editorSource, /Modifications non enregistrées/);
});

test("gives icon-only editor controls accessible names", () => {
  assert.match(editorSource, /function Tool[\s\S]*aria-label=\{title\}/);
  assert.match(editorSource, /function ModeButton[\s\S]*aria-label=\{title\}/);
  assert.match(editorSource, /aria-pressed=\{active\}/);
});

test("keeps public wording simple and removes the inactive notification control", () => {
  assert.doesNotMatch(prototypeSource, /analyse IA|analyse locale/);
  assert.doesNotMatch(prototypeSource, /aria-label="Notifications"/);
  assert.match(prototypeSource, /Langue de la réponse du lycée/);
});
