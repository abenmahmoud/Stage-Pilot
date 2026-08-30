import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../src/pages/prototype/LyceeConnectPrototype.tsx", import.meta.url), "utf8");

test("confirms the attachment before treating the upload as complete", () => {
  const upload = page.indexOf("async function uploadSupportFile");
  const confirm = page.indexOf("const confirmation = await readApiResponse<unknown>", upload);
  const validation = page.indexOf("isSupportAttachmentConfirmationPayload(confirmation, reservation.attachment.id)", confirm);
  assert.notEqual(upload, -1);
  assert.ok(upload < confirm && confirm < validation);
  assert.match(page, /\["quarantine", "clean"\]/);
});

test("confirms a follow-up message before clearing the editor", () => {
  const send = page.indexOf("async function sendReply");
  const validation = page.indexOf("if (!isSupportMessageMutationPayload(confirmation))", send);
  const clear = page.indexOf('setReply("")', validation);
  assert.notEqual(send, -1);
  assert.ok(send < validation && validation < clear);
  assert.match(page, /Date\.parse\(value\.message\.createdAt\) <= Date\.now\(\) \+ \(5 \* 60_000\)/);
});

test("confirms server-side session closure before clearing device memory", () => {
  const forget = page.indexOf("async function forgetThisDevice");
  const validation = page.indexOf("if (!isSupportSessionClearPayload(confirmation))", forget);
  const clear = page.indexOf("clearRememberedSupportRequests", validation);
  assert.notEqual(forget, -1);
  assert.ok(forget < validation && validation < clear);
  assert.match(page, /value\.cleared === true/);
});
