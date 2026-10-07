import assert from "node:assert/strict";
import { SCHOOL_CONTINUITY, SCHOOL_CONTINUITY_REPLY, SCHOOL_CONTINUITY_TOOLS } from "../shared/school-continuity.ts";
import { isSiteAssistantAction, siteNavigationAnswer } from "../shared/assistant-site-guide.ts";

for (const message of ["L’ENT est en panne, comment suivre le cours ?", "MonLycée.net ne fonctionne plus", "Comment travailler sans l’ENT ?", "L’ENT est inaccessible"]) {
  const answer=siteNavigationAnswer([{role:"requester",content:message}]);
  assert.ok(answer, message);
  assert.equal(answer.action.href,"/?view=continuity");
  assert.ok(isSiteAssistantAction(answer.action));
  assert.match(answer.reply,/liens.*transmis par votre professeur/);
  assert.match(answer.reply,/Nuage/);
  assert.doesNotMatch(answer.reply,/login=true|identifiant.*mot de passe provisoire/);
}
assert.equal(siteNavigationAnswer([{role:"requester",content:"J’ai oublié mon mot de passe ENT"}]),null);
assert.equal(siteNavigationAnswer([{role:"requester",content:"Mon ordinateur est en panne"}]),null);
assert.ok(!("pronoteDirect" in SCHOOL_CONTINUITY_TOOLS));
assert.equal(SCHOOL_CONTINUITY.status, "En cas de besoin");
for (const value of [SCHOOL_CONTINUITY.status, SCHOOL_CONTINUITY.title, SCHOOL_CONTINUITY.summary, SCHOOL_CONTINUITY_REPLY]) {
  assert.doesNotMatch(value, /fermé|fermeture|jeudi|octobre|\d{1,2}/i);
}
for (const question of ["Est-ce que le lycée est ouvert aujourd’hui ?", "Le lycée est-il fermé ?"]) {
  assert.equal(siteNavigationAnswer([{ role: "requester", content: question }]), null);
}
console.log("Secours ENT : réponse guidée sans accès privé ni connexion PRONOTE inventée.");
