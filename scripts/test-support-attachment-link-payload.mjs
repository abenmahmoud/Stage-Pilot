import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { isSupportAttachmentLinkPayload } from "../shared/support-attachment-link-payload-policy.ts";

const configuredUrl = "https://example-project.supabase.co";
const payload = {
  url: `${configuredUrl}/storage/v1/object/sign/support-clean/request/file.pdf?token=signed&download=file.pdf`,
  expiresIn: 60,
};

test("accepts only an exact bounded link from the configured signed storage path", () => {
  assert.equal(isSupportAttachmentLinkPayload(payload, configuredUrl), true);
  for (const candidate of [
    { ...payload, storagePath: "hidden" },
    { ...payload, expiresIn: 0 },
    { ...payload, expiresIn: 301 },
    { ...payload, expiresIn: 60.5 },
    { ...payload, url: "https://attacker.example/storage/v1/object/sign/support-clean/file" },
    { ...payload, url: `${configuredUrl}/storage/v1/object/public/support-clean/file` },
    { ...payload, url: payload.url.replace("https:", "http:") },
    { ...payload, url: `${payload.url}#fragment` },
  ]) {
    assert.equal(isSupportAttachmentLinkPayload(candidate, configuredUrl), false);
  }
  assert.equal(isSupportAttachmentLinkPayload(payload, "http://localhost:54321"), false);
});

test("validates both server routes before auditing and returning a signed link", async () => {
  const routes = await Promise.all([
    readFile("api/support/attachments/[id].ts", "utf8"),
    readFile("api/support/agent/attachments/[id].ts", "utf8"),
  ]);
  for (const route of routes) {
    assert.match(route, /isSupportAttachmentLinkPayload\(payload, configuredStorageUrl\)/);
    const signed = route.indexOf("createSignedUrl");
    const validated = route.indexOf("const payload = attachmentLinkPayload(data.signedUrl)", signed);
    const audited = route.indexOf("attachment.download_link_issued", validated);
    const returned = route.indexOf("return payload", audited);
    assert.ok(signed >= 0 && signed < validated && validated < audited && audited < returned);
  }
});

test("uses the same closed contract in the browser before opening the URL", async () => {
  const page = await readFile("src/pages/prototype/LyceeConnectPrototype.tsx", "utf8");
  assert.match(page, /return isSupportAttachmentLinkPayload\(value, configuredUrl\)/);
  const request = page.indexOf("async function openAgentAttachment");
  const validation = page.indexOf("isAllowedSupportAttachmentPayload(payload)", request);
  const opening = page.indexOf("window.open(payload.url", validation);
  assert.ok(request >= 0 && request < validation && validation < opening);
});
