import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const command = packageJson.scripts["recipe:local-code-vault-http-routes"];
const source = readFileSync(new URL("./test-local-code-vault-http-routes.mjs", import.meta.url), "utf8");
const codeOnly = source.replace(/^\s*\/\/.*$/gmu, "");

assert.match(command, /--experimental-transform-types/u);
assert.match(command, /--local-stack-only/u);
assert.match(source, /process\.argv\.length !== 3/u);
assert.match(source, /process\.argv\[2\] !== "--local-stack-only"/u);
assert.match(source, /const LOCAL_API_URL = "http:\/\/127\.0\.0\.1:54321"/u);
assert.match(source, /127\.0\.0\.1:54322/u);
assert.doesNotMatch(codeOnly, /--linked|db push|--env-file|LyceeGest-DONNEES-PRIVEES/u);

console.log(JSON.stringify({
  localOnly: true,
  guarded: true,
  actualHttpRoutes: true,
  transformTypes: true,
}));
