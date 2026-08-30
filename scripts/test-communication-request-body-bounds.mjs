import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const routes = [
  ["création", "../api/communications/admin/index.ts", "512kb", "requireCommunicationEditor"],
  ["modification", "../api/communications/admin/[id]/index.ts", "512kb", "requireCommunicationEditor"],
  ["modèle", "../api/communications/admin/templates.ts", "128kb", "requireCommunicationTemplateManager"],
  ["vérification", "../api/communications/admin/[id]/review.ts", "4kb", "requireCommunicationEditor"],
  ["validation", "../api/communications/admin/[id]/approve.ts", "4kb", "requireCommunicationManager"],
  ["publication", "../api/communications/admin/[id]/publish.ts", "4kb", "requireCommunicationPublisher"],
  ["document", "../api/communications/admin/documents/index.ts", "4kb", "requireCommunicationEditor"],
];

test("borne les mutations du centre de communications", () => {
  for (const [label, relativePath, limit, authorization] of routes) {
    const source = readFileSync(new URL(relativePath, import.meta.url), "utf8");
    assert.match(
      source,
      new RegExp(`bodyParser: \\{ sizeLimit: "${limit}" \\}`),
      `${label} doit conserver sa limite ${limit}`
    );
    assert.match(source, new RegExp(`${authorization}\\(req\\)`));
  }
});

test("conserve les limites métier avant la persistance", () => {
  const draft = readFileSync(new URL("../shared/communication-draft.ts", import.meta.url), "utf8");
  const templates = readFileSync(
    new URL("../shared/communication-templates.ts", import.meta.url),
    "utf8"
  );
  assert.match(draft, /bodyMarkdown: boundedText\(input\.bodyMarkdown, "body", 1, 100000\)/);
  assert.match(templates, /bodyMarkdown: boundedText\(input\.bodyMarkdown, "body", 1, 20000\)/);
});

test("le document source reste envoyé directement au stockage privé", () => {
  const source = readFileSync(
    new URL("../api/communications/admin/documents/index.ts", import.meta.url),
    "utf8"
  );
  assert.match(source, /createSignedUploadUrl\(storagePath\)/);
  assert.doesNotMatch(source, /Buffer\.from\(/);
});
