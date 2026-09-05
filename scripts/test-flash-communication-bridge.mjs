// LOT 4 du plan de publication publique — preuves pour le pont pur
// (shared/flash-communication-bridge.ts) et pour son raccordement dans
// api/flash/proposals/[id]/publication.ts et
// api/_shared/flash-communication-bridge-persistence.ts.
//
// Aucune pile PostgreSQL locale disponible dans ce shell ce soir (Docker
// Desktop indisponible, même constat que les nuits précédentes) : ce script
// ne prouve donc PAS une écriture réelle en base. Il (1) exerce la fonction
// pure RÉELLEMENT importée par la route, jamais une réimplémentation
// parallèle, et (2) vérifie par lecture des fichiers source les invariants
// de câblage les plus délicats de ce lot : le drapeau
// `communication_settings.module_enabled` est lu AVANT toute insertion
// (jamais un try/catch autour d'un INSERT), et les tables `communications` /
// `communication_versions` sont vérifiées par lecture verrouillée avant
// d'être insérées, jamais réinsérées aveuglément via `onConflictDoNothing`
// (ce qui déclencherait les triggers de garde de la migration
// 20260830080000 sur une republication).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { buildFlashCommunicationBridgeRequest } from "../shared/flash-communication-bridge.ts";
import { resolveFlashDispatchPlan } from "../shared/flash-dispatch-plan.ts";

const VERSION_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_VERSION_ID = "22222222-2222-4222-8222-222222222222";

function baseInput(overrides = {}) {
  return {
    flashInfoVersionId: VERSION_ID,
    title: "Fermeture exceptionnelle du CDI",
    bodyMarkdown: "Le CDI ferme a 16h ce jeudi.",
    dispatchTargets: [],
    ...overrides,
  };
}

test("normale : le plan d'envoi est vide, le pont ne calcule rien", () => {
  const plan = resolveFlashDispatchPlan({
    importance: "normale",
    channels: [],
    groupRefs: ["classe:2ndea"],
    smsContactRefs: [],
  });
  assert.deepEqual(plan, []);
  const request = buildFlashCommunicationBridgeRequest(baseInput({ dispatchTargets: plan }));
  assert.equal(request, null);
});

test("importante, push seul choisi : aucune cible email, le pont renvoie null", () => {
  const plan = resolveFlashDispatchPlan({
    importance: "importante",
    channels: ["push"],
    groupRefs: ["classe:2ndea"],
    smsContactRefs: [],
  });
  const request = buildFlashCommunicationBridgeRequest(baseInput({ dispatchTargets: plan }));
  assert.equal(request, null);
});

test("importante, email choisi : le pont renvoie les group_ref triés et uniques", () => {
  const plan = resolveFlashDispatchPlan({
    importance: "importante",
    channels: ["push", "email"],
    groupRefs: ["classe:2ndeb", "classe:2ndea", "classe:2ndea"],
    smsContactRefs: [],
  });
  const request = buildFlashCommunicationBridgeRequest(baseInput({ dispatchTargets: plan }));
  assert.ok(request);
  assert.deepEqual(request.groupRefs, ["classe:2ndea", "classe:2ndeb"]);
});

test("urgente avec sms : les cibles sms n'entrent jamais dans le pont (canal non supporté par la file durable)", () => {
  const plan = resolveFlashDispatchPlan({
    importance: "urgente",
    channels: ["push", "email", "sms"],
    groupRefs: ["classe:2ndea"],
    smsContactRefs: ["contact:cpe-fictif-1234567"],
  });
  const request = buildFlashCommunicationBridgeRequest(baseInput({ dispatchTargets: plan }));
  assert.ok(request);
  assert.deepEqual(request.groupRefs, ["classe:2ndea"]);
});

test("empreinte source deterministe : meme version -> meme empreinte", () => {
  const plan = resolveFlashDispatchPlan({
    importance: "importante",
    channels: ["email"],
    groupRefs: ["classe:2ndea"],
    smsContactRefs: [],
  });
  const first = buildFlashCommunicationBridgeRequest(baseInput({ dispatchTargets: plan }));
  const second = buildFlashCommunicationBridgeRequest(baseInput({ dispatchTargets: plan }));
  assert.equal(first.sourceFingerprint, second.sourceFingerprint);
  assert.match(first.sourceFingerprint, /^[a-f0-9]{64}$/);
});

test("empreinte source distincte pour deux versions distinctes", () => {
  const plan = resolveFlashDispatchPlan({
    importance: "importante",
    channels: ["email"],
    groupRefs: ["classe:2ndea"],
    smsContactRefs: [],
  });
  const first = buildFlashCommunicationBridgeRequest(baseInput({ dispatchTargets: plan }));
  const second = buildFlashCommunicationBridgeRequest(
    baseInput({ flashInfoVersionId: OTHER_VERSION_ID, dispatchTargets: plan })
  );
  assert.notEqual(first.sourceFingerprint, second.sourceFingerprint);
});

test("empreinte de contenu changee si le titre change, meme audience", () => {
  const plan = resolveFlashDispatchPlan({
    importance: "importante",
    channels: ["email"],
    groupRefs: ["classe:2ndea"],
    smsContactRefs: [],
  });
  const first = buildFlashCommunicationBridgeRequest(baseInput({ dispatchTargets: plan }));
  const second = buildFlashCommunicationBridgeRequest(
    baseInput({ title: "Autre titre", dispatchTargets: plan })
  );
  assert.notEqual(first.contentHash, second.contentHash);
});

test("libelle source borne a 200 caracteres et refletant le titre normalise", () => {
  const plan = resolveFlashDispatchPlan({
    importance: "importante",
    channels: ["email"],
    groupRefs: ["classe:2ndea"],
    smsContactRefs: [],
  });
  const request = buildFlashCommunicationBridgeRequest(baseInput({ title: "  Fermeture exceptionnelle  ", dispatchTargets: plan }));
  assert.equal(request.sourceLabel, "Fermeture exceptionnelle");
  assert.ok(request.sourceLabel.length <= 200);
});

test("identifiant de version invalide est refuse", () => {
  const plan = resolveFlashDispatchPlan({
    importance: "importante",
    channels: ["email"],
    groupRefs: ["classe:2ndea"],
    smsContactRefs: [],
  });
  assert.throws(() => buildFlashCommunicationBridgeRequest(baseInput({ flashInfoVersionId: "pas-un-uuid", dispatchTargets: plan })));
});

const routeSource = readFileSync(
  new URL("../api/flash/proposals/[id]/publication.ts", import.meta.url),
  "utf8"
);
const persistenceSource = readFileSync(
  new URL("../api/_shared/flash-communication-bridge-persistence.ts", import.meta.url),
  "utf8"
);

test("preuve de wiring : la route importe les modules reels du pont, ne reimplemente rien", () => {
  assert.match(
    routeSource,
    /import \{ buildFlashCommunicationBridgeRequest \} from "\.\.\/\.\.\/\.\.\/\.\.\/shared\/flash-communication-bridge\.js";/
  );
  assert.match(
    routeSource,
    /import \{ persistFlashCommunicationBridge \} from "\.\.\/\.\.\/\.\.\/_shared\/flash-communication-bridge-persistence\.js";/
  );
});

test("preuve de wiring : le pont est appele apres la trace flash_notification_dispatches, jamais avant", () => {
  const dispatchInsertIndex = routeSource.indexOf("insert(flashNotificationDispatches)");
  const bridgeCallIndex = routeSource.indexOf("persistFlashCommunicationBridge(");
  assert.ok(dispatchInsertIndex > -1 && bridgeCallIndex > -1);
  assert.ok(dispatchInsertIndex < bridgeCallIndex);
});

test("preuve de wiring : la republication d'une version deja 'publiee' retourne avant tout appel au pont", () => {
  const alreadyPublishedIndex = routeSource.indexOf('current.status === "publiee"');
  const bridgeCallIndex = routeSource.indexOf("persistFlashCommunicationBridge(");
  assert.ok(alreadyPublishedIndex > -1 && bridgeCallIndex > -1);
  assert.ok(alreadyPublishedIndex < bridgeCallIndex);
});

test("preuve de wiring : le secret d'idempotence vient d'une variable d'environnement, jamais d'une valeur en dur", () => {
  assert.match(routeSource, /process\.env\.FLASH_COMMUNICATION_BRIDGE_HMAC_SECRET/);
});

test("preuve de wiring : le drapeau du module est lu AVANT toute insertion, jamais un try/catch autour d'un INSERT", () => {
  const settingsSelectIndex = persistenceSource.indexOf("from(communicationSettings)");
  const firstInsertIndex = persistenceSource.indexOf(".insert(communications)");
  assert.ok(settingsSelectIndex > -1 && firstInsertIndex > -1);
  assert.ok(settingsSelectIndex < firstInsertIndex);
  assert.doesNotMatch(persistenceSource, /try\s*\{[^}]*\.insert\(communications\)/s);
});

test("preuve de wiring : l'existence de 'communications'/'communication_versions' est verifiee par lecture verrouillee avant toute insertion, jamais un onConflictDoNothing aveugle", () => {
  const lockedSelectIndex = persistenceSource.indexOf('.for("update")');
  const firstInsertIndex = persistenceSource.indexOf(".insert(communications)");
  assert.ok(lockedSelectIndex > -1 && firstInsertIndex > -1);
  assert.ok(lockedSelectIndex < firstInsertIndex);
  const communicationsInsertBlock = persistenceSource.slice(
    firstInsertIndex,
    persistenceSource.indexOf(".insert(communicationVersions)")
  );
  assert.doesNotMatch(communicationsInsertBlock, /onConflictDoNothing/);
});

test("preuve de wiring : aucun envoi ni appel fournisseur dans le pont", () => {
  assert.doesNotMatch(persistenceSource, /fetch\(/);
  assert.doesNotMatch(persistenceSource, /axios/i);
  assert.doesNotMatch(persistenceSource, /sendMail|sendGrid|twilio|nodemailer|brevo/i);
});

test("preuve de wiring : le travail mis en file est du type 'prepare_delivery', jamais 'send_delivery'", () => {
  assert.match(persistenceSource, /jobType:\s*"prepare_delivery"/);
  assert.doesNotMatch(persistenceSource, /jobType:\s*"send_delivery"/);
});
