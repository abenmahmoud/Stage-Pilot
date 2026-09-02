import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyAssistantUserDecision,
  pendingAssistantActionFromReply,
  resolveAssistantConversationTransition,
} from "../shared/assistant-conversation-state.ts";

function offeredConversation(answer) {
  return [
    { role: "assistant", content: "Bonjour, je suis l’assistant du lycée." },
    { role: "requester", content: "Quel est le nom de la proviseure ?" },
    {
      role: "assistant",
      content: "Voulez-vous que je vous aide à rédiger une demande auprès de l’accueil du lycée ?",
    },
    { role: "requester", content: answer },
  ];
}

test("recognizes common explicit confirmations without accepting unrelated text", () => {
  for (const answer of ["oui", "ouii", "d’accord", "vas-y", "je confirme", "faites-le"]) {
    assert.equal(classifyAssistantUserDecision(answer), "accept", answer);
  }
  assert.equal(classifyAssistantUserDecision("oui, mais je veux changer le sujet"), "unknown");
  assert.equal(classifyAssistantUserDecision("peut-être"), "unknown");
});

test("recognizes explicit refusals", () => {
  for (const answer of ["non", "non merci", "pas maintenant", "laissez tomber"]) {
    assert.equal(classifyAssistantUserDecision(answer), "decline", answer);
  }
});

test("detects request and human-transfer offers in assistant replies", () => {
  assert.equal(
    pendingAssistantActionFromReply("Voulez-vous que je prépare une demande pour l’accueil ?"),
    "create_request"
  );
  assert.equal(
    pendingAssistantActionFromReply("Je peux préparer une demande urgente pour un agent humain."),
    "human_transfer"
  );
  assert.equal(pendingAssistantActionFromReply("Je vous conseille de contacter l’accueil."), null);
});

test("turns an accepted offer into one explicit conversation transition", () => {
  assert.deepEqual(resolveAssistantConversationTransition(offeredConversation("oui")), {
    stage: "action_confirmed",
    pendingAction: "create_request",
    decision: "accept",
  });
});

test("keeps a declined offer out of the request workflow", () => {
  assert.deepEqual(resolveAssistantConversationTransition(offeredConversation("non merci")), {
    stage: "action_declined",
    pendingAction: "create_request",
    decision: "decline",
  });
});

test("does not invent a pending action after an ordinary informational reply", () => {
  const transition = resolveAssistantConversationTransition([
    { role: "assistant", content: "Bonjour." },
    { role: "requester", content: "Bonjour" },
    { role: "assistant", content: "Comment puis-je vous aider ?" },
    { role: "requester", content: "oui" },
  ]);
  assert.equal(transition.stage, "gathering");
  assert.equal(transition.pendingAction, null);
});
