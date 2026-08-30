import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../src/pages/prototype/LyceeConnectPrototype.tsx", import.meta.url), "utf8");

test("validates public request details before rendering", () => {
  const read = page.indexOf("const payload = await readApiResponse<unknown>(", page.indexOf("async function loadDetail(code: string)", page.indexOf("function ConnectedRequestsView")));
  const validation = page.indexOf("if (!isPublicSupportRequestDetailPayload(payload)", read);
  const replacement = page.indexOf("setDetail(payload)", validation);
  assert.notEqual(read, -1);
  assert.ok(read < validation);
  assert.ok(validation < replacement);
});

test("bounds all public detail collections and visible fields", () => {
  assert.match(page, /value\.messages\.length > 500/);
  assert.match(page, /value\.messages\.every\(isPublicSupportMessage\)/);
  assert.match(page, /value\.attachments\.length > MAX_SUPPORT_ATTACHMENTS_PER_REQUEST/);
  assert.match(page, /value\.attachments\.every\(isPublicSupportAttachment\)/);
  assert.match(page, /value\.sizeBytes <= MAX_SUPPORT_FILE_BYTES/);
  assert.match(page, /isPublicSupportContext\(record\.subjectContext\)/);
});

test("keeps public detail races and errors separate", () => {
  assert.match(page, /const detailLoadIdRef = useRef\(0\)/);
  assert.match(page, /loadId !== detailLoadIdRef\.current \|\| selectedCodeRef\.current !== code/);
  assert.match(page, /setDetailError\(/);
  assert.match(page, /Réessayer le dossier/);
  assert.match(page, /setDetail\(null\);\s+setDetailError\(null\);/);
});
