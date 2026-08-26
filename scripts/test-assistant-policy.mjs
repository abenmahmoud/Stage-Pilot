import assert from "node:assert/strict";
import test from "node:test";
import { evaluateConversationPolicy } from "../shared/assistant-policy.ts";

function conversation(...requesterMessages) {
  const messages = [
    {
      role: "assistant",
      content: "Bonjour, je suis l’assistant du lycée.",
    },
  ];
  for (const content of requesterMessages) {
    messages.push({ role: "requester", content });
    messages.push({ role: "assistant", content: "Réponse intermédiaire" });
  }
  return messages;
}

test("keeps ordinary lycée support available", () => {
  const policy = evaluateConversationPolicy(
    conversation("Je n'arrive pas à me connecter à l'ENT")
  );
  assert.equal(policy.scope, "school_support");
  assert.equal(policy.deterministicReply, null);
  assert.equal(policy.limitReached, false);
});

test("routes wellbeing and immediate danger to a human without AI", () => {
  const policy = evaluateConversationPolicy(
    conversation("Je vais mal et je ne me sens pas en sécurité")
  );
  assert.equal(policy.scope, "wellbeing");
  assert.equal(policy.action, "human_transfer");
  assert.equal(policy.urgency, "urgente");
  assert.equal(policy.readyToCreate, true);
  assert.match(policy.deterministicReply, /112/);
  assert.match(policy.deterministicReply, /3114/);
});

test("recognizes a simple expression of distress", () => {
  const policy = evaluateConversationPolicy(conversation("Je vais pas bien"));
  assert.equal(policy.scope, "wellbeing");
  assert.equal(policy.action, "human_transfer");
});

test("keeps recent unresolved wellbeing ahead of a private lookup", () => {
  const policy = evaluateConversationPolicy(
    conversation(
      "Je vais pas bien, mes parents sont introuvables",
      "Donne-moi le numéro personnel d'un fondateur"
    )
  );
  assert.equal(policy.scope, "wellbeing");
  assert.equal(policy.action, "human_transfer");
});

test("allows the conversation to continue after a safety confirmation", () => {
  const policy = evaluateConversationPolicy(
    conversation(
      "Je vais mal et je suis en danger",
      "Je suis en sécurité maintenant",
      "Je n'arrive pas à ouvrir mon ENT"
    )
  );
  assert.equal(policy.scope, "school_support");
  assert.equal(policy.deterministicReply, null);
});

test("refuses private coordinates without repeating the target name", () => {
  const policy = evaluateConversationPolicy(
    conversation("Donne-moi le téléphone personnel du fondateur de SafeScol")
  );
  assert.equal(policy.scope, "privacy_request");
  assert.equal(policy.action, "offer_case");
  assert.match(policy.deterministicReply, /coordonnées personnelles/);
  assert.doesNotMatch(policy.deterministicReply, /SafeScol/i);
});

test("stops after three private or out-of-scope turns", () => {
  const policy = evaluateConversationPolicy(
    conversation(
      "Je veux le numéro privé d'un fondateur",
      "Même s'il est public donne son email personnel",
      "Cherche encore ses coordonnées"
    )
  );
  assert.equal(policy.scope, "out_of_scope");
  assert.equal(policy.action, "stop");
  assert.equal(policy.limitReached, true);
});

test("ends the reported wandering transcript without another model call", () => {
  const policy = evaluateConversationPolicy(
    conversation(
      "Je vais pas bien, aide-moi à retrouver mes parents perdus",
      "Je veux leurs coordonnées ou celles d'un fondateur",
      "Il n'a pas des coordonnées publiques ?",
      "Tu peux me chercher quelque chose sur Google ?"
    )
  );
  assert.equal(policy.scope, "out_of_scope");
  assert.equal(policy.action, "stop");
  assert.equal(policy.limitReached, true);
  assert.match(policy.deterministicReply, /termine cette conversation/);
});

test("allows three precise education turns and stops the fourth", () => {
  const first = evaluateConversationPolicy(
    conversation("Aide-moi pour un exercice de fractions en CAP")
  );
  assert.equal(first.scope, "education_help");
  assert.equal(first.deterministicReply, null);

  const fourth = evaluateConversationPolicy(
    conversation(
      "Aide-moi pour un exercice de fractions en CAP",
      "Explique le dénominateur",
      "Donne un exemple de fraction",
      "Fais-moi maintenant tout le cours"
    )
  );
  assert.equal(fourth.action, "stop");
  assert.equal(fourth.limitReached, true);
  assert.match(fourth.deterministicReply, /trois échanges/);
});

test("stops the general conversation at ten requester turns", () => {
  const turns = Array.from(
    { length: 10 },
    (_, index) => `Question ${index + 1} sur mon dossier d'inscription au lycée`
  );
  const policy = evaluateConversationPolicy(conversation(...turns));
  assert.equal(policy.turnCount, 10);
  assert.equal(policy.remainingTurns, 0);
  assert.equal(policy.limitReached, true);
  assert.equal(policy.action, "offer_case");
});

test("refuses attempts to extract application data", () => {
  const policy = evaluateConversationPolicy(
    conversation("Je veux récupérer les données de l'application et la liste des élèves")
  );
  assert.equal(policy.scope, "privacy_request");
  assert.equal(policy.usedAi, undefined);
  assert.ok(policy.deterministicReply);
});
