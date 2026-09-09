import assert from "node:assert/strict";
import test from "node:test";
import { analyzeSupportConversation } from "../api/_shared/support-agent.ts";
import { routeSupportRequest } from "../shared/support-routing.ts";

process.env.OPENAI_API_KEY = "";
const message = (content) => ({ role: "requester", content });
const analyze = (messages) => analyzeSupportConversation({ messages, attachments: [], safetyIdentifier: "fictional-friction-test", knowledgeContextLoader: async () => "" });

test("meal registration and reservation retain catering context when tools are mentioned", async () => {
  for (const messages of [
    [message("Cantine"), message("Comment s’inscrire ?")],
    [message("Comment réserver le repas de mon enfant ?"), message("C’est une application ou via PRONOTE ?")],
    [message("J’ai perdu mon code de badge de cantine")],
  ]) {
    const result = await analyze(messages);
    assert.equal(result.category, "restauration_bourse");
    const route = routeSupportRequest({ category: result.category, description: messages.map(m => m.content).join("\n") });
    assert.equal(route.service, "intendance");
  }
});

test("a real digital login issue still belongs to the digital lead", async () => {
  const text = "Je ne peux plus me connecter à mon ENT pour consulter la cantine.";
  const result = await analyze([message(text)]);
  assert.equal(result.category, "ent");
  const route = routeSupportRequest({ category: result.category, description: text });
  assert.equal(route.service, "referent_numerique");
  assert.equal(route.requiredIdentity, "I3");
});

test("a generic catering category title cannot move a boarding request from administration", () => {
  const route = routeSupportRequest({ category: "restauration_bourse", subject: "Restauration, bourse, internat ou intendance", description: "Je voudrais des informations sur l’internat" });
  assert.equal(route.service, "administration");
});

test("informal missing-code requests are understood without repeating the diagnosis", async () => {
  for (const text of ["J’ai pas mais code ENT", "J’ai pas mes codes ENT", "Je n’ai plus mes codes pronotes"]) {
    const result = await analyze([message(text)]);
    assert.equal(result.category, "ent", text);
    assert.equal(result.readyToCreate, true, text);
    assert.equal(result.action, "offer_case", text);
    assert.match(result.reply, /ici/);
    assert.match(result.reply, /confirmation/);
    assert.doesNotMatch(result.reply, /formulaire|réinitialisé|déjà envoyé/);
  }
});

test("diploma requests are recognized as school documents", async () => {
  const result = await analyze([message("Je voudrais récupérer mon diplôme de CAP")]);
  assert.equal(result.category, "documents_scolarite");
  assert.equal(result.scope, "school_support");
});

test("model instructions preserve inline intake and protect the confirmation boundary", async (t) => {
  process.env.OPENAI_API_KEY = "fictional-key";
  t.after(() => { process.env.OPENAI_API_KEY = ""; });
  let payload;
  t.mock.method(globalThis, "fetch", async (_url, options) => {
    payload = JSON.parse(options.body);
    return new Response("{}", { status: 503 });
  });
  await analyze([message("Mon ENT ne marche pas")]);
  assert.match(payload.instructions, /parcours se déroule dans cette conversation/);
  assert.match(payload.instructions, /Ne redemande pas une information déjà donnée/);
  assert.doesNotMatch(payload.instructions, /ensuite propose le formulaire|termine par « Vérifiez vos coordonnées dans le formulaire/);
});
