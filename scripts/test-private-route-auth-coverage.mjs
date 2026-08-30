import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";

const privateRoots = [
  "admin/",
  "content/admin/",
  "identity/admin/",
  "knowledge/admin/",
  "schedule/admin/",
  "communications/admin/",
  "support/agent/",
];

async function collect(directoryUrl, relativeRoot) {
  const entries = await readdir(directoryUrl, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const childUrl = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, directoryUrl);
    const relative = `${relativeRoot}${entry.name}`;
    if (entry.isDirectory()) files.push(...await collect(childUrl, `${relative}/`));
    else if (entry.isFile() && entry.name.endsWith(".ts")) files.push({ relative, url: childUrl });
  }
  return files;
}

const routeFiles = (
  await Promise.all(privateRoots.map((root) => collect(new URL(`../api/${root}`, import.meta.url), root)))
).flat();

assert.ok(routeFiles.length >= 60, "an unexpected private route loss must fail auth coverage");

for (const file of routeFiles) {
  const source = await readFile(file.url, "utf8");
  assert.match(source, /export default\s+(?:async\s+)?function\s+handler/, `${file.relative} must export a handler`);
  assert.match(
    source,
    /await\s+require[A-Z][A-Za-z0-9]*\s*\(\s*req\b/,
    `${file.relative} must authenticate and authorize the request`
  );
}

console.log(JSON.stringify({
  checkedPrivateRoutes: routeFiles.length,
  protectedRoots: privateRoots.length,
}));
