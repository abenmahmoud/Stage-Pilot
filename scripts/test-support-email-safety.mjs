import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { isReservedTestEmail } from "../shared/support-test-address.ts";

test("recognizes reserved addresses used by preview recipes", () => {
  assert.equal(isReservedTestEmail("agent-test@example.com"), true);
  assert.equal(isReservedTestEmail("agent-test@example.org"), true);
  assert.equal(isReservedTestEmail("agent-test@example.net"), true);
  assert.equal(isReservedTestEmail("agent-test@test.invalid"), true);
});

test("does not silence ordinary email addresses", () => {
  assert.equal(isReservedTestEmail("personne@gmail.com"), false);
  assert.equal(isReservedTestEmail(null), false);
});

test("the Vercel worker skips test addresses before delivery", async () => {
  const source = await readFile(new URL("../api/cron/support-worker.ts", import.meta.url), "utf8");
  assert.match(source, /if \(isReservedTestEmail\(context\.email\)\) return "skipped:test_address";/);
  assert.ok(
    source.indexOf("isReservedTestEmail(context.email)") < source.indexOf("notify_requester_request_created"),
    "The test-address guard must run before every delivery branch"
  );
});
