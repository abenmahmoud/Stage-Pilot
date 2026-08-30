import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const specsRoot = new URL("../specs/", import.meta.url);
const specsRootPath = fileURLToPath(specsRoot);
const entries = await readdir(specsRoot, { withFileTypes: true });
const specDirectories = entries
  .filter((entry) => entry.isDirectory() && /^\d{3}-[a-z0-9-]+$/.test(entry.name))
  .sort((left, right) => left.name.localeCompare(right.name));

assert.ok(specDirectories.length >= 5, "the five existing Spec Kit domains must stay discoverable");

const folderNumbers = new Set();
let taskCount = 0;
const summary = [];
for (const directory of specDirectories) {
  const folderNumber = directory.name.slice(0, 3);
  assert.equal(folderNumbers.has(folderNumber), false, `duplicate spec number ${folderNumber}`);
  folderNumbers.add(folderNumber);

  const taskPath = join(specsRootPath, directory.name, "tasks.md");
  const source = await readFile(taskPath, "utf8");
  const ids = new Set();
  let completed = 0;
  let open = 0;
  for (const [index, line] of source.split(/\r?\n/).entries()) {
    if (!line.startsWith("- [")) continue;
    const match = /^- \[(x| )\] \*{0,2}(T[0-9]{3}[A-Z0-9]*)\*{0,2}(?:\s+|$)/.exec(line);
    assert.ok(match, `${directory.name}:${index + 1} malformed task checkbox`);
    const [, state, id] = match;
    assert.equal(ids.has(id), false, `${directory.name}:${index + 1} duplicate task ${id}`);
    ids.add(id);
    if (state === "x") completed += 1;
    else open += 1;
  }
  assert.ok(ids.size > 0, `${directory.name} must contain tasks`);
  taskCount += ids.size;
  summary.push({ spec: directory.name, completed, open });
}

assert.ok(taskCount >= 350, "a large task loss must fail the integrity check");
assert.equal(summary.some((entry) => entry.spec === "003-gestion-contenus-lycee" && entry.open === 0), true);
console.log(JSON.stringify({ specs: summary.length, tasks: taskCount, summary }));
