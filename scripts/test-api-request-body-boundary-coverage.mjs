import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const apiRoot = join(projectRoot, "api");

function listTypeScriptFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = join(directory, entry.name);
    if (entry.isDirectory()) return listTypeScriptFiles(absolutePath);
    return entry.isFile() && entry.name.endsWith(".ts") ? [absolutePath] : [];
  });
}

test("chaque route qui lit req.body conserve une limite HTTP explicite", () => {
  const bodyReaders = listTypeScriptFiles(apiRoot)
    .map((absolutePath) => ({
      absolutePath,
      source: readFileSync(absolutePath, "utf8"),
    }))
    .filter(({ source }) => /\breq\.body\b/.test(source));

  assert.ok(bodyReaders.length > 0, "aucune route req.body détectée : inventaire probablement cassé");

  const violations = bodyReaders.flatMap(({ absolutePath, source }) => {
    const route = relative(projectRoot, absolutePath).replaceAll("\\", "/");
    const reasons = [];
    if (!/export\s+const\s+config\s*=/.test(source)) {
      reasons.push("config Vercel absente");
    }
    if (!/bodyParser\s*:\s*\{\s*sizeLimit\s*:\s*["'][^"']+["']\s*\}/s.test(source)) {
      reasons.push("sizeLimit explicite absent");
    }
    if (/bodyParser\s*:\s*false/.test(source)) {
      reasons.push("req.body incompatible avec bodyParser: false");
    }
    return reasons.map((reason) => `${route}: ${reason}`);
  });

  assert.deepEqual(violations, []);
});

test("chaque commande sans payload désactive le parseur HTTP", () => {
  const mutationWithoutBody = listTypeScriptFiles(apiRoot)
    .map((absolutePath) => ({
      absolutePath,
      source: readFileSync(absolutePath, "utf8"),
    }))
    .filter(({ source }) => /export\s+default\s+async\s+function\s+handler/.test(source))
    .filter(({ source }) => /req\.method[\s\S]{0,180}["'](?:POST|PUT|PATCH|DELETE)["']/.test(source))
    .filter(({ source }) => !/\breq\.body\b/.test(source));

  assert.ok(
    mutationWithoutBody.length > 0,
    "aucune commande sans payload détectée : inventaire probablement cassé"
  );

  const violations = mutationWithoutBody
    .filter(({ source }) => !/bodyParser\s*:\s*false/.test(source))
    .map(({ absolutePath }) =>
      `${relative(projectRoot, absolutePath).replaceAll("\\", "/")}: bodyParser: false absent`
    );

  assert.deepEqual(violations, []);
});
