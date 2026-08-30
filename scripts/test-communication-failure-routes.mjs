import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const list = readFileSync(new URL("../api/communications/admin/failures/index.ts", import.meta.url), "utf8");
const retry = readFileSync(new URL("../api/communications/admin/failures/[id]/retry.ts", import.meta.url), "utf8");
const gate = readFileSync(new URL("../api/_shared/communications.ts", import.meta.url), "utf8");
const page = readFileSync(new URL("../src/pages/admin/CommunicationsPage.tsx", import.meta.url), "utf8");

test("limits the failure inbox to direction under the shared MFA gate", () => {
  assert.match(list, /await requireCommunicationManager\(req\)/);
  assert.match(gate, /COMMUNICATION_TEMPLATE_MANAGER_ROLES = new Set\(\["superadmin", "proviseur"\]\)/);
  assert.match(gate, /export async function requireCommunicationManager/);
  assert.match(gate, /const context = await requireCommunicationEditor\(req\)/);
});

test("projects only bounded failure metadata from the current institution", () => {
  assert.match(list, /eq\(communicationJobs\.institutionId, context\.institutionId\)/);
  assert.match(list, /eq\(communicationJobs\.status, "dead"\)/);
  assert.match(list, /inArray\(communicationJobs\.jobType, \["send_delivery", "retry_delivery"\]\)/);
  assert.match(list, /\.limit\(100\)/);
  assert.doesNotMatch(list, /communicationDeliveries|deliveryStatus|contactRef|providerMessageRef|idempotencyKeyHash|email|phone/);
});

test("keeps retry closed unless both sending switches are enabled", () => {
  assert.match(retry, /await requireCommunicationSender\(req\)/);
  assert.match(gate, /readCommunicationFeatureFlags\(\)\.sendingEnabled/);
  assert.match(gate, /communicationSettings\.sendingEnabled/);
  assert.match(gate, /settings\?\.sendingEnabled/);
});

test("requires an exact confirmation and a strong server secret", () => {
  assert.match(retry, /BODY_FIELDS = new Set\(\["operatorConfirmedReady"\]\)/);
  assert.match(retry, /body\.operatorConfirmedReady !== true/);
  assert.match(retry, /COMMUNICATION_MANUAL_RETRY_HMAC_SECRET/);
  assert.match(retry, /isCommunicationWebhookSecret\(idempotencySecret\)/);
  assert.match(retry, /bodyParser: \{ sizeLimit: "4kb" \}/);
});

test("persists through the transaction helper and returns no identifiers", () => {
  assert.match(retry, /db\.transaction\(\(tx\) => persistCommunicationManualRetry\(\{/);
  assert.match(retry, /institutionId: context\.institutionId/);
  assert.match(retry, /actorUserId: context\.user\.id/);
  assert.match(retry, /authenticatorLevel: "aal2"/);
  const response = retry.slice(retry.lastIndexOf("return result"));
  assert.doesNotMatch(response, /jobId|deliveryId|institutionId|secret|contact|provider/);
});

test("shows a responsive two-step failure inbox only to direction", () => {
  assert.match(page, /canManageTemplates \? \(/);
  assert.match(page, /Envois à reprendre/);
  assert.match(page, /confirmingRetryId === failure\.id/);
  assert.match(page, /operatorConfirmedReady: true/);
  assert.match(page, /Confirmer la reprise/);
  assert.match(page, /min-h-11/);
  assert.match(page, /flex-col gap-3[\s\S]*lg:flex-row/);
  assert.doesNotMatch(page, /deliveryStatus|providerMessageRef|idempotencyKeyHash|contactRef/);
});
