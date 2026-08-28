import assert from "node:assert/strict";
import test from "node:test";
import { rewriteInternalContentLinks } from "./export-legacy-wordpress.mjs";

const contents = [
  {
    slug: "accueil-historique",
    sourceUrl: "https://lycee-blaise-cendrars-sevran.fr/",
    bodyMarkdown: [
      "[Page connue](https://lycee-blaise-cendrars-sevran.fr/specialites/)",
      "[Rubrique sans page](https://lycee-blaise-cendrars-sevran.fr/category/articles/)",
      "[Ancre accueil](https://lycee-blaise-cendrars-sevran.fr/#contact)",
      "[Lien externe](https://www.onisep.fr/)",
    ].join("\n"),
  },
  {
    slug: "specialites",
    sourceUrl: "https://lycee-blaise-cendrars-sevran.fr/specialites/",
    bodyMarkdown: "Contenu",
  },
];

test("réécrit uniquement les destinations WordPress correspondant à un contenu", () => {
  const [home] = rewriteInternalContentLinks(contents);
  assert.match(home.bodyMarkdown, /\[Page connue\]\(\/site\/specialites\)/);
  assert.match(home.bodyMarkdown, /\[Ancre accueil\]\(\/site\/accueil-historique#contact\)/);
  assert.match(home.bodyMarkdown, /\[Rubrique sans page\]\(https:\/\/lycee-blaise-cendrars-sevran\.fr\/category\/articles\/\)/);
  assert.match(home.bodyMarkdown, /\[Lien externe\]\(https:\/\/www\.onisep\.fr\/\)/);
  assert.doesNotMatch(home.bodyMarkdown, /accueil-historiquespecialites/);
});
