import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { reconcileActiveSupportNotification } from "../shared/support-active-notification.ts";

const base = {
  publicCode: "BC-2026-000123",
  status: "en_cours",
  updatedAt: "2026-08-30T07:00:00.000Z",
  latestAgentMessageId: "11111111-1111-4111-8111-111111111111",
};

test("établit une référence initiale sans notifier l'historique", () => {
  const result = reconcileActiveSupportNotification(null, base);
  assert.deepEqual(result, { snapshot: base, notification: null });
});

test("notifie une nouvelle réponse sans contenu ni identité", () => {
  const result = reconcileActiveSupportNotification(base, {
    ...base,
    updatedAt: "2026-08-30T07:01:00.000Z",
    latestAgentMessageId: "22222222-2222-4222-8222-222222222222",
  });
  assert.equal(result.notification?.reason, "agent_message");
  assert.equal(result.notification?.destination, "/prototype?view=requests");
  assert.doesNotMatch(result.notification?.body ?? "", /BC-|élève|parent|nom|objet/iu);
});

test("notifie un statut utile avec une formulation générique", () => {
  const result = reconcileActiveSupportNotification(base, {
    ...base,
    status: "attente_demandeur",
    updatedAt: "2026-08-30T07:02:00.000Z",
  });
  assert.equal(result.notification?.reason, "status_change");
  assert.match(result.notification?.body ?? "", /attend votre réponse/u);
});

test("ignore les répétitions, retours obsolètes et données invalides", () => {
  assert.equal(reconcileActiveSupportNotification(base, base).notification, null);
  const stale = reconcileActiveSupportNotification(base, {
    ...base,
    status: "nouveau",
    updatedAt: "2026-08-30T06:59:59.000Z",
  });
  assert.deepEqual(stale, { snapshot: base, notification: null });
  const invalid = reconcileActiveSupportNotification(base, {
    ...base,
    publicCode: "../../secret",
    status: "inconnu",
  });
  assert.deepEqual(invalid, { snapshot: base, notification: null });
});

test("garde l'activation volontaire et la navigation sans dossier dans l'URL", async () => {
  const page = await readFile(
    new URL("../src/pages/prototype/LyceeConnectPrototype.tsx", import.meta.url),
    "utf8"
  );
  const worker = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");
  const activation = page.slice(
    page.indexOf("async function toggleActiveNotifications"),
    page.indexOf("async function forgetThisDevice")
  );
  assert.match(activation, /Notification\.requestPermission\(\)/u);
  assert.match(activation, /Les alertes ne peuvent pas être activées/u);
  assert.match(activation, /notificationsEnabledRef\.current/u);
  assert.doesNotMatch(page.slice(page.indexOf("function ConnectedRequestsView"), page.indexOf("async function toggleActiveNotifications")), /Notification\.requestPermission\(\)/u);
  assert.match(worker, /notificationclick/u);
  assert.match(worker, /\/prototype\?view=requests/u);
  assert.doesNotMatch(worker, /ticket=|publicCode/u);
});

test("refuse un détail qui ne correspond pas au dossier demandé", async () => {
  const page = await readFile(
    new URL("../src/pages/prototype/LyceeConnectPrototype.tsx", import.meta.url),
    "utf8"
  );
  assert.match(page, /payload\.request\.publicCode !== code/u);
  assert.match(page, /réponse du service est incohérente/u);
});
