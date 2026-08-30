import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  createSupportRequestMutationConfirmation,
  verifySupportRequestMutationConfirmation,
} from "../shared/support-request-mutation-confirmation.ts";

const publicCode = "BC-2026-000123";
const correlationId = "58298d45-b2c4-41b8-bcc2-2045f997ec2f";
const now = Date.parse("2026-08-31T08:00:00.000Z");
const previousRevision = "2026-08-31T07:59:58.000Z";

test("creates and verifies a current request mutation confirmation", () => {
  const confirmation = createSupportRequestMutationConfirmation({
    publicCode,
    previousRevision: new Date(previousRevision),
    revision: new Date("2026-08-31T07:59:59.500Z"),
    confirmedAt: new Date(now),
    correlationId,
  });

  assert.deepEqual(
    verifySupportRequestMutationConfirmation({
      expectedPublicCode: publicCode,
      expectedPreviousRevision: previousRevision,
      confirmation,
      now,
    }),
    confirmation
  );
});

test("refuses unbound, stale, future and malformed mutation confirmations", () => {
  const valid = createSupportRequestMutationConfirmation({
    publicCode,
    previousRevision: new Date(previousRevision),
    revision: new Date("2026-08-31T07:59:59.500Z"),
    confirmedAt: new Date(now),
    correlationId,
  });

  for (const confirmation of [
    null,
    { ...valid, status: "pending" },
    { ...valid, operation: "support_request_create" },
    { ...valid, publicCode: "BC-2026-000124" },
    { ...valid, previousRevision: "2026-08-31T07:59:57.000Z" },
    { ...valid, revision: "not-a-date" },
    { ...valid, confirmedAt: "2026-08-31T07:54:59.000Z" },
    { ...valid, confirmedAt: "2026-08-31T08:05:01.000Z" },
    { ...valid, confirmationRef: "support:request-update:unknown" },
  ]) {
    assert.equal(
      verifySupportRequestMutationConfirmation({
        expectedPublicCode: publicCode,
        expectedPreviousRevision: previousRevision,
        confirmation,
        now,
      }),
      null
    );
  }
});

test("uses the transaction event time and verifies it before refreshing the UI", () => {
  const route = readFileSync(
    new URL("../api/support/agent/requests/[code].ts", import.meta.url),
    "utf8"
  );
  const page = readFileSync(
    new URL("../src/pages/prototype/LyceeConnectPrototype.tsx", import.meta.url),
    "utf8"
  );

  const transaction = route.indexOf("const mutationResult = await db.transaction");
  const eventTime = route.indexOf("returning({ createdAt: supportEvents.createdAt })", transaction);
  const confirmation = route.indexOf("createSupportRequestMutationConfirmation", eventTime);
  assert.ok(transaction >= 0 && transaction < eventTime && eventTime < confirmation);

  const update = page.slice(
    page.indexOf("async function updateRequest"),
    page.indexOf("async function sendAgentReply")
  );
  const verification = update.indexOf("verifySupportRequestMutationConfirmation");
  const detailRefresh = update.indexOf("fetchAgentRequestDetail", verification);
  const revisionMatch = update.indexOf("refreshedDetail.request.updatedAt !== confirmation.revision", detailRefresh);
  const queueRefresh = update.indexOf("loadQueue", verification);
  const visibleRefresh = update.indexOf("setDetail(refreshedDetail)", revisionMatch);
  assert.ok(
    verification >= 0
    && verification < detailRefresh
    && detailRefresh < revisionMatch
    && revisionMatch < visibleRefresh
    && verification < queueRefresh
  );
  assert.match(update, /La modification n'a pas été confirmée par le serveur/);
});
