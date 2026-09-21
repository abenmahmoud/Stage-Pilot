import assert from "node:assert/strict";
import test from "node:test";
import {
  isSiteAssistantAction,
  siteNavigationAnswer,
  SITE_ASSISTANT_INSTRUCTIONS,
} from "../shared/assistant-site-guide.ts";

const conversation = (content) => [{ role: "requester", content }];

test("conduit vers les rubriques publiques avec une action claire", () => {
  const cases = [
    ["Où voir les actualités du lycée ?", "/?view=news"],
    ["Je veux ouvrir le calendrier", "/?view=calendar"],
    ["Comment retrouver mes demandes ?", "/?view=requests"],
    ["Ouvre le webmail du lycée", "https://mail.lycee-blaise-cendrars-sevran.fr/"],
    ["Je veux signaler un matériel de salle", "/materiel"],
    ["Où est le guide Chromebook ?", "/chromebook"],
    ["Mon Chromebook est en panne, quel SAV numérique ?", "/assistance-numerique"],
  ];
  for (const [message, href] of cases) {
    const result = siteNavigationAnswer(conversation(message));
    assert.ok(result, message);
    assert.equal(result.action.href, href);
    assert.equal(isSiteAssistantAction(result.action), true);
  }
});

test("explique l'installation de la PWA sans promettre une installation", () => {
  const result = siteNavigationAnswer(conversation("Comment installer le site sur mon téléphone ?"));
  assert.ok(result);
  assert.equal(result.action.href, "/");
  assert.match(result.reply, /iPhone|Installer/);
});

test("ne détourne pas une question générale vers une rubrique", () => {
  assert.equal(siteNavigationAnswer(conversation("Quelles sont les spécialités du lycée ?")), null);
  assert.equal(siteNavigationAnswer(conversation("Donne-moi mon emploi du temps")), null);
});

test("refuse les liens privés ou inventés dans une action", () => {
  const base = { label: "Ouvrir", description: "Description utile" };
  assert.equal(isSiteAssistantAction({ ...base, href: "/admin/contenus" }), false);
  assert.equal(isSiteAssistantAction({ ...base, href: "/gestion" }), false);
  assert.equal(isSiteAssistantAction({ ...base, href: "https://evil.example/" }), false);
});

test("la carte serveur interdit les espaces internes", () => {
  assert.match(SITE_ASSISTANT_INSTRUCTIONS, /Ne donne jamais une adresse \/admin, \/gestion, \/app ou \/intervention-spie/);
  assert.match(SITE_ASSISTANT_INSTRUCTIONS, /\/?\?view=requests/);
});
