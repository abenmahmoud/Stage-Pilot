import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  isSupportAttachmentConfirmationInput,
  isSupportRequesterAttachmentReservationInput,
  isSupportRequesterMessageInput,
  singleSupportQueryValue,
} from "../shared/support-public-mutation-input-policy.ts";

const messageRoute = readFileSync(new URL("../api/support/requests/[code]/messages.ts", import.meta.url), "utf8");
const reservationRoute = readFileSync(new URL("../api/support/requests/[code]/attachments.ts", import.meta.url), "utf8");
const confirmationRoute = readFileSync(new URL("../api/support/attachments/[id]/confirm.ts", import.meta.url), "utf8");
const attachmentRoute = readFileSync(new URL("../api/support/attachments/[id].ts", import.meta.url), "utf8");
const detailRoute = readFileSync(new URL("../api/support/requests/[code].ts", import.meta.url), "utf8");

const publicCode = "BC-2026-000123";

test("accepts one route value and rejects missing or repeated parameters", () => {
  assert.equal(singleSupportQueryValue(publicCode), publicCode);
  assert.equal(singleSupportQueryValue(undefined), null);
  assert.equal(singleSupportQueryValue([publicCode, "BC-2026-000124"]), null);
  assert.equal(singleSupportQueryValue(42), null);
});

test("accepts only one exact bounded requester message", () => {
  assert.equal(isSupportRequesterMessageInput({ message: "Bonjour" }), true);
  assert.equal(isSupportRequesterMessageInput({ message: "Bonjour", actorId: "hidden" }), false);
  assert.equal(isSupportRequesterMessageInput({}), false);
  assert.equal(isSupportRequesterMessageInput({ message: 42 }), false);
  assert.equal(isSupportRequesterMessageInput({ message: "x".repeat(5_001) }), false);
});

test("accepts only one exact attachment confirmation command", () => {
  assert.equal(isSupportAttachmentConfirmationInput({ publicCode }), true);
  assert.equal(isSupportAttachmentConfirmationInput({ publicCode, scanStatus: "clean" }), false);
  assert.equal(isSupportAttachmentConfirmationInput({ publicCode: "BC-26-123" }), false);
  assert.equal(isSupportAttachmentConfirmationInput(null), false);
});

test("accepts only documented bounded attachment reservation metadata", () => {
  const minimal = {
    fileName: "justificatif.pdf",
    mimeType: "application/pdf",
    sizeBytes: 1_024,
  };
  assert.equal(isSupportRequesterAttachmentReservationInput(minimal), true);
  assert.equal(isSupportRequesterAttachmentReservationInput({
    ...minimal,
    concernsType: "demande",
    concernsLabel: "Élève concerné",
    documentType: "justificatif",
    note: "Document demandé",
  }), true);
  for (const candidate of [
    { ...minimal, storagePath: "hidden" },
    { ...minimal, sizeBytes: "1024" },
    { ...minimal, note: "x".repeat(501) },
    { ...minimal, concernsLabel: "x".repeat(181) },
    { mimeType: "application/pdf", sizeBytes: 1_024 },
    { ...minimal, sizeBytes: 10 * 1024 * 1024 + 1 },
  ]) {
    assert.equal(isSupportRequesterAttachmentReservationInput(candidate), false);
  }
});

test("routes validate shared input contracts before reading their fields", () => {
  assert.match(messageRoute, /isSupportRequesterMessageInput\(req\.body\)[\s\S]*const body = req\.body/);
  assert.match(reservationRoute, /isSupportRequesterAttachmentReservationInput\(req\.body\)[\s\S]*const body = req\.body/);
  assert.match(confirmationRoute, /isSupportAttachmentConfirmationInput\(req\.body\)[\s\S]*const publicCode = req\.body\.publicCode/);
});

test("all public dossier and attachment routes reject repeated dynamic parameters", () => {
  for (const source of [messageRoute, reservationRoute, confirmationRoute, attachmentRoute, detailRoute]) {
    assert.match(source, /singleSupportQueryValue\(req\.query\.(?:code|id)\)/);
    assert.doesNotMatch(source, /Array\.isArray\(req\.query\.(?:code|id)\) \? req\.query\.(?:code|id)\[0\]/);
  }
  assert.match(attachmentRoute, /singleSupportQueryValue\(req\.query\.id\)[\s\S]*singleSupportQueryValue\(req\.query\.code\)/);
});
