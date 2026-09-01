import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("../src/pages/prototype/LyceeConnectPrototype.tsx", import.meta.url),
  "utf8"
);
const attachmentLinkPolicy = readFileSync(
  new URL("../shared/support-attachment-link-payload-policy.ts", import.meta.url),
  "utf8"
);
const templatePolicy = readFileSync(
  new URL("../shared/support-template-payload-policy.ts", import.meta.url),
  "utf8"
);

test("validates every template returned by list and create routes", () => {
  assert.match(source, /isSupportTemplateListPayload\(payload\)/);
  assert.match(source, /isSupportTemplateCreatePayload\(payload\)/);
  assert.match(templatePolicy, /value\.templates\.every\(isSupportReplyTemplatePayload\)/);
  assert.match(templatePolicy, /new Set\(value\.allowedVariables\)\.size !== value\.allowedVariables\.length/);
  assert.doesNotMatch(source, /payload\.templates as SupportReplyTemplate\[]/);
});

test("accepts only known bounded template variables", () => {
  assert.match(templatePolicy, /new Set\(\["prenom", "numero", "objet"\]\)/);
  assert.match(templatePolicy, /value\.bodyText\.length > 5_000/);
  assert.match(templatePolicy, /value\.allowedVariables\.length > ALLOWED_VARIABLES\.size/);
});

test("limits attachment links to short-lived signed storage URLs", () => {
  assert.match(source, /isSupportAttachmentLinkPayload\(value, configuredUrl\)/);
  assert.match(attachmentLinkPolicy, /Number\.isSafeInteger\(value\.expiresIn\)/);
  assert.match(attachmentLinkPolicy, /value\.expiresIn > 300/);
  assert.match(attachmentLinkPolicy, /target\.origin === configured\.origin/);
  assert.match(attachmentLinkPolicy, /target\.pathname\.startsWith\("\/storage\/v1\/object\/sign\/"\)/);
  assert.match(attachmentLinkPolicy, /target\.protocol === "https:"/);
});

test("validates before navigating and severs the popup opener", () => {
  const validation = source.indexOf("if (!isAllowedSupportAttachmentPayload(payload))");
  const navigation = source.indexOf("popup.location.href = payload.url");
  assert.notEqual(validation, -1);
  assert.notEqual(navigation, -1);
  assert.ok(validation < navigation);
  assert.match(source, /popup\.opener = null/);
});
