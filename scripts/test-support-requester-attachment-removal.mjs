import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync(
  new URL("../api/support/attachments/[id].ts", import.meta.url),
  "utf8"
);
const detailRoute = readFileSync(
  new URL("../api/support/requests/[code].ts", import.meta.url),
  "utf8"
);
const page = readFileSync(
  new URL("../src/pages/prototype/LyceeConnectPrototype.tsx", import.meta.url),
  "utf8"
);
const detailPolicy = readFileSync(
  new URL("../shared/support-public-detail-payload-policy.ts", import.meta.url),
  "utf8"
);

test("limits public removal to an owned terminal requester draft", () => {
  const access = route.indexOf("const access = await requireSupportAccess(req, code)");
  const removal = route.indexOf('if (req.method === "DELETE")', access);
  const candidate = route.indexOf("const [candidate]", removal);
  assert.ok(access >= 0 && access < removal && removal < candidate);
  assert.match(route, /REMOVABLE_REQUESTER_STATUSES = \["awaiting_upload", "blocked", "scan_error"\]/);
  assert.match(route, /candidate\.direction !== "requester"/);
  assert.match(route, /candidate\.uploadedBySession !== access\.sessionId/);
  assert.match(route, /eq\(supportAttachments\.uploadedBySession, access\.sessionId\)/);
  assert.match(route, /enforceAttachmentReservationRateLimit\(access\.sessionId\)/);
  assert.match(route, /bodyParser: false/);
  assert.doesNotMatch(route, /req\.body/);
  assert.match(route, /Un document déjà reçu par le lycée ne peut pas être retiré ici/);
});

test("replays one exact requester removal operation", () => {
  const replay = route.indexOf("eq(supportEvents.correlationId, removalOperationId)");
  const prepare = route.indexOf("const prepared = await db.transaction", replay);
  assert.ok(replay >= 0 && replay < prepare);
  assert.match(route, /operationEvent\.actorType !== "requester"/);
  assert.match(route, /operationEvent\.actorId !== access\.sessionId/);
  assert.match(route, /operationEvent\.attachmentId !== id/);
  assert.match(route, /eventType: "attachment\.draft_removed"[\s\S]*correlationId: removalOperationId/);
  assert.match(route, /eventType: "attachment\.draft_removal_reused"[\s\S]*correlationId: removalOperationId/);
});

test("marks, removes private storage and deletes under the request lock", () => {
  const mark = route.indexOf('scanStatus: "removal_pending"');
  const storage = route.indexOf(".remove([prepared.storagePath])", mark);
  const deletion = route.indexOf(".delete(supportAttachments)", storage);
  assert.ok(mark >= 0 && mark < storage && storage < deletion);
  assert.match(route, /scanStatus: "scan_error", scanDetail: "storage_removal_failed"/);
  assert.match(route, /eventType: "attachment\.draft_removal_failed"/);
  assert.doesNotMatch(route, /fromValue: \{[^}]*originalName/);
  assert.doesNotMatch(route, /toValue: \{[^}]*storagePath/);
});

test("exposes only the server-calculated removal capability", () => {
  assert.match(detailRoute, /uploadedBySession: supportAttachments\.uploadedBySession/);
  assert.match(detailRoute, /uploadedBySession === access\.sessionId/);
  assert.match(detailRoute, /\["awaiting_upload", "blocked", "scan_error", "removal_pending"\]\.includes\(attachment\.scanStatus\)/);
  assert.match(detailPolicy, /typeof value\.canRemoveDraft !== "boolean"/);
  assert.match(detailPolicy, /value\.direction === "agent"[\s\S]*!value\.canRemoveDraft/);
  assert.match(detailPolicy, /if \(value\.canRemoveDraft\)[\s\S]*REMOVABLE_REQUESTER_STATUSES/);
  assert.match(page, /attachment\.canRemoveDraft \? <button className="lycee-requester-file-remove"/);
});

test("keeps the browser key until receipt and exact absence are verified", () => {
  const removal = page.slice(
    page.indexOf("async function removeRequesterAttachment"),
    page.indexOf("async function forgetThisDevice")
  );
  const stableKey = removal.indexOf("requesterAttachmentRemovalSubmissionRef.current?.fingerprint !== submissionFingerprint");
  const request = removal.indexOf('method: "DELETE"', stableKey);
  const verify = removal.indexOf("verifySupportAttachmentRemovalConfirmation", request);
  const reread = removal.indexOf("const refreshedDetail", verify);
  const absence = removal.indexOf("refreshedDetail.attachments.some", reread);
  const clear = removal.indexOf("requesterAttachmentRemovalSubmissionRef.current = null", absence);
  assert.ok(
    stableKey >= 0
    && stableKey < request
    && request < verify
    && verify < reread
    && reread < absence
    && absence < clear
  );
  assert.match(removal, /headers: \{ "Idempotency-Key": idempotencyKey \}/);
  assert.match(removal, /submission\.attachmentId === id/);
  assert.match(page, /\[selectedCode\][\s\S]*setFollowupFiles\(\[\]\)/);
});
