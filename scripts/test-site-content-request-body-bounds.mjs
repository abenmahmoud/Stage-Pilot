import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const boundedRoutes = [
  ["création", "../api/content/admin/index.ts", "256kb", "requireSiteEditor"],
  ["modification", "../api/content/admin/[id].ts", "256kb", "requireSiteEditor"],
  ["modèle", "../api/content/admin/templates.ts", "256kb", "requireSitePublisher"],
  ["action", "../api/content/admin/[id]/action.ts", "8kb", "requireSite"],
  ["média", "../api/content/admin/assets.ts", "4kb", "requireSiteEditor"],
  ["reprise", "../api/content/admin/legacy-import.ts", "4kb", "requireSiteEditor"],
  ["atelier hebdo", "../api/content/admin/weekly-assist.ts", "128kb", "requireSiteEditor"],
];

test("borne les mutations de gestion du contenu", () => {
  for (const [label, relativePath, limit, authorization] of boundedRoutes) {
    const source = readFileSync(new URL(relativePath, import.meta.url), "utf8");
    assert.match(
      source,
      new RegExp(`bodyParser: \\{ sizeLimit: "${limit}" \\}`),
      `${label} doit conserver sa limite ${limit}`
    );
    assert.match(source, new RegExp(`${authorization}`));
  }
});

test("la confirmation de média sans payload ne lit aucun corps", () => {
  const source = readFileSync(
    new URL("../api/content/admin/assets/[id]/confirm.ts", import.meta.url),
    "utf8"
  );
  assert.match(source, /bodyParser: false/);
  assert.doesNotMatch(source, /req\.body/);
  assert.match(source, /requireSiteEditor\(req\)/);
});

test("le média reste envoyé directement au stockage privé", () => {
  const source = readFileSync(new URL("../api/content/admin/assets.ts", import.meta.url), "utf8");
  assert.match(source, /createSignedUploadUrl\(storagePath\)/);
  assert.doesNotMatch(source, /Buffer\.from\(/);
});

test("conserve les limites métier des contenus et modèles", () => {
  const source = readFileSync(new URL("../shared/site-content.ts", import.meta.url), "utf8");
  assert.match(source, /bodyMarkdown: textValue\(input\.bodyMarkdown \?\? "", "Contenu", 30000, false\)/);
  assert.match(source, /defaultBodyMarkdown: textValue\(input\.defaultBodyMarkdown \?\? "", "Contenu proposé", 30000, false\)/);
});
