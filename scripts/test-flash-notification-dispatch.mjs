// LOT 3 du plan de publication publique — preuves de composition pour
// l'écriture des lignes `flash_notification_dispatches` par
// api/flash/proposals/[id]/publication.ts.
//
// La route n'est pas exercée ici (aucune pile PostgreSQL locale disponible
// dans ce shell ce soir, Docker Desktop indisponible — même constat que
// docs/operations/night-logs/PERSIST-LOT4.md) : ce script ne prouve donc PAS
// un comportement HTTP bout en bout ni une écriture réelle en base. Il :
// (1) rejoue, avec la fonction pure RÉELLEMENT importée par la route (jamais
//     une réimplémentation parallèle), les mêmes calculs qu'elle exécute ;
// (2) vérifie par lecture du fichier source que le statut écrit est
//     littéralement `simulated`, jamais `sent` ni une variable qui pourrait
//     l'être par erreur — c'est le point le plus délicat du LOT 3, une ligne
//     au mauvais statut casse silencieusement le calcul des trois ensembles
//     d'une future correction (shared/flash-audience-correction.ts).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { resolveFlashDispatchPlan } from "../shared/flash-dispatch-plan.ts";

const routeSource = readFileSync(
  new URL("../api/flash/proposals/[id]/publication.ts", import.meta.url),
  "utf8"
);

test("preuve de wiring : la route importe le module pur réel, ne réimplémente pas le calcul", () => {
  assert.match(
    routeSource,
    /import \{ resolveFlashDispatchPlan \} from "\.\.\/\.\.\/\.\.\/\.\.\/shared\/flash-dispatch-plan\.js";/
  );
});

test("preuve de wiring : chaque ligne écrite est au statut littéral 'simulated', jamais 'sent'", () => {
  assert.match(routeSource, /status:\s*"simulated"\s*as const/);
  assert.doesNotMatch(routeSource, /status:\s*"sent"/);
});

test("preuve de wiring : l'audience et les contacts SMS viennent des tables réelles de la version, jamais du corps de la requête", () => {
  assert.match(routeSource, /from\(flashInfoAudiences\)/);
  assert.match(routeSource, /from\(flashInfoSmsContacts\)/);
  assert.doesNotMatch(routeSource, /req\.body/);
});

test("preuve de wiring : aucun envoi réel — pas d'appel réseau ni de fournisseur", () => {
  assert.doesNotMatch(routeSource, /fetch\(/);
  assert.doesNotMatch(routeSource, /axios/i);
  assert.doesNotMatch(routeSource, /sendMail|sendGrid|twilio|nodemailer/i);
});

test("preuve de wiring : l'insertion est protégée par onConflictDoNothing (idempotence, republier ne double aucune ligne)", () => {
  assert.match(routeSource, /insert\(flashNotificationDispatches\)/);
  assert.match(routeSource, /\.onConflictDoNothing\(\)/);
});

test("preuve de wiring : la republication d'une version déjà 'publiee' retourne avant tout calcul de lignes d'envoi", () => {
  const alreadyPublishedIndex = routeSource.indexOf('current.status === "publiee"');
  const dispatchPlanIndex = routeSource.indexOf("resolveFlashDispatchPlan(");
  assert.ok(alreadyPublishedIndex > -1 && dispatchPlanIndex > -1);
  assert.ok(
    alreadyPublishedIndex < dispatchPlanIndex,
    "le retour anticipé 'déjà publiée' doit précéder le calcul des lignes d'envoi dans le texte de la route"
  );
});

// Rejoue, avec la fonction réellement importée par la route, le cas central
// du LOT 3 (§13) : normale -> rien ; importante -> push/email par groupe ;
// urgente -> push/email par groupe + sms par personne choisie, jamais par
// groupe.
test("le calcul réel produit exactement les lignes attendues pour une urgente avec sms", () => {
  const plan = resolveFlashDispatchPlan({
    importance: "urgente",
    channels: ["push", "email", "sms"],
    groupRefs: ["classe:2ndea"],
    smsContactRefs: ["contact:cpe-fictif-1234567"],
  });
  assert.deepEqual(plan, [
    { channel: "push", groupRef: "classe:2ndea", contactRef: null },
    { channel: "email", groupRef: "classe:2ndea", contactRef: null },
    { channel: "sms", groupRef: null, contactRef: "contact:cpe-fictif-1234567" },
  ]);
});
