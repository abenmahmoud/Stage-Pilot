import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(
  new URL("./test-local-real-communication-inbound-worker.mjs", import.meta.url),
  "utf8",
);
const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const command = packageJson.scripts?.["recipe:local-real-communication-inbound-worker"];

assert.equal(command,
  "node --import ./scripts/ts-test-resolver.mjs --experimental-strip-types scripts/test-local-real-communication-inbound-worker.mjs --local-stack-only");
assert.ok(source.indexOf("local_stack_confirmation_required") < source.indexOf("postgres(dbUrl"));
assert.match(source, /parsed\.hostname !== "127\.0\.0\.1"/u);
assert.match(source, /parsed\.port !== "54322"/u);
assert.match(source, /\["54321", "55321"\]\.includes\(parsed\.port\)/u);
assert.match(source, /clamav\/clamav@\$\{IMAGE_DIGEST\}/u);
assert.match(source, /"--network", "none"/u);
assert.match(source, /hostConfig\.NetworkMode, "none"/u);
assert.match(source, /hostConfig\.PortBindings \?\? \{\}, \{\}/u);
assert.ok(source.indexOf("clamavCreated = true") < source.indexOf("clamav_container_not_ready"));
assert.match(source, /cleanupStorage\(\)/u);
assert.match(source, /cleanupDatabase\(\)/u);
assert.doesNotMatch(source, /xijocumlwivhbmffrnlj|sfqhxiamhgsbbogluqtq|--privileged|--publish|"-p"/u);
assert.doesNotMatch(source, /BREVO|OPENAI_API|SUPABASE_SERVICE_ROLE_KEY|VITE_SUPABASE_URL/u);

console.log(JSON.stringify({ explicitConfirmation: true, loopbackDatabase: true,
  loopbackStorage: true, pinnedClamav: true, isolatedClamav: true,
  targetedCleanup: true, noRemoteProjectReference: true }));
