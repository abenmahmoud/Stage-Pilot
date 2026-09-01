import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const publicRoute = await readFile(
  new URL("../api/support/attachments/[id].ts", import.meta.url),
  "utf8"
);
const agentRoute = await readFile(
  new URL("../api/support/agent/attachments/[id].ts", import.meta.url),
  "utf8"
);

function accessEventBlock(source) {
  const start = source.lastIndexOf('eventType: "attachment.download_link_issued"');
  assert.notEqual(start, -1);
  return source.slice(start, source.indexOf("return payload", start));
}

test("audits requester download links only after scoped access and signing", () => {
  const access = publicRoute.indexOf("requireSupportAccess(req, code)");
  const rateLimit = publicRoute.indexOf("enforceAttachmentDownloadRateLimit(access.sessionId)");
  const scopedAttachment = publicRoute.indexOf(
    "eq(supportAttachments.requestId, access.requestId)",
    rateLimit
  );
  const signing = publicRoute.indexOf("createSignedUrl");
  const validation = publicRoute.indexOf("const payload = attachmentLinkPayload(data.signedUrl)", signing);
  const audit = publicRoute.indexOf('eventType: "attachment.download_link_issued"');
  const response = publicRoute.indexOf("return payload", audit);

  assert.ok(access >= 0 && access < rateLimit && rateLimit < scopedAttachment);
  assert.ok(scopedAttachment < signing && signing < validation && validation < audit && audit < response);
  assert.match(publicRoute, /actorType: "requester"/);
  assert.match(publicRoute, /actorId: access\.sessionId/);
});

test("audits agent download links only after institution and service checks", () => {
  const agentAccess = agentRoute.indexOf("requireSupportAgent(req)");
  const rateLimit = agentRoute.indexOf("enforceAgentAttachmentDownloadRateLimit(user.id)");
  const institutionScope = agentRoute.lastIndexOf("eq(supportRequests.institutionId, institutionId)");
  const serviceScope = agentRoute.lastIndexOf("assertSupportRequestAccess(access, attachment.assignedTeam)");
  const signing = agentRoute.indexOf("createSignedUrl");
  const validation = agentRoute.indexOf("const payload = attachmentLinkPayload(data.signedUrl)", signing);
  const audit = agentRoute.lastIndexOf('eventType: "attachment.download_link_issued"');
  const response = agentRoute.indexOf("return payload", audit);

  assert.ok(agentAccess >= 0 && agentAccess < rateLimit && rateLimit < institutionScope);
  assert.ok(institutionScope < serviceScope && serviceScope < signing);
  assert.ok(signing < validation && validation < audit && audit < response);
  assert.match(agentRoute, /actorType: "agent"/);
  assert.match(agentRoute, /actorId: user\.id/);
});

test("keeps filenames, storage paths and signed URLs out of access events", () => {
  for (const source of [publicRoute, agentRoute]) {
    const event = accessEventBlock(source);
    assert.match(event, /attachmentId: id/);
    assert.match(event, /direction: attachment\.direction/);
    assert.match(event, /expiresIn: 60/);
    assert.doesNotMatch(event, /originalName|storageBucket|storagePath|signedUrl/);
  }
});
