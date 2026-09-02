import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(
  new URL("./test-local-real-communication-document-worker.mjs", import.meta.url),
  "utf8",
);
const core = readFileSync(
  new URL("../workers/communication-document-worker-core.mjs", import.meta.url),
  "utf8",
);
const executable = readFileSync(
  new URL("../workers/communication-document-worker.mjs", import.meta.url),
  "utf8",
);
const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const command = packageJson.scripts?.["recipe:local-real-communication-document-worker"];

assert.equal(command,
  "node --import ./scripts/ts-test-resolver.mjs --experimental-strip-types scripts/test-local-real-communication-document-worker.mjs --local-stack-only");
assert.ok(source.indexOf("local_stack_confirmation_required") < source.indexOf("postgres(dbUrl"));
assert.match(source, /parsed\.hostname !== "127\.0\.0\.1"/u);
assert.match(source, /parsed\.port !== "54322"/u);
assert.match(source, /\["54321", "55321"\]\.includes\(parsed\.port\)/u);
assert.match(source, /clamav\/clamav@\$\{IMAGE_DIGEST\}/u);
assert.match(source, /"--network", "none"/u);
assert.match(source, /hostConfig\.NetworkMode, "none"/u);
assert.match(source, /hostConfig\.PortBindings \?\? \{\}, \{\}/u);
assert.ok(source.indexOf("clamavCreated = true") < source.indexOf("clamav_container_not_ready"));
assert.match(source, /const blocked = fixture\(1, await eicarDocx\(\),/u);
assert.match(source, /zip\.file\("word\/eicar\.com", EICAR\)/u);
assert.match(source, /storageWithOneRemovalFailure/u);
assert.match(source, /cleanupStorage\(\)/u);
assert.match(source, /cleanupDatabase\(\)/u);
assert.match(core,
  /await persistRejected\(document, "antivirus_detected_threat"\);[\s\S]*await removeSourceObject\(document\)/u);
assert.match(core, /verifyStoredDocument\(document\)/u);
assert.match(core, /machineErrorCode\(error\)/u);
assert.doesNotMatch(core, /error\.message\.slice/u);
assert.match(core, /status in \('quarantined', 'processing', 'review'\)/u);
assert.match(core, /finally \{[\s\S]*bytes\.fill\(0\)/u);
assert.match(executable, /createCommunicationInboundScanner/u);
assert.doesNotMatch(executable, /mkdtemp|writeFile|filePath/u);
assert.doesNotMatch(source,
  /xijocumlwivhbmffrnlj|sfqhxiamhgsbbogluqtq|--privileged|--publish|"-p"/u);
assert.doesNotMatch(source,
  /BREVO|OPENAI_API|SUPABASE_SERVICE_ROLE_KEY|VITE_SUPABASE_URL/u);

console.log(JSON.stringify({
  explicitConfirmation: true,
  loopbackDatabase: true,
  loopbackStorage: true,
  pinnedClamav: true,
  isolatedClamav: true,
  durableCleanupReplay: true,
  tamperFailClosed: true,
  targetedCleanup: true,
  noRemoteProjectReference: true,
}));
