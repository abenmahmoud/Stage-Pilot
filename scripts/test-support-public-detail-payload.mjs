import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { SUPPORT_PUBLIC_DETAIL_LIMITS } from "../shared/support-public-detail-limits.ts";
import {
  isValidSupportPublicDetailPayload,
  selectSupportPublicSubjectContext,
} from "../shared/support-public-detail-payload-policy.ts";

const page = readFileSync(new URL("../src/pages/prototype/LyceeConnectPrototype.tsx", import.meta.url), "utf8");
const route = readFileSync(new URL("../api/support/requests/[code].ts", import.meta.url), "utf8");

const messageId = "123e4567-e89b-42d3-a456-426614174001";
function fixtureUuid(index) {
  return `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
}

const validDetail = {
  request: {
    publicCode: "BC-2026-000101",
    requesterType: "parent",
    beneficiaryType: "eleve",
    subjectContext: { className: "2GT4", languagePreference: "fr" },
    category: "ent",
    subject: "Accès ENT",
    status: "en_cours",
    priority: "p3",
    preferredChannel: "email",
    createdAt: "2026-08-31T08:00:00.000Z",
    updatedAt: "2026-08-31T08:05:00.000Z",
    resolvedAt: null,
    identityStatus: "non_verifiee",
    identityMethod: null,
    identityVerifiedAt: null,
  },
  messages: [{
    id: messageId,
    direction: "inbound",
    channel: "web",
    authorLabel: "Demandeur",
    bodyText: "Je souhaite retrouver mon accès.",
    deliveryStatus: "stored",
    createdAt: "2026-08-31T08:00:00.000Z",
  }],
  attachments: [{
    id: "123e4567-e89b-42d3-a456-426614174002",
    messageId,
    direction: "requester",
    documentType: "capture",
    originalName: "capture-fictive.png",
    detectedMime: "image/png",
    sizeBytes: 12_000,
    scanStatus: "clean",
    canRemoveDraft: false,
    createdAt: "2026-08-31T08:01:00.000Z",
  }],
};

test("validates public request details before rendering", () => {
  const read = page.indexOf("const payload = await readApiResponse<unknown>(", page.indexOf("async function loadDetail(code: string)", page.indexOf("function ConnectedRequestsView")));
  const validation = page.indexOf("if (!isPublicSupportRequestDetailPayload(payload)", read);
  const replacement = page.indexOf("setDetail(payload)", validation);
  assert.notEqual(read, -1);
  assert.ok(read < validation);
  assert.ok(validation < replacement);
});

test("accepts one exact and bounded public detail", () => {
  assert.deepEqual(SUPPORT_PUBLIC_DETAIL_LIMITS, { messages: 500, attachments: 10 });
  assert.equal(isValidSupportPublicDetailPayload(validDetail), true);
});

test("rejects hidden fields, oversized values and unknown states", () => {
  assert.equal(isValidSupportPublicDetailPayload({ ...validDetail, sourceIpHash: "hidden" }), false);
  assert.equal(isValidSupportPublicDetailPayload({
    ...validDetail,
    request: { ...validDetail.request, identityVerifiedBy: "123e4567-e89b-42d3-a456-426614174099" },
  }), false);
  assert.equal(isValidSupportPublicDetailPayload({
    ...validDetail,
    messages: [{ ...validDetail.messages[0], bodyText: "x".repeat(5_001) }],
  }), false);
  assert.equal(isValidSupportPublicDetailPayload({
    ...validDetail,
    attachments: [{ ...validDetail.attachments[0], scanStatus: "unknown" }],
  }), false);
});

test("keeps internal context out of the public request", () => {
  assert.deepEqual(selectSupportPublicSubjectContext({
    className: "2GT4",
    languagePreference: "fr",
    internalSummaryFr: "Résumé réservé aux agents",
    routingReason: "Règle interne",
    identityVerifiedBy: "123e4567-e89b-42d3-a456-426614174099",
    closureReason: "Note interne de clôture",
  }), {
    className: "2GT4",
    languagePreference: "fr",
  });
  assert.equal(isValidSupportPublicDetailPayload({
    ...validDetail,
    request: {
      ...validDetail.request,
      subjectContext: { ...validDetail.request.subjectContext, internalSummaryFr: "interne" },
    },
  }), false);
  assert.match(route, /subjectContext: selectSupportPublicSubjectContext\(request\.subjectContext\)/);
});

test("rejects unordered, duplicated or dangling public history", () => {
  const laterMessage = {
    ...validDetail.messages[0],
    id: "123e4567-e89b-42d3-a456-426614174003",
    createdAt: "2026-08-31T08:02:00.000Z",
  };
  assert.equal(isValidSupportPublicDetailPayload({
    ...validDetail,
    messages: [laterMessage, validDetail.messages[0]],
  }), false);
  assert.equal(isValidSupportPublicDetailPayload({
    ...validDetail,
    messages: [validDetail.messages[0], validDetail.messages[0]],
  }), false);
  assert.equal(isValidSupportPublicDetailPayload({
    ...validDetail,
    attachments: [{ ...validDetail.attachments[0], messageId: "123e4567-e89b-42d3-a456-426614174099" }],
  }), false);
  assert.equal(isValidSupportPublicDetailPayload({
    ...validDetail,
    attachments: [
      {
        ...validDetail.attachments[0],
        id: "123e4567-e89b-42d3-a456-426614174004",
        createdAt: "2026-08-31T08:02:00.000Z",
      },
      validDetail.attachments[0],
    ],
  }), false);
});

test("rejects collections just above their shared public limit", () => {
  const messages = Array.from(
    { length: SUPPORT_PUBLIC_DETAIL_LIMITS.messages + 1 },
    (_, index) => ({
      ...validDetail.messages[0],
      id: fixtureUuid(1_000 + index),
    })
  );
  const attachments = Array.from(
    { length: SUPPORT_PUBLIC_DETAIL_LIMITS.attachments + 1 },
    (_, index) => ({
      ...validDetail.attachments[0],
      id: fixtureUuid(2_000 + index),
    })
  );
  assert.equal(isValidSupportPublicDetailPayload({ ...validDetail, messages }), false);
  assert.equal(isValidSupportPublicDetailPayload({ ...validDetail, attachments }), false);
});

test("rejects impossible identity and attachment states", () => {
  assert.equal(isValidSupportPublicDetailPayload({
    ...validDetail,
    request: {
      ...validDetail.request,
      identityStatus: "identite_confirmee",
      identityMethod: "phone_callback",
      identityVerifiedAt: "2026-08-31T08:04:00.000Z",
    },
  }), false);
  assert.equal(isValidSupportPublicDetailPayload({
    ...validDetail,
    attachments: [{
      ...validDetail.attachments[0],
      direction: "agent",
      messageId: null,
    }],
  }), false);
  assert.equal(isValidSupportPublicDetailPayload({
    ...validDetail,
    attachments: [{ ...validDetail.attachments[0], canRemoveDraft: true }],
  }), false);
});

test("delegates every public detail refresh to the shared runtime policy", () => {
  assert.match(page, /function isPublicSupportRequestDetailPayload\(value: unknown\): value is SupportRequestDetail \{\s*return isValidSupportPublicDetailPayload\(value\);/);
  assert.doesNotMatch(page, /function isPublicSupportMessage\(/);
  assert.doesNotMatch(page, /function isPublicSupportAttachment\(/);
});

test("bounds server reads and never returns a partial public conversation", () => {
  for (const collection of ["messages", "attachments"]) {
    assert.match(
      route,
      new RegExp(`\\.limit\\(SUPPORT_PUBLIC_DETAIL_LIMITS\\.${collection} \\+ 1\\)`)
    );
    assert.match(
      route,
      new RegExp(`assertCompletePublicDetailCollection\\([\\s\\S]*?SUPPORT_PUBLIC_DETAIL_LIMITS\\.${collection}`)
    );
  }
  assert.match(route, /Aucune conversation partielle n’a été affichée/);
  assert.match(route, /if \(!request\) throw new HttpError\(404, "Demande introuvable"\)/);
  assert.match(route, /eq\(supportContacts\.isVerified, true\),[\s\S]*?\.limit\(1\)/);
  assert.match(route, /orderBy\(asc\(supportAttachments\.createdAt\)\)/);
});

test("keeps public detail races and errors separate", () => {
  assert.match(page, /const detailLoadIdRef = useRef\(0\)/);
  assert.match(page, /loadId !== detailLoadIdRef\.current \|\| selectedCodeRef\.current !== code/);
  assert.match(page, /setDetailError\(/);
  assert.match(page, /Réessayer le dossier/);
  assert.match(page, /setDetail\(null\);\s+setDetailError\(null\);/);
});

test("shows the first requester message as the visible request summary", () => {
  assert.match(page, /detail\?\.messages\.find\(\(message\) => message\.direction === "inbound"\)/);
  assert.match(page, /className="lycee-request-summary" aria-label="Votre demande"/);
  assert.match(page, /<strong>Votre demande<\/strong><p>\{initialRequesterMessage\.bodyText\}<\/p>/);
});
