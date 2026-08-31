import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../src/pages/prototype/LyceeConnectPrototype.tsx", import.meta.url), "utf8");

test("validates the upload reservation before calling Supabase", () => {
  const uploadFunction = page.indexOf("async function uploadSupportFile");
  const readUnknown = page.indexOf("const reservation = await readApiResponse<unknown>", uploadFunction);
  const validation = page.indexOf("if (!isRequesterSupportUploadReservationPayload(reservation))", readUnknown);
  const storageCall = page.indexOf("supabase.storage", validation);
  assert.notEqual(uploadFunction, -1);
  assert.ok(uploadFunction < readUnknown);
  assert.ok(readUnknown < validation);
  assert.ok(validation < storageCall);
});

test("locks the upload to the quarantine contract", () => {
  assert.match(page, /value\.upload\.bucket !== "support-quarantine"/);
  assert.match(page, /segments\.length !== 3/);
  assert.match(page, /segments\[1\] !== attachmentId/);
  assert.match(page, /\^\[A-Za-z0-9\]\[A-Za-z0-9\._-\]\{0,89\}\$/);
  assert.match(page, /isBoundedString\(token, 4_096\)/);
  assert.match(page, /\^\[A-Za-z0-9\._~-\]\+\$/);
});
