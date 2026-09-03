import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  AGENT_CONTEXT_LIMITS,
  buildKnowledgeSearchQuery,
  selectAgentModelWindow,
} from "../shared/agent-context-window.ts";
import { knowledgeQueryTokens } from "../shared/knowledge-query.ts";
import { SUPPORT_ASSISTANT_INPUT_LIMITS } from "../shared/support-assistant-input-policy.ts";

const agentSource = readFileSync(new URL("../api/_shared/support-agent.ts", import.meta.url), "utf8");

function conversation(count) {
  const messages = [{ role: "requester", content: "Je n'arrive plus à accéder à l'ENT depuis lundi." }];
  for (let index = 1; index < count; index += 1) {
    messages.push({
      role: index % 2 === 1 ? "assistant" : "requester",
      content: "Message intermédiaire numéro " + index + ".",
    });
  }
  return messages;
}

test("constat reproduit : le code ne coupe plus la fenêtre à dix messages", () => {
  assert.ok(
    !agentSource.includes("input.messages.slice(-10)"),
    "la troncature à dix messages est revenue"
  );
  assert.ok(agentSource.includes("selectAgentModelWindow(input.messages)"));
});

test("la fenêtre du modèle suit ce que l'interface accepte", () => {
  assert.equal(AGENT_CONTEXT_LIMITS.maxMessages, SUPPORT_ASSISTANT_INPUT_LIMITS.messages);
  assert.equal(AGENT_CONTEXT_LIMITS.maxCharacters, SUPPORT_ASSISTANT_INPUT_LIMITS.conversation);
});

test("une conversation de vingt-et-un messages ne perd plus son besoin initial", () => {
  const messages = conversation(21);
  const window = selectAgentModelWindow(messages);
  assert.equal(window[0].content, messages[0].content);
  assert.equal(window[window.length - 1].content, messages[messages.length - 1].content);
  assert.ok(window.length > 10, "la fenêtre reste plus large que l'ancienne coupe à dix");
});

test("quand des messages sont sautés, le modèle en est averti", () => {
  const long = [
    { role: "requester", content: "Besoin initial : accès à l'ENT." },
    ...Array.from({ length: 8 }, (_unused, index) => ({
      role: index % 2 === 0 ? "assistant" : "requester",
      content: "x".repeat(400),
    })),
  ];
  const window = selectAgentModelWindow(long, { maxMessages: 21, maxCharacters: 1200 });
  assert.equal(window[0].content, long[0].content);
  assert.match(window[1].content, /message\(s\) plus ancien\(s\) non transmis/);
});

test("constat reproduit : la recherche ne part plus de la seule dernière phrase", () => {
  assert.ok(!agentSource.includes("query: latestRequesterMessage"));
  assert.ok(agentSource.includes("buildKnowledgeSearchQuery(input.messages)"));
});

test("une précision seule reste cherchable grâce au besoin initial", () => {
  const messages = [
    { role: "requester", content: "Je voudrais des informations sur la cantine." },
    { role: "assistant", content: "Bien sûr, que souhaitez-vous savoir ?" },
    { role: "requester", content: "Et pour le badge ?" },
  ];
  const built = buildKnowledgeSearchQuery(messages);
  assert.equal(built.topicChanged, false);
  assert.ok(built.query.includes("cantine"));
  assert.ok(built.query.includes("badge"));
  assert.ok(built.concepts.includes("restauration_scolaire"));
});

test("un changement de sujet ne traîne pas l'ancien", () => {
  const messages = [
    { role: "requester", content: "Je voudrais des informations sur la cantine." },
    { role: "assistant", content: "Je vous écoute." },
    { role: "requester", content: "En fait autre chose : j'ai oublié mon mot de passe ENT." },
  ];
  const built = buildKnowledgeSearchQuery(messages);
  assert.equal(built.topicChanged, true);
  assert.ok(built.concepts.includes("acces_numerique"));
  assert.ok(!built.concepts.includes("restauration_scolaire"));
});

test("constat reproduit : le normaliseur ne supprime plus les caractères arabes", () => {
  const tokens = knowledgeQueryTokens("أريد معلومات عن المطعم المدرسي");
  assert.ok(tokens.length > 0, "une question arabe ne produit plus zéro jeton");
});

test("préserver l'unicode ne suffit pas : les questions arabes atteignent le concept français", () => {
  const cases = [
    ["أريد معلومات عن المطعم المدرسي", "restauration_scolaire"],
    ["نسيت كلمة المرور الخاصة بي", "acces_numerique"],
    ["أين جدول الحصص", "emploi_temps"],
    ["أحتاج شهادة مدرسية", "document_scolarite"],
    ["ابني لديه غياب", "vie_scolaire"],
  ];
  for (const [question, concept] of cases) {
    assert.ok(
      knowledgeQueryTokens(question).includes(concept),
      question + " devrait atteindre " + concept
    );
  }
});

test("le français existant n'est pas modifié par la correction", () => {
  assert.deepEqual(
    knowledgeQueryTokens("Je ne peux plus accéder à l'ENT").sort(),
    ["acceder", "acces_numerique", "ent", "peux"]
  );
  assert.ok(knowledgeQueryTokens("cantine et demi pension").includes("restauration_scolaire"));
});

test("une conversation vide ne fabrique pas de requête", () => {
  assert.deepEqual(buildKnowledgeSearchQuery([]), { query: "", topicChanged: false, concepts: [] });
  assert.deepEqual(selectAgentModelWindow([]), []);
});

test("une conversation courte est transmise telle quelle", () => {
  // Ce cas a rattrapé une régression : ancrer sur le premier message du
  // demandeur ne doit pas faire disparaître ce qui le précède quand tout tient.
  const messages = [
    { role: "assistant", content: "Bonjour" },
    { role: "requester", content: "Mon ENT est bloqué depuis hier." },
  ];
  assert.deepEqual(selectAgentModelWindow(messages), messages);
});

test("le repère de troncature n'apparaît que lorsqu'il y a vraiment une coupe", () => {
  const messages = [
    { role: "assistant", content: "Bonjour" },
    { role: "requester", content: "Mon ENT est bloqué." },
    { role: "assistant", content: "Depuis quand ?" },
    { role: "requester", content: "Depuis hier." },
  ];
  const window = selectAgentModelWindow(messages);
  assert.ok(!window.some((message) => message.content.includes("non transmis")));
});
