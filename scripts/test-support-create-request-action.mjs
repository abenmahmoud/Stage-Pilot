import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { verifySupportCreateRequestActionConfirmation } from "../shared/support-create-request-action-confirmation.ts";

const helper = readFileSync(new URL("../api/_shared/support-create-request-action.ts", import.meta.url), "utf8");
const assistantRoute = readFileSync(new URL("../api/support/assistant.ts", import.meta.url), "utf8");
const requestRoute = readFileSync(new URL("../api/support/requests/index.ts", import.meta.url), "utf8");
const page = readFileSync(new URL("../src/pages/prototype/LyceeConnectPrototype.tsx", import.meta.url), "utf8");
const assistantPayloadPolicy = readFileSync(new URL("../shared/support-assistant-payload-policy.ts", import.meta.url), "utf8");
const envExample = readFileSync(new URL("../.env.local.example", import.meta.url), "utf8");

const actionId = "11111111-1111-4111-8111-111111111111";
const publicCode = "BC-2026-000123";
const createdAt = "2026-08-31T08:00:00.000Z";
const confirmedAt = "2026-08-31T08:00:00.500Z";
const persistenceConfirmedAt = "2026-08-31T08:00:01.000Z";

function confirmation(overrides = {}) {
  return {
    actionId,
    toolKey: "support.create_request",
    status: "succeeded",
    requestPublicCode: publicCode,
    confirmedAt,
    confirmationRef: `agent-action:${actionId}`,
    ...overrides,
  };
}

test("accepts only the exact create-request action confirmation bound to the dossier", () => {
  const valid = verifySupportCreateRequestActionConfirmation({
    expectedPublicCode: publicCode,
    requestCreatedAt: createdAt,
    persistenceConfirmedAt,
    confirmation: confirmation(),
    now: Date.parse(persistenceConfirmedAt),
  });
  assert.deepEqual(valid, confirmation());
  for (const invalid of [
    confirmation({ actionId: "not-a-uuid" }),
    confirmation({ toolKey: "support.send_reply" }),
    confirmation({ status: "failed" }),
    confirmation({ requestPublicCode: "BC-2026-000999" }),
    confirmation({ confirmationRef: "agent-action:other" }),
    confirmation({ confirmedAt: "2026-08-31T07:59:59.000Z" }),
    confirmation({ confirmedAt: "2026-08-31T08:00:02.000Z" }),
    { ...confirmation(), extra: true },
  ]) {
    assert.equal(verifySupportCreateRequestActionConfirmation({
      expectedPublicCode: publicCode,
      requestCreatedAt: createdAt,
      persistenceConfirmedAt,
      confirmation: invalid,
      now: Date.parse(persistenceConfirmedAt),
    }), null);
  }
});

test("persists the action lifecycle and request in the same transaction", () => {
  const transaction = requestRoute.indexOf("const result = await db.transaction");
  const start = requestRoute.indexOf("startSupportCreateRequestAction", transaction);
  const requestInsert = requestRoute.indexOf("const [created]", start);
  const replayRecovery = requestRoute.indexOf("const [racedRequest]", requestInsert);
  const completionCount = requestRoute.match(/completeSupportCreateRequestAction\(\{/g)?.length ?? 0;
  assert.ok(
    transaction >= 0
    && transaction < start
    && start < requestInsert
    && requestInsert < replayRecovery
  );
  assert.equal(completionCount, 2);
  assert.match(helper, /status: "planned"/);
  assert.match(helper, /status: "running", startedAt: sql`transaction_timestamp\(\)`/);
  assert.match(helper, /status: "succeeded"/);
  assert.match(helper, /confirmedAt: sql`transaction_timestamp\(\)`/);
  assert.match(helper, /supportRequestId: input\.request\.id/);
  assert.match(helper, /onConflictDoNothing/);
  assert.match(helper, /verifyAgentToolConfirmation/);
  assert.match(requestRoute, /agentAction: result\.agentAction/);
});

test("authorizes from one active published skill and stores only redacted routing metadata", () => {
  assert.match(helper, /authorizeAgentToolInvocation/);
  assert.match(helper, /skill\.activeVersionId !== skill\.versionId/);
  assert.match(helper, /skill\.versionStatus === "published"/);
  assert.match(helper, /allowedTools: allowedTools\(skill\.definition\)/);
  const inputBuilder = helper.match(/export function supportCreateRequestActionInput[\s\S]*?\n\}/)?.[0] ?? "";
  assert.match(inputBuilder, /category: input\.category/);
  assert.match(inputBuilder, /service: input\.routing\.service/);
  assert.match(inputBuilder, /hasEmail: input\.email !== null/);
  assert.match(inputBuilder, /hasPhone: input\.phone !== null/);
  assert.doesNotMatch(inputBuilder, /FirstName|LastName|description|subject|conversation|input\.email\s*[,}]|input\.phone\s*[,}]/);
  assert.match(helper, /inputRedacted: binding\.sanitizedInput/);
});

test("binds the grant to the device and fails closed on an invalid signed preparation", () => {
  assert.match(assistantRoute, /requesterRefHash: deviceKey/);
  assert.match(assistantRoute, /version\.allowedTools\?\.includes\("support\.create_request"\)/);
  assert.match(assistantRoute, /requestActionAuthorized: actionGrant !== null && signedRouting !== null/);
  assert.match(requestRoute, /expectedRequesterRefHash: deviceKey/);
  assert.match(requestRoute, /input\.assistantRoutingReceipt[\s\S]+!verifiedRoutingReceipt[\s\S]+throw new HttpError/);
  assert.match(requestRoute, /routingReviewReceipt = routingReviewEnabled \? verifiedRoutingReceipt : null/);
  assert.match(requestRoute, /attachedRoutingReview\] = routingReviewReceipt/);
  assert.match(helper, /input\.grant\.requesterRefHash !== input\.requesterRefHash/);
});

test("keeps the adapter disabled by default and requires its receipt before visible success", () => {
  assert.match(envExample, /SUPPORT_AGENT_CREATE_REQUEST_ACTION_ENABLED=false/);
  assert.match(page, /return isValidSupportAssistantPayload\(value\)/);
  assert.match(assistantPayloadPolicy, /typeof value\.requestActionAuthorized !== "boolean"/);
  assert.match(assistantPayloadPolicy, /if \(value\.requestActionAuthorized\)/);
  assert.match(page, /setAssistantRequestActionExpected\(requestActionAuthorized\)/);
  assert.match(page, /isSupportRequestCreationPayload\([\s\S]+!classicForm && assistantRequestActionExpected/);
  const validatorStart = page.indexOf("function isSupportRequestCreationPayload");
  const validatorEnd = page.indexOf("function isSupportAttachmentConfirmationPayload", validatorStart);
  const validator = page.slice(validatorStart, validatorEnd);
  assert.match(validator, /verifySupportCreateRequestActionConfirmation/);
  assert.match(validator, /if \(!actionConfirmation\) return false/);
  const validation = page.indexOf("isSupportRequestCreationPayload(", page.indexOf("async function submitRequest"));
  assert.ok(validation >= 0 && validation < page.indexOf("setTicketCode(publicCode)", validation));
});
