import assert from "node:assert/strict";
import test from "node:test";
import { analyzeSupportConversation } from "../api/_shared/support-agent.ts";

process.env.OPENAI_API_KEY = "";

function messages(content) {
  return [
    { role: "assistant", content: "Bonjour" },
    { role: "requester", content },
  ];
}

test("offers a dossier when a school support request is complete", async () => {
  const result = await analyzeSupportConversation({
    messages: messages(
      "Je suis élève et je ne peux plus accéder à mon ENT depuis hier malgré plusieurs essais. Je dois consulter mon emploi du temps pour demain."
    ),
    attachments: [],
    safetyIdentifier: "test-session",
  });

  assert.equal(result.scope, "school_support");
  assert.equal(result.category, "ent");
  assert.equal(result.requesterType, "eleve");
  assert.equal(result.action, "offer_case");
  assert.equal(result.readyToCreate, true);
  assert.match(result.reply, /demande est prête/i);
});

test("asks for useful detail before offering an incomplete request", async () => {
  const result = await analyzeSupportConversation({
    messages: messages("Mon ENT ne marche pas"),
    attachments: [],
    safetyIdentifier: "test-session",
  });

  assert.equal(result.category, "ent");
  assert.equal(result.action, "continue");
  assert.equal(result.readyToCreate, false);
});

test("does not offer a dossier for a long unknown message", async () => {
  const result = await analyzeSupportConversation({
    messages: messages(
      "Je raconte une situation très longue sans expliquer clairement ce que je veux ni ce dont j’ai besoin aujourd’hui."
    ),
    attachments: [],
    safetyIdentifier: "test-session",
  });

  assert.equal(result.scope, "unknown");
  assert.equal(result.action, "continue");
});
