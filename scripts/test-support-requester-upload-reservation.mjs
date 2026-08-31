import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [reservationRoute, confirmationRoute, page, schema] = await Promise.all([
  readFile("api/support/requests/[code]/attachments.ts", "utf8"),
  readFile("api/support/attachments/[id]/confirm.ts", "utf8"),
  readFile("src/pages/prototype/LyceeConnectPrototype.tsx", "utf8"),
  readFile("db/schema.ts", "utf8"),
]);

test("binds requester reservation replay to session, request and complete metadata", () => {
  assert.match(reservationRoute, /const reservationOperationId = operationId\(req\)/);
  assert.match(reservationRoute, /const reservationFingerprint = fileFingerprint/);
  for (const field of [
    "originalName",
    "declaredMime",
    "sizeBytes",
    "concernsType",
    "concernsLabel",
    "documentType",
    "note",
  ]) {
    assert.match(reservationRoute, new RegExp(`${field}: input\\.${field}`));
  }
  assert.match(reservationRoute, /eq\(supportEvents\.correlationId, reservationOperationId\)/);
  assert.match(reservationRoute, /operationEvent\.actorType !== "requester"/);
  assert.match(reservationRoute, /operationEvent\.actorId !== access\.sessionId/);
  assert.match(reservationRoute, /operationEvent\.fileFingerprint !== reservationFingerprint/);
  assert.match(reservationRoute, /eq\(supportAttachments\.uploadedBySession, access\.sessionId\)/);
});

test("persists one private draft before issuing a renewable upload token", () => {
  const transaction = reservationRoute.indexOf("const reservation = await db.transaction");
  const event = reservationRoute.indexOf('eventType: "attachment.draft_reserved"', transaction);
  const signing = reservationRoute.indexOf("createSignedUploadUrl", event);
  assert.ok(transaction >= 0 && transaction < event && event < signing);
  assert.match(reservationRoute, /createSignedUploadUrl\(reservation\.attachment\.storagePath, \{ upsert: true \}\)/);
  assert.match(reservationRoute, /scanStatus: "awaiting_upload"/);
  assert.match(schema, /scanStatus: text\("scan_status"\)\.notNull\(\)\.default\("awaiting_upload"\)/);
  assert.match(reservationRoute, /res\.status\(reservation\.duplicate \? 200 : 201\)/);
  assert.match(reservationRoute, /reservation\.attachment\.scanStatus !== "awaiting_upload"[\s\S]*upload: null/);
  assert.doesNotMatch(reservationRoute, /getPublicUrl|publicUrl/);

  const receiptStart = reservationRoute.indexOf('eventType: "attachment.draft_reserved"');
  const receiptEnd = reservationRoute.indexOf("correlationId: reservationOperationId", receiptStart);
  const receipt = reservationRoute.slice(receiptStart, receiptEnd);
  assert.match(receipt, /fileFingerprint: reservationFingerprint/);
  assert.doesNotMatch(receipt, /originalName|storagePath|token|fileName|concernsLabel|note/);
});

test("confirms one requester upload once under concurrency", () => {
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

test("keeps hashed per-file keys and resumes work after a browser restart", () => {
  const upload = page.slice(
    page.indexOf("type RequesterUploadSubmission"),
    page.indexOf("const navigation")
  );
  assert.match(upload, /const requesterUploadSubmissions = new Map/);
  assert.match(upload, /crypto\.subtle\.digest\("SHA-256"/);
  assert.match(upload, /readPendingRequesterUpload\(publicCode, fingerprint\)/);
  assert.match(upload, /persisted\?\.idempotencyKey \?\? crypto\.randomUUID\(\)/);
  assert.match(upload, /submission\.attempted = true[\s\S]*rememberRequesterUploadSubmission\(submission\)[\s\S]*"Idempotency-Key": submission\.idempotencyKey/);
  assert.match(upload, /isRequesterSupportUploadReservationPayload/);
  assert.match(upload, /uploadToSignedUrl[\s\S]*upsert: true/);
  assert.match(upload, /entry\.submission\.completed && entry\.submission\.attachmentId/);
  assert.match(upload, /completeRequesterUploadSubmission\(submission\)/);
  assert.match(upload, /clearPendingRequesterUpload\(submission\.fingerprintDigest\)/);
});

test("allows only a known interrupted upload to bypass a full client counter", () => {
  const selection = page.slice(
    page.indexOf("function selectFollowupFiles"),
    page.indexOf("async function sendReply")
  );
  assert.match(selection, /await requesterUploadEntries\(code, combined\)/);
  assert.match(selection, /entry\.submission\.attempted \|\| entry\.submission\.attachmentId/);
  assert.match(selection, /availableNewSlots < 1/);
  assert.match(selection, /requesterUploadSubmissions\.delete\(entry\.fingerprint\)/);

  const send = page.slice(
    page.indexOf("async function sendReply"),
    page.indexOf("async function openPublicAttachment")
  );
  const uploadFirst = send.indexOf("uploadRequesterFiles(code, followupFiles)");
  const message = send.indexOf("/messages", uploadFirst);
  assert.ok(uploadFirst >= 0 && uploadFirst < message);
  assert.match(send, /!reply\.trim\(\) && followupFiles\.length === 0/);
  assert.match(send, /if \(!messageText\) return/);
  assert.match(page, /attachment\.scanStatus === "awaiting_upload" && attachment\.canRemoveDraft/);
});

test("keeps the public and agent reservation validators separate", () => {
  assert.match(page, /function isRequesterSupportUploadReservationPayload/);
  assert.match(page, /function isAgentSupportUploadReservationPayload/);
  assert.match(page, /value\.upload === null[\s\S]*value\.duplicate/);
});
