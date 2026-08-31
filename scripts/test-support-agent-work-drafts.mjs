import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  SUPPORT_AGENT_WORK_DRAFT_LIMIT,
  hasSupportAgentWorkDraft,
  readSupportAgentWorkDraft,
  writeSupportAgentWorkDraft,
} from "../shared/support-agent-work-drafts.ts";

const page = readFileSync(
  new URL("../src/pages/prototype/LyceeConnectPrototype.tsx", import.meta.url),
  "utf8"
);
const policy = readFileSync(
  new URL("../shared/support-agent-work-drafts.ts", import.meta.url),
  "utf8"
);

function code(index) {
  return `BC-2026-${String(index).padStart(6, "0")}`;
}

test("keeps independent drafts for each request in the current tab", () => {
  const store = new Map();
  writeSupportAgentWorkDraft(store, code(1), { reply: "Réponse une" });
  writeSupportAgentWorkDraft(store, code(2), { internalNote: "Note deux" });

  assert.equal(readSupportAgentWorkDraft(store, code(1)).reply, "Réponse une");
  assert.equal(readSupportAgentWorkDraft(store, code(1)).internalNote, "");
  assert.equal(readSupportAgentWorkDraft(store, code(2)).internalNote, "Note deux");
  assert.equal(hasSupportAgentWorkDraft(store, code(3)), false);
});

test("clears only the confirmed field and removes a fully empty draft", () => {
  const store = new Map();
  writeSupportAgentWorkDraft(store, code(1), {
    reply: "Réponse",
    internalNote: "Diagnostic",
  });
  writeSupportAgentWorkDraft(store, code(1), { reply: "" });

  assert.equal(readSupportAgentWorkDraft(store, code(1)).internalNote, "Diagnostic");
  assert.equal(hasSupportAgentWorkDraft(store, code(1)), true);

  writeSupportAgentWorkDraft(store, code(1), { internalNote: "   " });
  assert.equal(hasSupportAgentWorkDraft(store, code(1)), false);
});

test("bounds the memory to the most recent thirty requests", () => {
  const store = new Map();
  for (let index = 1; index <= SUPPORT_AGENT_WORK_DRAFT_LIMIT + 2; index += 1) {
    writeSupportAgentWorkDraft(store, code(index), { reply: `Réponse ${index}` });
  }

  assert.equal(store.size, SUPPORT_AGENT_WORK_DRAFT_LIMIT);
  assert.equal(hasSupportAgentWorkDraft(store, code(1)), false);
  assert.equal(hasSupportAgentWorkDraft(store, code(2)), false);
  assert.equal(hasSupportAgentWorkDraft(store, code(3)), true);
});

test("rejects malformed dossier numbers and oversized fields", () => {
  const store = new Map();
  assert.throws(
    () => writeSupportAgentWorkDraft(store, "OTHER-2026-000001", { reply: "Non" }),
    /public_code_invalid/
  );
  assert.throws(
    () => writeSupportAgentWorkDraft(store, code(1), { closureReason: "x".repeat(501) }),
    /field_invalid/
  );
});

test("uses memory only and clears text after the matching server confirmation", () => {
  assert.doesNotMatch(policy, /localStorage|sessionStorage|indexedDB|fetch\(/);
  assert.match(page, /const agentWorkDraftsRef = useRef<SupportAgentWorkDraftStore>\(new Map\(\)\)/);
  assert.match(page, /const workDraft = readSupportAgentWorkDraft\(agentWorkDraftsRef\.current, code\)/);
  assert.match(page, /setReply\(workDraft\.reply\)/);
  assert.match(page, /aria-label="Réponse à envoyer" rows=\{5\} maxLength=\{5000\}/);
  assert.match(page, /writeSupportAgentWorkDraft\(agentWorkDraftsRef\.current, selectedCode, \{ reply: "" \}\)/);
  assert.match(page, /writeSupportAgentWorkDraft\(agentWorkDraftsRef\.current, code, \{ internalNote: "" \}\)/);
  assert.match(page, /writeSupportAgentWorkDraft\(agentWorkDraftsRef\.current, code, \{ callbackOutcome: "" \}\)/);
  assert.match(page, /writeSupportAgentWorkDraft\(agentWorkDraftsRef\.current, selectedCode, \{ closureReason: "" \}\)/);

  const updateRequest = page.slice(
    page.indexOf("async function updateRequest"),
    page.indexOf("async function sendAgentReply")
  );
  const reply = page.slice(
    page.indexOf("async function sendAgentReply"),
    page.indexOf("async function selectAgentFiles")
  );
  const note = page.slice(
    page.indexOf("async function saveInternalNote"),
    page.indexOf("async function createCallback")
  );
  const callback = page.slice(
    page.indexOf("async function updateCallback"),
    page.indexOf("async function saveReplyTemplate")
  );

  assert.ok(updateRequest.indexOf("refreshedDetail.request.updatedAt") < updateRequest.indexOf("{ closureReason: \"\" }"));
  assert.ok(reply.indexOf("if (!persistedMessage)") < reply.indexOf("{ reply: \"\" }"));
  assert.ok(note.indexOf("if (!persistedNote)") < note.indexOf("{ internalNote: \"\" }"));
  assert.ok(callback.indexOf("if (!persistedCallback)") < callback.indexOf("{ callbackOutcome: \"\" }"));
});
