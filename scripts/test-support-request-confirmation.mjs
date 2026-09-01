import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  createSupportRequestPersistenceConfirmation,
  verifySupportRequestPersistenceConfirmation,
} from "../shared/support-request-confirmation.ts";

const publicCode = "BC-2026-000123";
const now = Date.parse("2026-08-30T10:00:00.000Z");

test("creates and verifies a bounded persistence confirmation", () => {
  const confirmation = createSupportRequestPersistenceConfirmation({
    publicCode,
    confirmedAt: new Date("2026-08-30T10:00:00.000Z"),
  });

  assert.deepEqual(confirmation, {
    status: "persisted",
    publicCode,
    confirmedAt: "2026-08-30T10:00:00.000Z",
    confirmationRef: `support:${publicCode}`,
  });
  assert.deepEqual(
    verifySupportRequestPersistenceConfirmation({ expectedPublicCode: publicCode, confirmation, now }),
    confirmation
  );
});

test("refuses missing, mismatched and malformed confirmations", () => {
  const valid = createSupportRequestPersistenceConfirmation({
    publicCode,
    confirmedAt: new Date("2026-08-30T10:00:00.000Z"),
  });
  for (const confirmation of [
    null,
    [],
    { ...valid, status: "pending" },
    { ...valid, publicCode: "BC-2026-000124" },
    { ...valid, confirmationRef: "support:other" },
    { ...valid, confirmedAt: "not-a-date" },
    { ...valid, confirmedAt: "2026-08-30T10:00:00+00:00" },
    { ...valid, confirmedAt: "2026-08-30T09:54:59.000Z" },
    { ...valid, confirmedAt: "2026-08-30T10:05:01.000Z" },
    { ...valid, internalRequestId: "2f9d5406-599d-48e6-a9c0-a59895547246" },
  ]) {
    assert.equal(
      verifySupportRequestPersistenceConfirmation({ expectedPublicCode: publicCode, confirmation, now }),
      null
    );
  }
});

test("server confirms only after the database transaction and the UI waits for proof", () => {
  const route = readFileSync(new URL("../api/support/requests/index.ts", import.meta.url), "utf8");
  const prototype = readFileSync(
    new URL("../src/pages/prototype/LyceeConnectPrototype.tsx", import.meta.url),
    "utf8"
  );
  const transaction = route.indexOf("const result = await db.transaction");
  const confirmation = route.indexOf("createSupportRequestPersistenceConfirmation", transaction);
  const response = route.indexOf("return {", confirmation);
  assert.ok(transaction >= 0 && transaction < confirmation && confirmation < response);

  const submit = prototype.slice(
    prototype.indexOf("async function submitRequest"),
    prototype.indexOf("async function copyTicketCode")
  );
  const verification = submit.indexOf("isSupportRequestCreationPayload");
  const visibleSuccess = submit.indexOf("setTicketCode(publicCode)");
  const upload = submit.indexOf("uploadRequesterFiles(publicCode");
  assert.ok(verification >= 0 && verification < upload && upload < visibleSuccess);
  const payloadValidator = prototype.slice(
    prototype.indexOf("function isSupportRequestCreationPayload"),
    prototype.indexOf("function isSupportFileReservationPayload")
  );
  assert.match(payloadValidator, /verifySupportRequestPersistenceConfirmation/);
  assert.match(payloadValidator, /verifySupportCreateRequestActionConfirmation/);
  assert.doesNotMatch(submit, /BC-2026-000042/);
  assert.match(submit, /création de demandes n’est pas activée/);
});
