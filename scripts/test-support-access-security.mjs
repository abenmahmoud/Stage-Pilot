import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sharedSupport = await readFile(
  new URL("../api/_shared/support.ts", import.meta.url),
  "utf8"
);
const accessRoute = await readFile(
  new URL("../api/support/access/[token].ts", import.meta.url),
  "utf8"
);
const accessSession = await readFile(
  new URL("../api/_shared/support-access-session.ts", import.meta.url),
  "utf8"
);
const requestRoute = await readFile(
  new URL("../api/support/requests/index.ts", import.meta.url),
  "utf8"
);
const replyRoute = await readFile(
  new URL("../api/support/agent/requests/[code]/reply.ts", import.meta.url),
  "utf8"
);
const agentRequestRoute = await readFile(
  new URL("../api/support/agent/requests/[code].ts", import.meta.url),
  "utf8"
);

test("keeps one-use links distinct from 30-day device sessions", () => {
  assert.match(sharedSupport, /SUPPORT_MAGIC_TOKEN_MINUTES = 30/);
  assert.match(requestRoute, /SUPPORT_MAGIC_TOKEN_MINUTES \* 60 \* 1000/);
  assert.match(replyRoute, /SUPPORT_MAGIC_TOKEN_MINUTES \* 60 \* 1000/);
});

test("rotates the device session after a magic-link exchange", () => {
  assert.match(accessRoute, /const newSessionToken = opaqueToken\(\);/);
  assert.doesNotMatch(accessRoute, /existingSessionToken\s*\?\?/);
  assert.match(accessRoute, /setSupportSessionCookie\(res, newSessionToken\);/);
  assert.match(accessRoute, /openSupportAccessSession/);
  assert.match(accessSession, /previousGrants\.map/);
  assert.match(accessSession, /set\(\{ revokedAt: input\.now \}\)/);
});

test("consumes a magic link atomically before granting a session", () => {
  const consumeIndex = accessRoute.indexOf(".update(supportMagicTokens)");
  const grantIndex = accessRoute.indexOf("openSupportAccessSession({");
  assert.ok(consumeIndex >= 0 && consumeIndex < grantIndex);
  assert.match(accessSession, /\.insert\(supportSessionRequests\)/);
  assert.match(accessRoute, /isNull\(supportMagicTokens\.usedAt\)/);
  assert.match(
    accessRoute,
    /attemptCount: sql`\$\{supportMagicTokens\.attemptCount\} \+ 1`/
  );
  assert.match(accessRoute, /if \(!consumed\)/);
});

test("never sends a reply to a disabled contact", () => {
  assert.match(
    replyRoute,
    /eq\(supportContacts\.requestId, request\.id\)[\s\S]*eq\(supportContacts\.usageScope, "support"\)[\s\S]*isNull\(supportContacts\.disabledAt\)/
  );
});

test("requires AAL2 when an agent confirms a school identity", () => {
  assert.match(agentRequestRoute, /import \{ HttpError, requireAal2 \}/);
  assert.match(
    agentRequestRoute,
    /nextIdentityStatus === "identite_confirmee"[\s\S]*currentIdentityStatus !== "identite_confirmee"[\s\S]*await requireAal2\(req\)/
  );
});
