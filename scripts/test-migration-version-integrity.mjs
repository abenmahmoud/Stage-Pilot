import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const migrationsUrl = new URL("../supabase/migrations/", import.meta.url);
const scriptsUrl = new URL("./", import.meta.url);
const migrationFiles = (await readdir(migrationsUrl))
  .filter((name) => name.endsWith(".sql"))
  .sort();

assert.ok(migrationFiles.length >= 70, "a large migration loss must fail the integrity check");
const versions = new Map();
for (const file of migrationFiles) {
  const match = /^([0-9]{14})_([a-z0-9_]+)\.sql$/.exec(file);
  assert.ok(match, `malformed migration filename: ${file}`);
  const [, version] = match;
  const previous = versions.get(version);
  assert.equal(previous, undefined, `duplicate migration version ${version}: ${previous}, ${file}`);
  versions.set(version, file);
}

const migrationSet = new Set(migrationFiles);
const scriptFiles = (await readdir(scriptsUrl)).filter((name) => name.endsWith(".mjs"));
let checkedReferences = 0;
for (const scriptFile of scriptFiles) {
  const source = await readFile(new URL(scriptFile, scriptsUrl), "utf8");
  for (const match of source.matchAll(/supabase\/migrations\/([0-9]{14}_[a-z0-9_]+\.sql)/g)) {
    assert.equal(
      migrationSet.has(match[1]),
      true,
      `${scriptFile} references missing migration ${match[1]}`
    );
    checkedReferences += 1;
  }
  const version = /const VERSION = "([0-9]{14})";/.exec(source)?.[1];
  const name = /const NAME = "([a-z0-9_]+)";/.exec(source)?.[1];
  if (version || name) {
    assert.ok(version && name, `${scriptFile} must declare VERSION and NAME together`);
    const expected = `${version}_${name}.sql`;
    assert.equal(migrationSet.has(expected), true, `${scriptFile} expects missing migration ${expected}`);
    checkedReferences += 1;
  }
}

assert.ok(checkedReferences >= 10, "migration reference discovery unexpectedly found too little coverage");
console.log(JSON.stringify({
  migrations: migrationFiles.length,
  uniqueVersions: versions.size,
  checkedReferences,
  root: fileURLToPath(migrationsUrl),
}));
