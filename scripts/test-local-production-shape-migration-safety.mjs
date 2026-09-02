import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(
  new URL("./test-local-production-shape-migration.mjs", import.meta.url),
  "utf8",
);
const fixture = readFileSync(
  new URL("./fixtures/production-shape-synthetic.sql", import.meta.url),
  "utf8",
);
const assertions = readFileSync(
  new URL("./fixtures/production-shape-assertions.sql", import.meta.url),
  "utf8",
);
const packageJson = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);

assert.equal(
  packageJson.scripts?.["recipe:local-production-shape-migration"],
  "node scripts/test-local-production-shape-migration.mjs --local-container-only",
);
assert.match(source, /local_container_confirmation_required/u);
assert.match(source, /supabase@\$\{cliVersion\}/u);
assert.match(source, /const cliVersion = "2\.116\.0"/u);
assert.match(source, /"db",\s*"reset",\s*"--local"/u);
assert.match(source, /"migration", "up", "--local"/u);
assert.match(source, /"db",\s*"query",\s*"--local"/u);
assert.match(source, /delete localEnvironment\[name\]/u);
assert.match(source, /shell: process\.platform === "win32"/u);
assert.doesNotMatch(source, /--linked|db push|apply_migration/u);
assert.doesNotMatch(source, /xijocumlwivhbmffrnlj|sfqhxiamhgsbbogluqtq/u);

assert.match(fixture, /generate_series\(1, 1159\)/u);
assert.match(fixture, /generate_series\(1, 106\)/u);
assert.match(fixture, /generate_series\(1, 44\)/u);
assert.match(fixture, /@example\.test/u);
assert.match(fixture, /2025-2026/u);
assert.doesNotMatch(fixture, /2026-2027/u);
assert.doesNotMatch(fixture, /@ac-creteil\.fr|@gmail\.com|0932048W/u);
assert.doesNotMatch(fixture, /Blaise Cendrars|Sevran|VER-EECKE/u);

assert.match(assertions, /migration_count <> 94/u);
assert.match(assertions, /actual_count <> 1159/u);
assert.match(assertions, /Fixture contains a non-example email/u);
assert.match(assertions, /Fixture contains a non-synthetic legacy access code/u);

console.log(JSON.stringify({
  explicitConfirmation: true,
  localOnlyCommands: true,
  remoteCredentialsRemoved: true,
  pinnedCli: true,
  syntheticFixtureOnly: true,
  productionReferencesAbsent: true,
}));
