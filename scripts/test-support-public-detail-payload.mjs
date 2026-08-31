import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { SUPPORT_PUBLIC_DETAIL_LIMITS } from "../shared/support-public-detail-limits.ts";

const page = readFileSync(new URL("../src/pages/prototype/LyceeConnectPrototype.tsx", import.meta.url), "utf8");
const route = readFileSync(new URL("../api/support/requests/[code].ts", import.meta.url), "utf8");

test("validates public request details before rendering", () => {
  const read = page.indexOf("const payload = await readApiResponse<unknown>(", page.indexOf("async function loadDetail(code: string)", page.indexOf("function ConnectedRequestsView")));
  const validation = page.indexOf("if (!isPublicSupportRequestDetailPayload(payload)", read);
  const replacement = page.indexOf("setDetail(payload)", validation);
  assert.notEqual(read, -1);
  assert.ok(read < validation);
  assert.ok(validation < replacement);
});

test("bounds all public detail collections and visible fields", () => {
  assert.deepEqual(SUPPORT_PUBLIC_DETAIL_LIMITS, { messages: 500, attachments: 10 });
  assert.match(page, /value\.messages\.length > SUPPORT_PUBLIC_DETAIL_LIMITS\.messages/);
  assert.match(page, /value\.messages\.every\(isPublicSupportMessage\)/);
  assert.match(page, /value\.attachments\.length > SUPPORT_PUBLIC_DETAIL_LIMITS\.attachments/);
  assert.match(page, /value\.attachments\.every\(isPublicSupportAttachment\)/);
  assert.match(page, /value\.sizeBytes <= MAX_SUPPORT_FILE_BYTES/);
  assert.match(page, /isPublicSupportContext\(record\.subjectContext\)/);
});

test("bounds server reads and never returns a partial public conversation", () => {
  for (const collection of ["messages", "attachments"]) {
    assert.match(
      route,
      new RegExp(`\\.limit\\(SUPPORT_PUBLIC_DETAIL_LIMITS\\.${collection} \\+ 1\\)`)
    );
    assert.match(
      route,
      new RegExp(`assertCompletePublicDetailCollection\\([\\s\\S]*?SUPPORT_PUBLIC_DETAIL_LIMITS\\.${collection}`)
    );
  }
  assert.match(route, /Aucune conversation partielle n’a été affichée/);
  assert.match(route, /if \(!request\) throw new HttpError\(404, "Demande introuvable"\)/);
  assert.match(route, /eq\(supportContacts\.isVerified, true\),[\s\S]*?\.limit\(1\)/);
});

test("keeps public detail races and errors separate", () => {
  assert.match(page, /const detailLoadIdRef = useRef\(0\)/);
  assert.match(page, /loadId !== detailLoadIdRef\.current \|\| selectedCodeRef\.current !== code/);
  assert.match(page, /setDetailError\(/);
  assert.match(page, /Réessayer le dossier/);
  assert.match(page, /setDetail\(null\);\s+setDetailError\(null\);/);
});
