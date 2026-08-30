import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

const routeFiles = [
  "api/communications/admin/index.ts",
  "api/communications/admin/assist.ts",
  "api/communications/admin/templates.ts",
  "api/communications/admin/documents/index.ts",
  "api/communications/admin/documents/[id]/confirm.ts",
  "api/communications/admin/[id]/index.ts",
  "api/communications/admin/[id]/review.ts",
  "api/communications/admin/failures/index.ts",
  "api/communications/admin/failures/[id]/retry.ts",
];

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("requires explicit AAL2 before opening the private communication module", async () => {
  const gate = await source("api/_shared/communications.ts");
  assert.match(gate, /import \{ HttpError, requireAal2 \} from "\.\/auth\.js"/);
  assert.match(gate, /const context = await requireSupportAgent\(req\);\s+await requireAal2\(req\);/);
  assert.match(gate, /readCommunicationFeatureFlags\(\)\.moduleEnabled/);
  assert.match(gate, /communicationSettings\.institutionId/);
  assert.match(gate, /settings\?\.moduleEnabled/);
});

test("keeps editor and manager roles explicit and bounded", async () => {
  const gate = await source("api/_shared/communications.ts");
  assert.match(gate, /COMMUNICATION_EDITOR_ROLES = new Set\(\["superadmin", "administration", "proviseur"\]\)/);
  assert.match(gate, /COMMUNICATION_TEMPLATE_MANAGER_ROLES = new Set\(\["superadmin", "proviseur"\]\)/);
  assert.doesNotMatch(gate, /"agent"|"eleve"|"professeur"|"parent"/);
});

test("protects every communication route with the shared private gate", async () => {
  for (const path of routeFiles) {
    const route = await source(path);
    assert.match(
      route,
      /await requireCommunication(?:Editor|TemplateManager|Manager|Sender)\(req\)/,
      `${path} must use the shared communication gate`
    );
  }
});

test("keeps every persisted route scoped to the authenticated institution", async () => {
  const persistedRoutes = routeFiles.filter((path) => !path.endsWith("/assist.ts"));
  for (const path of persistedRoutes) {
    const route = await source(path);
    assert.match(route, /context\.institutionId/, `${path} must scope persisted work`);
  }
});

test("exposes no public, audience, publication or direct sending route", async () => {
  assert.ok(routeFiles.every((path) => path.includes("/admin/")));
  const routes = (await Promise.all(routeFiles.map(source))).join("\n");
  assert.doesNotMatch(routes, /communication-send|audienceRef|recipientIds|recipientEmail/);
  const gate = await source("api/_shared/communications.ts");
  assert.match(gate, /readCommunicationFeatureFlags\(\)\.sendingEnabled/);
  assert.match(gate, /settings\?\.sendingEnabled/);
});
