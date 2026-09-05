// LOT 3 du plan de publication publique — preuve du calcul pur des lignes
// `flash_notification_dispatches` à écrire à la publication. Le statut
// (`simulated`) est décidé par l'appelant (la route), jamais ici : ce module
// ne calcule que QUI reçoit QUEL canal, avec QUELLE référence (groupe pour
// push/email, contact pour sms — jamais l'inverse, même contrainte que la
// colonne CHECK de `flash_notification_dispatches`).
import assert from "node:assert/strict";
import test from "node:test";

import { resolveFlashDispatchPlan } from "../shared/flash-dispatch-plan.ts";

test("normale n'écrit rien, même si des canaux ou une audience sont fournis par erreur", () => {
  const plan = resolveFlashDispatchPlan({
    importance: "normale",
    channels: ["push"],
    groupRefs: ["classe:2nde4"],
    smsContactRefs: ["contact:cpe-fictif-1234567"],
  });
  assert.deepEqual(plan, []);
});

test("importante avec push seul écrit une ligne par groupe, jamais de contact", () => {
  const plan = resolveFlashDispatchPlan({
    importance: "importante",
    channels: ["push"],
    groupRefs: ["classe:2ndea", "classe:1stmga"],
    smsContactRefs: [],
  });
  assert.deepEqual(plan, [
    { channel: "push", groupRef: "classe:1stmga", contactRef: null },
    { channel: "push", groupRef: "classe:2ndea", contactRef: null },
  ]);
});

test("importante avec push et email écrit deux lignes par groupe", () => {
  const plan = resolveFlashDispatchPlan({
    importance: "importante",
    channels: ["push", "email"],
    groupRefs: ["classe:2ndea"],
    smsContactRefs: [],
  });
  assert.deepEqual(plan, [
    { channel: "push", groupRef: "classe:2ndea", contactRef: null },
    { channel: "email", groupRef: "classe:2ndea", contactRef: null },
  ]);
});

test("urgente avec push, email et sms écrit une ligne par groupe pour push/email et une ligne par personne pour sms", () => {
  const plan = resolveFlashDispatchPlan({
    importance: "urgente",
    channels: ["push", "email", "sms"],
    groupRefs: ["classe:2ndea", "personnel:enseignants"],
    smsContactRefs: ["contact:cpe-fictif-1234567", "contact:vie-scolaire-fictive"],
  });
  const smsLines = plan.filter((line) => line.channel === "sms");
  const groupLines = plan.filter((line) => line.channel !== "sms");
  assert.equal(smsLines.length, 2, "une ligne sms par personne choisie, jamais par groupe");
  for (const line of smsLines) {
    assert.equal(line.groupRef, null, "sms ne porte jamais de group_ref (même contrainte que la colonne CHECK)");
    assert.notEqual(line.contactRef, null);
  }
  assert.equal(groupLines.length, 4, "2 groupes x (push + email)");
  for (const line of groupLines) {
    assert.equal(line.contactRef, null, "push/email ne portent jamais de contact_ref");
    assert.notEqual(line.groupRef, null);
  }
});

test("urgente avec push et email mais sans sms choisi n'écrit aucune ligne sms", () => {
  const plan = resolveFlashDispatchPlan({
    importance: "urgente",
    channels: ["push", "email"],
    groupRefs: ["classe:2ndea"],
    smsContactRefs: [],
  });
  assert.equal(plan.some((line) => line.channel === "sms"), false);
  assert.equal(plan.length, 2);
});

test("les groupes et contacts en double dans l'entrée ne produisent qu'une seule ligne chacun", () => {
  const plan = resolveFlashDispatchPlan({
    importance: "importante",
    channels: ["push"],
    groupRefs: ["classe:2ndea", "classe:2ndea"],
    smsContactRefs: [],
  });
  assert.equal(plan.length, 1);
});

test("le résultat est trié de façon déterministe, indépendamment de l'ordre d'entrée", () => {
  const planA = resolveFlashDispatchPlan({
    importance: "importante",
    channels: ["push"],
    groupRefs: ["classe:b", "classe:a"],
    smsContactRefs: [],
  });
  const planB = resolveFlashDispatchPlan({
    importance: "importante",
    channels: ["push"],
    groupRefs: ["classe:a", "classe:b"],
    smsContactRefs: [],
  });
  assert.deepEqual(planA, planB);
});

test("une importance inconnue est refusée (garde défensif, pas une seconde source de vérité)", () => {
  assert.throws(() =>
    resolveFlashDispatchPlan({
      importance: "critique",
      channels: [],
      groupRefs: [],
      smsContactRefs: [],
    })
  );
});
