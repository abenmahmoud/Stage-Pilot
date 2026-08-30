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

test("opens deposit and human review while keeping publication separately gated", () => {
  assert.match(page, /1<\/span>[\s\S]*Déposer/);
  assert.match(page, /2<\/span>[\s\S]*Vérifier[\s\S]*Relecture humaine/);
  assert.match(page, /3<\/span>[\s\S]*Publier et informer[\s\S]*COMMUNICATION_PUBLICATION_UI_ENABLED/);
  assert.match(page, /sourceType: "direct_text"/);
  assert.match(page, /communications\/admin\/\$\{selectedDetail\.id\}\/review/);
  assert.match(page, /confirmation: "VERIFIER"/);
  assert.match(page, /communications\/admin\/\$\{selectedDetail\.id\}\/publish/);
  assert.doesNotMatch(page, /communication-send|audienceRef/);
});

test("provides bounded responsive fields without recipient inputs", () => {
  assert.match(page, /maxLength=\{180\}/);
  assert.match(page, /maxLength=\{1000\}/);
  assert.match(page, /maxLength=\{100000\}/);
  assert.match(page, /sm:grid-cols-2/);
  assert.match(page, /lg:grid-cols-/);
  assert.doesNotMatch(page, /type="email"|recipientIds|contactRef|audienceRef/iu);
});

test("uses governed templates without opening direct sending", () => {
  assert.match(page, /communications\/admin\/templates/);
  assert.match(page, /applyTemplate/);
  assert.match(page, /user\?\.role === "superadmin" \|\| user\?\.role === "proviseur"/);
  assert.match(page, /method: "PATCH"/);
  assert.match(page, /templateKey: editingTemplate\.templateKey/);
  assert.doesNotMatch(page, /COMMUNICATION_SEND_ENABLED/);
});

test("shows bounded AI facts and keeps every uncertainty under human control", () => {
  assert.match(page, /communications\/admin\/assist/);
  assert.match(page, /Structurer/);
  assert.match(page, /Informations à confirmer/);
  assert.match(page, /removeFact/);
  assert.match(page, /Marquer comme vérifié/);
  assert.match(page, /selectedDetail\.openQuestions\.length > 0/);
});

test("supports private metadata search, status filters and bounded version history", () => {
  assert.match(page, /const filteredRows = useMemo/);
  assert.match(page, /row\.title, row\.summary, row\.category/);
  assert.match(page, /type="search"/);
  assert.match(page, /value="review">À vérifier/);
  assert.match(page, /Historique des versions/);
  assert.match(page, /payload\.versions/);
  assert.match(page, /selectedVersions\.map/);
  assert.doesNotMatch(page, /bodyMarkdown.*toLocaleLowerCase/);
});

test("renders a safe local preview without opening delivery", () => {
  assert.match(page, /ReactMarkdown/);
  assert.match(page, /remarkPlugins=\{\[remarkGfm\]\}/);
  assert.match(page, /composerMode === "page"/);
  assert.match(page, /composerMode === "email"/);
  assert.match(page, /Écrire/);
  assert.match(page, /Aperçu de la page · aucun destinataire sélectionné/);
  assert.match(page, /Aperçu email/);
  assert.match(page, /Aucun destinataire sélectionné/);
  assert.match(page, /Pré-en-tête/);
  assert.match(page, /Le lien officiel sera ajouté après publication/);
  assert.match(page, /safeCommunicationPreviewHref/);
  assert.match(page, /rel="noreferrer noopener"/);
  assert.match(page, /Image non affichée/);
  assert.doesNotMatch(page, /communication-send|COMMUNICATION_SEND_ENABLED|audienceRef/);
});
