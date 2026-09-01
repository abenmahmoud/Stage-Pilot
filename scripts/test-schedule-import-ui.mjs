import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(
  new URL("../src/pages/admin/ScheduleImportPage.tsx", import.meta.url),
  "utf8",
);

const checks = [
  ["la liste n'utilise pas de tableau horizontal", !/<table\b/i.test(source)],
  ["chaque ligne autorise la reduction de largeur", source.includes("grid min-w-0 gap-3")],
  ["les colonnes ne s'activent qu'a partir du petit ecran", source.includes("sm:grid-cols-[52px_minmax(0,1fr)_auto]")],
  ["les actions peuvent revenir a la ligne", /className="[^"]*\bflex\b[^"]*\bflex-wrap\b/.test(source)],
  ["le PDF prive est ouvert par un lien temporaire", source.includes("Ouvrir le PDF (60 s)")],
  ["une page verifiee possede son lien limite", source.includes("Ouvrir la page")],
  ["le lien de page est valide avant navigation", source.includes("parseSchedulePrivatePagePayload")],
  ["l'activation demande une confirmation explicite", source.includes('"ACTIVER"')],
  ["le retour arriere demande une confirmation explicite", source.includes('"RESTAURER"')],
  ["la direction choisit la date de recontrole", source.includes("À recontrôler avant le")],
  ["la consequence d'une source perimee est expliquee", source.includes("l'agent refuse de répondre")],
];

for (const [label, passed] of checks) {
  assert.equal(passed, true, label);
  console.log(`OK - ${label}`);
}

console.log(`${checks.length}/${checks.length} controles UI emploi du temps valides.`);
