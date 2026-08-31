import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [reservationRoute, confirmationRoute, page] = await Promise.all([
  readFile("api/support/agent/requests/[code]/attachments.ts", "utf8"),
  readFile("api/support/agent/attachments/[id]/confirm.ts", "utf8"),
  readFile("src/pages/prototype/LyceeConnectPrototype.tsx", "utf8"),
]);

test("binds a reservation replay to one agent, request and file fingerprint", () => {
  assert.match(reservationRoute, /const reservationOperationId = operationId\(req\)/);
  assert.match(reservationRoute, /const reservationFingerprint = fileFingerprint/);
  assert.match(reservationRoute, /eq\(supportEvents\.correlationId, reservationOperationId\)/);
  assert.match(reservationRoute, /operationEvent\.eventType !== "attachment\.draft_reserved"/);
  assert.match(reservationRoute, /operationEvent\.actorType !== "agent"/);
  assert.match(reservationRoute, /operationEvent\.actorId !== user\.id/);
  assert.match(reservationRoute, /operationEvent\.fileFingerprint !== reservationFingerprint/);
  assert.match(reservationRoute, /eq\(supportAttachments\.uploadedByUser, user\.id\)/);
  assert.match(reservationRoute, /La réservation existante ne correspond plus à ce fichier/);
});

test("persists the reservation before issuing a renewable private upload token", () => {
  const transaction = reservationRoute.indexOf("const reservation = await db.transaction");
  const event = reservationRoute.indexOf('eventType: "attachment.draft_reserved"', transaction);
  const signing = reservationRoute.indexOf("createSignedUploadUrl", event);
  assert.ok(transaction >= 0 && transaction < event && event < signing);
  assert.match(reservationRoute, /createSignedUploadUrl\(reservation\.attachment\.storagePath, \{ upsert: true \}\)/);
  assert.match(reservationRoute, /res\.status\(reservation\.duplicate \? 200 : 201\)/);
  assert.match(reservationRoute, /reservation\.attachment\.scanStatus !== "awaiting_upload"[\s\S]*upload: null/);
  assert.doesNotMatch(reservationRoute, /getPublicUrl|publicUrl/);

  const receiptStart = reservationRoute.indexOf('eventType: "attachment.draft_reserved"');
  const receiptEnd = reservationRoute.indexOf("correlationId: reservationOperationId", receiptStart);
  const receipt = reservationRoute.slice(receiptStart, receiptEnd);
  assert.match(receipt, /fileFingerprint: reservationFingerprint/);
  assert.doesNotMatch(receipt, /originalName|storagePath|token|fileName/);
});

test("confirms a concurrent upload only once", () => {
  const update = confirmationRoute.indexOf("const [confirmed] = await tx");
  const compareAndSwap = confirmationRoute.indexOf('eq(supportAttachments.scanStatus, "awaiting_upload")', update);
  const returning = confirmationRoute.indexOf(".returning({ scanStatus: supportAttachments.scanStatus })", compareAndSwap);
  const lostRace = confirmationRoute.indexOf("if (!confirmed)", returning);
  const event = confirmationRoute.indexOf("tx.insert(supportEvents)", lostRace);
  const queue = confirmationRoute.indexOf("pgmq.send", event);
  assert.ok(
    update >= 0
    && update < compareAndSwap
    && compareAndSwap < returning
    && returning < lostRace
    && lostRace < event
    && event < queue
  );
  assert.match(confirmationRoute, /return \{ scanStatus: current\.scanStatus, duplicate: true \}/);
});

test("the browser keeps one key through lost responses and partial batches", () => {
  const upload = page.slice(
    page.indexOf("type AgentUploadSubmission"),
    page.indexOf("function isAssistantStringList")
  );
  assert.match(upload, /attempted: boolean/);
  assert.match(upload, /submission\.attempted = true[\s\S]*"Idempotency-Key": submission\.idempotencyKey/);
  assert.match(upload, /isAgentSupportUploadReservationPayload/);
  assert.match(upload, /value\.upload === null[\s\S]*value\.duplicate/);
  assert.match(upload, /value\.attachment\.scanStatus !== "awaiting_upload"/);
  assert.match(upload, /reservation\.upload === null/);
  assert.match(upload, /uploadToSignedUrl[\s\S]*upsert: true/);

  const selection = page.slice(
    page.indexOf("async function selectAgentFiles"),
    page.indexOf("function applyReplyTemplate")
  );
  assert.match(selection, /agentUploadSubmissionsRef\.current\.get\(fingerprint\)/);
  assert.match(selection, /idempotencyKey: crypto\.randomUUID\(\)/);
  assert.match(selection, /attachmentId: null,[\s\S]*attempted: false/);
  assert.match(selection, /entry\.submission\.attachmentId \|\| entry\.submission\.attempted/);
  assert.match(selection, /entry\.submission\.completed && entry\.submission\.attachmentId/);
  assert.match(selection, /agentUploadSubmissionsRef\.current\.delete\(entry\.fingerprint\)/);
});

test("the public upload contract remains separate and requires an upload token", () => {
  const publicValidator = page.slice(
    page.indexOf("function isSupportUploadReservationPayload"),
    page.indexOf("type AgentUploadSubmission")
  );
  assert.match(publicValidator, /!isRecord\(value\.upload\)/);
  assert.match(publicValidator, /value\.upload\.bucket !== "support-quarantine"/);
  assert.match(publicValidator, /segments\[1\] !== attachmentId/);
});
