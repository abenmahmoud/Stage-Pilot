import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";

const apiUrl = new URL("../api/", import.meta.url);

async function findRouteFiles(directoryUrl, relative = "") {
  const entries = await readdir(directoryUrl, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name.startsWith("_")) continue;
    const childRelative = relative ? `${relative}/${entry.name}` : entry.name;
    const childUrl = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, directoryUrl);
    if (entry.isDirectory()) {
      files.push(...await findRouteFiles(childUrl, childRelative));
    } else if (entry.isFile() && entry.name.endsWith(".ts")) {
      files.push({ relative: childRelative, url: childUrl });
    }
  }
  return files;
}

const routeFiles = await findRouteFiles(apiUrl);
assert.ok(routeFiles.length >= 90, "an unexpected API route loss must fail the method boundary check");

for (const file of routeFiles) {
  const source = await readFile(file.url, "utf8");
  assert.match(source, /export default\s+(?:async\s+)?function\s+handler/, `${file.relative} must export a handler`);
  assert.match(source, /req\.method/, `${file.relative} must inspect the HTTP method`);
  assert.match(source, /methodNotAllowed\s*\(/, `${file.relative} must return the shared 405 response`);
  assert.match(
    source,
    /import\s*\{[^}]*methodNotAllowed[^}]*\}\s*from\s*["'][^"']*\/response\.js["']|import\s*\{[^}]*methodNotAllowed[^}]*\}\s*from\s*["']\.\/_shared\/response\.js["']/s,
    `${file.relative} must use the shared method boundary`
  );
}

console.log(JSON.stringify({
  checkedRoutes: routeFiles.length,
  excludedSharedModules: true,
}));
