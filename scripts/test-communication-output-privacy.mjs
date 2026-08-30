import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const communicationsRoot = path.join(root, "api", "communications");

async function routeFiles(directory = communicationsRoot) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return routeFiles(absolute);
    return entry.isFile() && entry.name.endsWith(".ts") ? [absolute] : [];
  }));
  return files.flat().sort();
}

function relative(file) {
  return path.relative(root, file).replaceAll("\\", "/");
}

async function sources() {
  const files = await routeFiles();
  return Promise.all(files.map(async (file) => ({
    file: relative(file),
    source: await readFile(file, "utf8"),
  })));
}

test("discovers every route and keeps the current surface private", async () => {
  const routes = await sources();
  assert.equal(routes.length, 9);
  for (const { file, source } of routes) {
    assert.match(file, /^api\/communications\/admin\//);
    assert.doesNotMatch(file, /(?:send|deliver|recipient|audience|public)/i);
    assert.match(source, /await requireCommunication(?:Editor|TemplateManager|Manager|Sender)\(req\)/);
  }
});

test("imports no audience or delivery model into a browser-facing route", async () => {
  for (const { file, source } of await sources()) {
    assert.doesNotMatch(
      source,
      /communication(?:Deliveries|Audiences)|contactRef|recipientIds|recipientEmail|emailAddress|phoneNumber|destinataireEmail/,
      `${file} crosses the current recipient privacy boundary`
    );
    assert.doesNotMatch(source, /\.select\(\s*\)/, `${file} must project selected columns explicitly`);
  }
});

test("keeps private document coordinates out of every list and confirmation view", async () => {
  const list = await readFile(path.join(communicationsRoot, "admin", "documents", "index.ts"), "utf8");
  const getBranch = list.slice(0, list.indexOf('if (req.method === "POST")'));
  assert.doesNotMatch(getBranch, /storagePath|storageBucket|checksum|extractedText/);

  const confirmation = await readFile(
    path.join(communicationsRoot, "admin", "documents", "[id]", "confirm.ts"),
    "utf8"
  );
  const publicDocument = confirmation.slice(
    confirmation.indexOf("function publicDocument"),
    confirmation.indexOf("export default")
  );
  assert.doesNotMatch(publicDocument, /storagePath|storageBucket|checksum|extractedText/);
});

test("keeps the communication browser free of contact and delivery values", async () => {
  const page = await readFile(path.join(root, "src", "pages", "admin", "CommunicationsPage.tsx"), "utf8");
  assert.doesNotMatch(page, /type="email"|contactRef|recipientIds|recipientEmail|emailAddress|phoneNumber|audienceGroupRefs/);
  assert.match(page, /Aucun destinataire sélectionné/);
  assert.match(page, /Cet aperçu ne permet aucun envoi/);
});
