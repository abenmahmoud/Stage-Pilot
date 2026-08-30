import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../src/pages/prototype/LyceeConnectPrototype.tsx", import.meta.url), "utf8");

test("validates a magic-link exchange before opening the request view", () => {
  const effect = page.indexOf('const token = url.searchParams.get("support_token")');
  const readUnknown = page.indexOf("readApiResponse<unknown>", effect);
  const validation = page.indexOf("if (!isSupportMagicAccessPayload(payload))", readUnknown);
  const update = page.indexOf("setTicketCreated(payload.request.publicCode)", validation);
  assert.notEqual(effect, -1);
  assert.ok(effect < readUnknown);
  assert.ok(readUnknown < validation);
  assert.ok(validation < update);
});

test("accepts only the public dossier number format", () => {
  assert.match(page, /function isSupportMagicAccessPayload/);
  assert.match(page, /\^BC-\\d\{4\}-\\d\{6\}\$/);
});

test("removes the one-use token after success or failure", () => {
  const effect = page.indexOf('const token = url.searchParams.get("support_token")');
  const end = page.indexOf("}, []);", effect);
  const body = page.slice(effect, end);
  assert.equal(body.match(/url\.searchParams\.delete\("support_token"\)/g)?.length, 2);
  assert.equal(body.match(/window\.history\.replaceState/g)?.length, 2);
});
