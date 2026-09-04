import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  safeScolAccessEnabled,
  validatedSafeScolUrl,
} from "../shared/safescol-access.ts";

const page = readFileSync(
  new URL("../src/pages/prototype/LyceeConnectPrototype.tsx", import.meta.url),
  "utf8"
);

test("keeps SafeScol closed until both a flag and an HTTPS URL are validated", () => {
  assert.equal(safeScolAccessEnabled({ enabled: "true", url: "https://safescol.example/signalement" }), true);
  assert.equal(safeScolAccessEnabled({ enabled: "false", url: "https://safescol.example/signalement" }), false);
  assert.equal(safeScolAccessEnabled({ enabled: "true", url: "http://safescol.example" }), false);
  assert.equal(safeScolAccessEnabled({ enabled: "true", url: "javascript:alert(1)" }), false);
  assert.equal(safeScolAccessEnabled({ enabled: "true", url: "https://user:secret@safescol.example" }), false);
  assert.equal(validatedSafeScolUrl("  https://safescol.example/signalement  "), "https://safescol.example/signalement");
});

test("does not offer the ordinary support form for a SafeScol conversation", () => {
  assert.match(page, /insight\?\.scope !== "safescol"/);
  assert.match(page, /insight\?\.scope === "safescol"/);
  assert.match(page, /Aucun signalement ni détail n’est enregistré/);
  assert.match(page, /VITE_SAFESCOL_ENABLED/);
  assert.match(page, /VITE_SAFESCOL_URL/);
});

test("keeps a recognized SafeScol message out of the assistant API and local draft", () => {
  assert.match(page, /AI_ASSISTANT_ENABLED && result\.scope !== "safescol"/);
  assert.match(page, /if \(insight\?\.scope === "safescol"\) \{\s*void clearSupportDeviceDraft\(\);/);
  assert.match(page, /if \(result\.scope === "safescol"\) \{\s*setFiles\(\[\]\);\s*void clearSupportDeviceDraft\(\);/);
  const submit = page.indexOf("async function submitRequest");
  const classicBoundary = page.indexOf('safeScolPolicy.scope === "safescol"', submit);
  const networkWrite = page.indexOf('fetch("/api/support/requests"', submit);
  assert.ok(submit >= 0 && submit < classicBoundary && classicBoundary < networkWrite);
});
