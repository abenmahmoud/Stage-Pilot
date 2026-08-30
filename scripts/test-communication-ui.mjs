import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const layout = readFileSync(new URL("../src/components/AppLayout.tsx", import.meta.url), "utf8");
const page = readFileSync(new URL("../src/pages/admin/CommunicationsPage.tsx", import.meta.url), "utf8");
const flags = readFileSync(new URL("../src/lib/feature-flags.ts", import.meta.url), "utf8");

test("keeps the communication navigation behind a disabled-by-default UI flag", () => {
  assert.match(flags, /VITE_COMMUNICATIONS_ENABLED === "true"/);
  assert.match(layout, /COMMUNICATIONS_UI_ENABLED &&/);
  assert.match(layout, /to="\/admin\/communications"/);
});

test("protects the route with the existing content manager roles", () => {
  assert.match(app, /path="admin\/communications"/);
  assert.match(app, /allowedRoles=\{CONTENT_MANAGER_ROLES\}/);
});

test("shows only the deposit step as operational", () => {
  assert.match(page, /1<\/span>[\s\S]*Déposer/);
  assert.match(page, /2<\/span>[\s\S]*Vérifier[\s\S]*Verrouillé/);
  assert.match(page, /3<\/span>[\s\S]*Publier et informer[\s\S]*Verrouillé/);
  assert.match(page, /sourceType: "direct_text"/);
  assert.doesNotMatch(page, /communication-send|communication-publish|audienceRef/);
});

test("provides bounded responsive fields without recipient inputs", () => {
  assert.match(page, /maxLength=\{180\}/);
  assert.match(page, /maxLength=\{1000\}/);
  assert.match(page, /maxLength=\{100000\}/);
  assert.match(page, /sm:grid-cols-2/);
  assert.match(page, /lg:grid-cols-/);
  assert.doesNotMatch(page, /type="email"|destinataire|contactRef/iu);
});
