import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL(
  "./test-local-depot-attributs-persistence.mjs",
  import.meta.url
), "utf8");

assert.match(source, /process\.argv\.length !== 3/u);
assert.match(source, /process\.argv\[2\] !== "--local-stack-only"/u);
assert.match(source, /const LOCAL_API_URL = "http:\/\/127\.0\.0\.1:54321"/u);
assert.match(source, /const LOCAL_DATABASE_URL = "postgresql:\/\/postgres:postgres@127\.0\.0\.1:54322\/postgres"/u);
assert.match(source, /await import\("\.\.\/api\/depot\/\[type\]\.js"\)/u);
assert.match(source, /activatePersonAttributeImport/u);
assert.match(source, /FormData\(\)/u);
assert.match(source, /realData: false/u);
assert.doesNotMatch(source, /--linked|db push|https:\/\/(?!127\.0\.0\.1)/u);
assert.doesNotMatch(source, /dotenv|--env-file|readFileSync\([^)]*\.env/u);
assert.doesNotMatch(source, /LyceeGest-DONNEES-PRIVEES/u);

console.log(JSON.stringify({
  localOnly: true,
  guarded: true,
  actualDepotRoute: true,
  fictitiousDataOnly: true,
}));
