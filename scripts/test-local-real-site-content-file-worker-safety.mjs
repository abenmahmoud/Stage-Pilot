import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(
  new URL("./test-local-real-site-content-file-worker.mjs", import.meta.url),
  "utf8",
);
const core = readFileSync(
  new URL("../workers/site-content-file-worker-core.mjs", import.meta.url),
  "utf8",
);
const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const command = packageJson.scripts?.["recipe:local-real-site-content-file-worker"];

assert.equal(command,
  "node --import ./scripts/ts-test-resolver.mjs --experimental-strip-types scripts/test-local-real-site-content-file-worker.mjs --local-stack-only");
assert.ok(source.indexOf("local_stack_confirmation_required") < source.indexOf("postgres(dbUrl"));
assert.match(source, /parsed\.hostname !== "127\.0\.0\.1"/u);
assert.match(source, /parsed\.port !== "54322"/u);
assert.match(source, /\["54321", "55321"\]\.includes\(parsed\.port\)/u);
assert.match(source, /clamav\/clamav@\$\{IMAGE_DIGEST\}/u);
assert.match(source, /"--network", "none"/u);
assert.match(source, /hostConfig\.NetworkMode, "none"/u);
assert.match(source, /hostConfig\.PortBindings \?\? \{\}, \{\}/u);
assert.ok(source.indexOf("clamavCreated = true") < source.indexOf("clamav_container_not_ready"));
assert.match(source, /storageWithOneRemovalFailure/u);
assert.match(source, /const blocked = fixture\(1, await eicarDocx\(\),/u);
assert.match(source, /zip\.file\("word\/eicar\.com", EICAR\)/u);
assert.match(source, /cleanupStorage\(\)/u);
assert.match(source, /cleanupDatabase\(\)/u);
assert.match(core, /verifyStored\("site-content", asset\)/u);
assert.match(core,
  /await storeAndVerifyClean\(asset, bytes\);[\s\S]*return persistClean\(asset\);[\s\S]*finally \{[\s\S]*bytes\.fill\(0\)/u);
assert.match(core, /machineErrorCode\(error\)/u);
assert.doesNotMatch(core, /error\.message\.slice/u);
assert.match(core, /case when status = 'ready' then 'archived' else 'scan_error' end/u);
assert.doesNotMatch(source, /xijocumlwivhbmffrnlj|sfqhxiamhgsbbogluqtq|--privileged|--publish|"-p"/u);
assert.doesNotMatch(source, /BREVO|OPENAI_API|SUPABASE_SERVICE_ROLE_KEY|VITE_SUPABASE_URL/u);

console.log(JSON.stringify({ explicitConfirmation: true, loopbackDatabase: true,
  loopbackStorage: true, pinnedClamav: true, isolatedClamav: true,
  durableCleanupReplay: true, targetedCleanup: true, noRemoteProjectReference: true }));
