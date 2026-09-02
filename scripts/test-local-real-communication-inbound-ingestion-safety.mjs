import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(
  new URL("./test-local-real-communication-inbound-ingestion.mjs", import.meta.url),
  "utf8",
);
const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const command = packageJson.scripts?.["recipe:local-real-communication-inbound-ingestion"];

assert.equal(command,
  "node --import ./scripts/ts-test-resolver.mjs --experimental-strip-types scripts/test-local-real-communication-inbound-ingestion.mjs --local-stack-only");
assert.ok(source.indexOf("local_stack_confirmation_required") < source.indexOf("postgres(dbUrl"));
assert.match(source, /parsed\.hostname !== "127\.0\.0\.1"/u);
assert.match(source, /parsed\.port !== "54322"/u);
assert.match(source, /\["54321", "55321"\]\.includes\(parsed\.port\)/u);
assert.match(source, /createCommunicationBrevoAttachmentDownloader/u);
assert.match(source, /createCommunicationInboundQuarantineStore/u);
assert.match(source, /synthetic_confirmation_interruption/u);
assert.match(source, /cleanupStorage\(\)/u);
assert.match(source, /cleanupDatabase\(\)/u);
assert.match(source, /storageResidues: 0/u);
assert.doesNotMatch(source, /xijocumlwivhbmffrnlj|sfqhxiamhgsbbogluqtq/u);
assert.doesNotMatch(source, /BREVO_API_KEY|SUPABASE_SERVICE_ROLE_KEY|OPENAI_API_KEY|VITE_SUPABASE_URL/u);

console.log(JSON.stringify({ explicitConfirmation: true, loopbackDatabase: true,
  loopbackStorage: true, realApplicationOrchestrator: true, simulatedProviderOnly: true,
  targetedCleanup: true, noRemoteProjectReference: true }));
