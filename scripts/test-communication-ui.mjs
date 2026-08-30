import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const layout = readFileSync(new URL("../src/components/AppLayout.tsx", import.meta.url), "utf8");
const page = readFileSync(new URL("../src/pages/admin/CommunicationsPage.tsx", import.meta.url), "utf8");
const flags = readFileSync(new URL("../src/lib/feature-flags.ts", import.meta.url), "utf8");

test("keeps the communication navigation behind a disabled-by-default UI flag", () => {
  assert.match(flags, /VITE_COMMUNICATIONS_ENABLED === "true"/);
  assert.match(flags, /VITE_COMMUNICATION_DOCUMENTS_ENABLED === "true"/);
  assert.match(flags, /COMMUNICATION_DOCUMENTS_UI_ENABLED/);
  assert.match(layout, /COMMUNICATIONS_UI_ENABLED &&/);
  assert.match(layout, /to="\/admin\/communications"/);
});

test("keeps private PDF and DOCX upload behind its own UI switch", () => {
  assert.match(page, /COMMUNICATION_DOCUMENTS_UI_ENABLED/);
  assert.match(page, /communications\/admin\/documents/);
  assert.match(page, /uploadToSignedUrl/);
  assert.match(page, /communications\/admin\/documents\/\$\{reserve\.document\.id\}\/confirm/);
  assert.match(page, /PDF ou DOCX, 10 Mo maximum/);
  assert.doesNotMatch(page, /storagePath|extractedText|checksum/);
});

test("protects the route with the existing content manager roles", () => {
  assert.match(app, /path="admin\/communications"/);
  assert.match(app, /allowedRoles=\{CONTENT_MANAGER_ROLES\}/);
});

test("opens deposit and human review while keeping publication locked", () => {
  assert.match(page, /1<\/span>[\s\S]*Déposer/);
  assert.match(page, /2<\/span>[\s\S]*Vérifier[\s\S]*Relecture humaine/);
  assert.match(page, /3<\/span>[\s\S]*Publier et informer[\s\S]*Verrouillé/);
  assert.match(page, /sourceType: "direct_text"/);
  assert.match(page, /communications\/admin\/\$\{selectedDetail\.id\}\/review/);
  assert.match(page, /confirmation: "VERIFIER"/);
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

test("uses governed templates without opening publication or sending", () => {
  assert.match(page, /communications\/admin\/templates/);
  assert.match(page, /applyTemplate/);
  assert.match(page, /user\?\.role === "superadmin" \|\| user\?\.role === "proviseur"/);
  assert.match(page, /method: "PATCH"/);
  assert.match(page, /templateKey: editingTemplate\.templateKey/);
  assert.doesNotMatch(page, /COMMUNICATION_PUBLICATION_ENABLED|COMMUNICATION_SEND_ENABLED/);
});

test("shows bounded AI facts and keeps every uncertainty under human control", () => {
  assert.match(page, /communications\/admin\/assist/);
  assert.match(page, /Structurer/);
  assert.match(page, /Informations à confirmer/);
  assert.match(page, /removeFact/);
  assert.match(page, /Marquer comme vérifié/);
  assert.match(page, /selectedDetail\.openQuestions\.length > 0/);
});
