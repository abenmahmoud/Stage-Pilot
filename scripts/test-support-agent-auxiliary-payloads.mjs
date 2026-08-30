import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("../src/pages/prototype/LyceeConnectPrototype.tsx", import.meta.url),
  "utf8"
);

test("validates every template returned by list and create routes", () => {
  assert.match(source, /value\.templates\.every\(isSupportReplyTemplate\)/);
  assert.match(source, /isSupportReplyTemplate\(value\.template\)/);
  assert.match(source, /new Set\(value\.allowedVariables\)\.size === value\.allowedVariables\.length/);
  assert.doesNotMatch(source, /payload\.templates as SupportReplyTemplate\[]/);
});

test("accepts only known bounded template variables", () => {
  assert.match(source, /const allowedVariables = \["prenom", "numero", "objet"\]/);
  assert.match(source, /value\.bodyText\.length <= 5_000/);
  assert.match(source, /value\.allowedVariables\.length <= allowedVariables\.length/);
});

test("limits attachment links to short-lived signed storage URLs", () => {
  assert.match(source, /!isPositiveInteger\(value\.expiresIn\)/);
  assert.match(source, /value\.expiresIn > 300/);
  assert.match(source, /target\.origin === configured\.origin/);
  assert.match(source, /target\.pathname\.startsWith\("\/storage\/v1\/object\/sign\/"\)/);
  assert.match(source, /target\.protocol === "https:"/);
});

test("validates before navigating and severs the popup opener", () => {
  const validation = source.indexOf("if (!isAllowedSupportAttachmentPayload(payload))");
  const navigation = source.indexOf("popup.location.href = payload.url");
  assert.notEqual(validation, -1);
  assert.notEqual(navigation, -1);
  assert.ok(validation < navigation);
  assert.match(source, /popup\.opener = null/);
});
