import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const layout = await readFile(new URL("../src/components/AppLayout.tsx", import.meta.url), "utf8");
const roles = await readFile(new URL("../src/lib/types.ts", import.meta.url), "utf8");
const navigation = await readFile(new URL("../src/components/ManagementNavigation.tsx", import.meta.url), "utf8");
const shell = await readFile(new URL("../src/components/PublicPortalShell.tsx", import.meta.url), "utf8");

test("keeps private school tools separate from public and stage navigation", () => {
  assert.match(navigation, /const support = \["superadmin", "administration", "agent", "proviseur"\]\.includes/);
  assert.match(navigation, /to: "\/gestion\/demandes", label: "Demandes"/);
  assert.match(navigation, /to: "\/admin\/validations-agent"/);
  assert.match(navigation, /label: "Coûts et budget IA"[^\n]+role === "superadmin"/);
  assert.match(layout, /stageWorkspace \? <>/);
  assert.match(layout, /<\/\> : <ManagementNavigation/);
  assert.doesNotMatch(layout, /to="\/prototype\?view=agent"/);
  assert.doesNotMatch(shell, /Espace agent|openAgentLogin/);
});

test("keeps the scoped agent queue as the agent landing page", () => {
  assert.match(roles, /agent: "\/gestion\/demandes"/);
});

test("keeps the shared navigation named and keyboard-managed", () => {
  assert.match(layout, /aria-label="Navigation principale"/);
  assert.match(layout, /if \(event\.key === "Escape"\)/);
  assert.match(layout, /querySelectorAll<HTMLElement>\("a\[href\], button:not\(\[disabled\]\)"\)/);
  assert.match(layout, /closeMobileMenu\("main"\)/);
});
