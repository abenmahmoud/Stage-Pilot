import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./test-local-real-clamav-scanner.mjs", import.meta.url), "utf8");
const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const command = packageJson.scripts?.["recipe:local-real-clamav-scanner"];

assert.equal(
  command,
  "node --import ./scripts/ts-test-resolver.mjs --experimental-strip-types scripts/test-local-real-clamav-scanner.mjs --local-container-only",
);
assert.ok(source.indexOf("local_container_confirmation_required") < source.indexOf("docker([\"image\""));
assert.match(source, /clamav\/clamav@\$\{IMAGE_DIGEST\}/u);
assert.match(source, /sha256:[a-f0-9]{64}/u);
assert.match(source, /"--network", "none"/u);
assert.match(source, /hostConfig\.NetworkMode, "none"/u);
assert.match(source, /hostConfig\.PortBindings \?\? \{\}, \{\}/u);
assert.match(source, /if \(created\) docker\(\["rm", "-f", CONTAINER\]\)/u);
assert.doesNotMatch(source, /--privileged|--publish|"-p"|--volume|"-v"/u);
assert.doesNotMatch(source, /DATABASE_URL|SUPABASE_SERVICE_ROLE|BREVO|OPENAI_API/u);

console.log(JSON.stringify({
  explicitConfirmation: true,
  pinnedImage: true,
  isolatedNetwork: true,
  noPublishedPort: true,
  cleanupGuard: true,
  noApplicationSecret: true,
}));
