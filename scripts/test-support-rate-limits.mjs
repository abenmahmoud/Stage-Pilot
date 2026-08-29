import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  SUPPORT_RATE_LIMIT_POLICIES,
  normalizedSupportBehaviorText,
  normalizedSupportDeviceId,
} from "../shared/support-rate-limit-policy.ts";

const sharedSupport = readFileSync(new URL("../api/_shared/support.ts", import.meta.url), "utf8");
const sharedLimits = readFileSync(new URL("../api/_shared/support-rate-limits.ts", import.meta.url), "utf8");
const assistantRoute = readFileSync(new URL("../api/support/assistant.ts", import.meta.url), "utf8");
const requestRoute = readFileSync(new URL("../api/support/requests/index.ts", import.meta.url), "utf8");
const accessRoute = readFileSync(new URL("../api/support/access/[token].ts", import.meta.url), "utf8");
const messageRoute = readFileSync(new URL("../api/support/requests/[code]/messages.ts", import.meta.url), "utf8");
const reserveRoute = readFileSync(new URL("../api/support/requests/[code]/attachments.ts", import.meta.url), "utf8");
const confirmRoute = readFileSync(new URL("../api/support/attachments/[id]/confirm.ts", import.meta.url), "utf8");
const replyRoute = readFileSync(new URL("../api/support/agent/requests/[code]/reply.ts", import.meta.url), "utf8");
const noteRoute = readFileSync(new URL("../api/support/agent/requests/[code]/notes.ts", import.meta.url), "utf8");
const updateRoute = readFileSync(new URL("../api/support/agent/requests/[code].ts", import.meta.url), "utf8");
const contentAiRoute = readFileSync(new URL("../api/content/admin/assist.ts", import.meta.url), "utf8");
const translationRoute = readFileSync(new URL("../api/support/agent/requests/[code]/translate.ts", import.meta.url), "utf8");
const prototype = readFileSync(new URL("../src/pages/prototype/LyceeConnectPrototype.tsx", import.meta.url), "utf8");
const migration = readFileSync(
  new URL("../supabase/migrations/20260829205947_add_multidimensional_support_rate_limits.sql", import.meta.url),
  "utf8"
);

test("normalizes only bounded opaque device identifiers", () => {
  assert.equal(normalizedSupportDeviceId("123e4567-e89b-12d3-a456-426614174000"), "123e4567-e89b-12d3-a456-426614174000");
  assert.equal(normalizedSupportDeviceId("short"), null);
  assert.equal(normalizedSupportDeviceId("<script>1234567890123456"), null);
  assert.equal(normalizedSupportBehaviorText("  Problème   ENT\nURGENT "), "problème ent urgent");
});

test("uses device and contact limits before the high shared-network guard", () => {
  assert.equal(SUPPORT_RATE_LIMIT_POLICIES.requestDeviceBurst.limit, 8);
  assert.equal(SUPPORT_RATE_LIMIT_POLICIES.requestContactBurst.limit, 6);
  assert.equal(SUPPORT_RATE_LIMIT_POLICIES.requestRepeatedBehavior.limit, 6);
  assert.ok(SUPPORT_RATE_LIMIT_POLICIES.requestNetworkGuard.limit >= 10_000);
  assert.ok(SUPPORT_RATE_LIMIT_POLICIES.assistantNetworkGuard.limit >= 20_000);
});

test("keeps counters atomic, shared and bounded instead of server-memory based", () => {
  assert.match(sharedSupport, /insert into public\.support_rate_limits/);
  assert.match(sharedSupport, /on conflict \(scope, key_hash\) do update/);
  assert.match(sharedSupport, /request_count < \$\{input\.limit\}/);
  assert.match(sharedSupport, /where expires_at < now\(\) - interval '1 day'/);
  assert.match(sharedSupport, /limit 100/);
  assert.doesNotMatch(sharedSupport, /new Map|setInterval/);
});

test("never stores clear device, contact, account or network identifiers", () => {
  assert.match(sharedLimits, /personalHash\(`support-device:/);
  assert.match(sharedLimits, /personalHash\(`support-contact:/);
  assert.match(sharedLimits, /personalHash\(`agent-write:/);
  assert.match(sharedLimits, /requestIpHash\(req\)/);
  assert.doesNotMatch(sharedLimits, /insert into public\.support_rate_limits/);
  assert.doesNotMatch(assistantRoute + requestRoute + accessRoute, /network:unknown/);
  assert.match(sharedSupport, /process\.env\.NODE_ENV === "production"[\s\S]*x-forwarded-for/);
});

test("counts request traffic, invalid forms and repeated behavior independently", () => {
  const networkIndex = requestRoute.indexOf("enforceSupportRequestNetworkGuard(req)");
  const parseIndex = requestRoute.indexOf("parseSupportRequest(req.body)");
  assert.ok(networkIndex >= 0 && networkIndex < parseIndex);
  assert.match(requestRoute, /recordInvalidSupportRequest\(deviceKey\)/);
  assert.match(requestRoute, /enforceSupportRequestCreationLimits/);
  assert.match(sharedLimits, /requestDeviceBurst/);
  assert.match(sharedLimits, /requestContactBurst/);
  assert.match(sharedLimits, /requestRepeatedBehavior/);
});

test("sends one stable opaque device signal from assistant and request flows", () => {
  const headers = prototype.match(/"X-Support-Device": assistantSessionId/g) ?? [];
  assert.equal(headers.length, 2);
  assert.match(assistantRoute, /enforceAssistantRateLimits\(req, input\.sessionId\)/);
  assert.match(requestRoute, /supportDeviceRateKey\(req\)/);
});

test("protects messages, files and staff writes with their own dimensions", () => {
  assert.match(messageRoute, /messageSessionBurst/);
  assert.match(reserveRoute, /enforceAttachmentReservationRateLimit\(access\.sessionId\)/);
  assert.match(confirmRoute, /enforceAttachmentConfirmationRateLimit\(access\.sessionId\)/);
  assert.match(replyRoute, /enforceAgentWriteRateLimit\(user\.id\)/);
  assert.match(noteRoute, /enforceAgentWriteRateLimit\(user\.id\)/);
  assert.match(updateRoute, /req\.method === "PATCH"[\s\S]*enforceAgentWriteRateLimit\(user\.id\)/);
});

test("retains the existing account limits for costly AI actions", () => {
  assert.match(contentAiRoute, /scope: "content_ai_user"[\s\S]*personalHash\(user\.id\)/);
  assert.match(translationRoute, /scope: "agent_translation_user"[\s\S]*personalHash\(`\$\{user\.id\}:\$\{request\.id\}`\)/);
  assert.match(migration, /'content_ai_user'/);
  assert.match(migration, /'agent_translation_user'/);
});

test("keeps the database table private and accepts only HMAC-shaped keys", () => {
  assert.match(migration, /force row level security/);
  assert.match(migration, /revoke all on table public\.support_rate_limits from anon, authenticated/);
  assert.match(migration, /key_hash ~ '\^\[a-f0-9\]\{64\}\$'/);
  for (const policy of Object.values(SUPPORT_RATE_LIMIT_POLICIES)) {
    assert.match(migration, new RegExp(`'${policy.scope}'`));
  }
});
