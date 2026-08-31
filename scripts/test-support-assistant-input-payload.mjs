import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  parseSupportAssistantInput,
  SUPPORT_ASSISTANT_INPUT_LIMITS,
} from "../shared/support-assistant-input-policy.ts";

const route = readFileSync(new URL("../api/support/assistant.ts", import.meta.url), "utf8");
const page = readFileSync(new URL("../src/pages/prototype/LyceeConnectPrototype.tsx", import.meta.url), "utf8");

const validInput = {
  sessionId: "123e4567-e89b-42d3-a456-426614174000",
  messages: [
    { role: "assistant", content: "Bonjour, comment puis-je vous aider ?" },
    { role: "requester", content: "Je n’arrive plus à ouvrir mon ENT." },
  ],
  attachments: [{ name: "capture.png", type: "image/png", size: 12_000 }],
};

function alternatingRequesterConversation(turns) {
  const messages = [];
  for (let index = 0; index < turns; index += 1) {
    messages.push({ role: "requester", content: `Demande ${index + 1}` });
    if (index < turns - 1) messages.push({ role: "assistant", content: `Réponse ${index + 1}` });
  }
  return messages;
}

test("accepts one exact browser assistant input", () => {
  assert.deepEqual(SUPPORT_ASSISTANT_INPUT_LIMITS, {
    messages: 21,
    requesterTurns: 10,
    message: 1_500,
    conversation: 12_000,
    attachments: 5,
    attachmentName: 160,
    attachmentType: 100,
    attachmentBytes: 10 * 1024 * 1024,
  });
  assert.deepEqual(parseSupportAssistantInput(validInput), validInput);
  assert.deepEqual(parseSupportAssistantInput({
    sessionId: validInput.sessionId,
    messages: validInput.messages,
  }), { ...validInput, attachments: [] });
});

test("rejects unknown root and nested fields", () => {
  assert.equal(parseSupportAssistantInput({ ...validInput, institutionId: "hidden" }), null);
  assert.equal(parseSupportAssistantInput({
    ...validInput,
    messages: [{ ...validInput.messages[0], instruction: "hidden" }, validInput.messages[1]],
  }), null);
  assert.equal(parseSupportAssistantInput({
    ...validInput,
    attachments: [{ ...validInput.attachments[0], storagePath: "hidden" }],
  }), null);
});

test("requires an alternating conversation ending with one requester", () => {
  assert.equal(parseSupportAssistantInput({
    ...validInput,
    messages: [validInput.messages[0]],
  }), null);
  assert.equal(parseSupportAssistantInput({
    ...validInput,
    messages: [validInput.messages[1], { ...validInput.messages[1], content: "Encore" }],
  }), null);
  assert.notEqual(parseSupportAssistantInput({
    ...validInput,
    messages: alternatingRequesterConversation(10),
  }), null);
  assert.equal(parseSupportAssistantInput({
    ...validInput,
    messages: alternatingRequesterConversation(11),
  }), null);
});

test("bounds every message and the complete conversation", () => {
  assert.equal(parseSupportAssistantInput({
    ...validInput,
    messages: [{ role: "requester", content: "x".repeat(1_501) }],
  }), null);
  assert.equal(parseSupportAssistantInput({
    ...validInput,
    messages: Array.from({ length: 9 }, (_, index) => ({
      role: index % 2 === 0 ? "requester" : "assistant",
      content: "x".repeat(1_400),
    })),
  }), null);
  assert.deepEqual(parseSupportAssistantInput({
    ...validInput,
    messages: [{ role: "requester", content: "Besoin\0 ENT\nmerci" }],
  })?.messages, [{ role: "requester", content: "Besoin  ENT\nmerci" }]);
});

test("rejects rather than clamps invalid attachment metadata", () => {
  for (const attachment of [
    { ...validInput.attachments[0], name: "x".repeat(161) },
    { ...validInput.attachments[0], type: "application/octet-stream" },
    { ...validInput.attachments[0], size: 0 },
    { ...validInput.attachments[0], size: 12.5 },
    { ...validInput.attachments[0], size: SUPPORT_ASSISTANT_INPUT_LIMITS.attachmentBytes + 1 },
  ]) {
    assert.equal(parseSupportAssistantInput({ ...validInput, attachments: [attachment] }), null);
  }
});

test("parses and checks secrets before rate limits, registry reads and AI", () => {
  const parse = route.indexOf("const input = parseSupportAssistantInput(req.body)");
  const secret = route.indexOf("assertNoForbiddenSupportSecret(message.content)", parse);
  const rate = route.indexOf("await enforceAssistantRateLimits", secret);
  const actor = route.indexOf("await resolveKnowledgeActorFromRequest", rate);
  const provider = route.indexOf("await analyzeSupportConversation", actor);
  assert.ok(parse >= 0 && parse < secret && secret < rate && rate < actor && actor < provider);
  assert.doesNotMatch(route, /Math\.min\(record\.size|\.slice\(0, 160\)|\.slice\(0, 100\)/);
});

test("the browser sends only the documented input fields", () => {
  const call = page.slice(
    page.indexOf('apiFetch<unknown>("support/assistant"'),
    page.indexOf("if (!isAssistantApiResult(apiResult))")
  );
  assert.match(call, /sessionId: assistantSessionId/);
  assert.match(call, /messages: nextMessages\.slice\(-21\)\.map\(\(\{ role, content \}\) => \(\{ role, content \}\)\)/);
  assert.match(call, /attachments: files\.map\(\(file\) => \(\{ name: file\.name, type: file\.type, size: file\.size \}\)\)/);
});
