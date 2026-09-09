import assert from "node:assert/strict";
import test from "node:test";
import { latestRequesterMessage, supportRequestFocus } from "../shared/support-request-focus.ts";

const base = { status: "en_cours", needsIdentity: false, duplicatePending: false, callbackPending: false, assigned: true };

test("latest request is chronological, excludes notes and automatic replies, and leaves history intact", () => {
  const messages = Object.freeze([
    { direction: "inbound", createdAt: "2026-09-09T12:00:00Z", bodyText: "Le code ne fonctionne toujours pas." },
    { direction: "internal", createdAt: "2026-09-09T14:00:00Z", bodyText: "À vérifier." },
    { direction: "outbound", createdAt: "2026-09-09T13:00:00Z", bodyText: "Réponse automatique." },
    { direction: "inbound", createdAt: "2026-09-09T10:00:00Z", bodyText: "Première question." },
  ]);
  assert.equal(latestRequesterMessage(messages), messages[0]);
  assert.equal(latestRequesterMessage(messages.filter(m => m.direction !== "inbound")), null);
  assert.equal(latestRequesterMessage([]), null);
});

test("a closed sensitive case first points to its closure, never a new reply", () => {
  assert.equal(supportRequestFocus({ ...base, status: "clos", needsIdentity: true }).section, "notes");
});

test("identity remains ahead of assignment, duplicate review and phone callbacks", () => {
  const action = supportRequestFocus({ ...base, needsIdentity: true, assigned: false, duplicatePending: true, callbackPending: true });
  assert.equal(action.title, "Identité à vérifier");
  assert.equal(action.section, "management");
});

test("waiting status never asserts that the latest question has been answered", () => {
  for (const status of ["attente_demandeur", "attente_interne"]) {
    const action = supportRequestFocus({ ...base, status });
    assert.equal(action.section, "history");
    assert.match(action.detail, /Relisez les derniers échanges/);
  }
});

test("possible duplicates lead to human comparison, not merging or closing", () => {
  assert.equal(supportRequestFocus({ ...base, duplicatePending: true }).label, "Examiner le rapprochement");
  assert.equal(supportRequestFocus({ ...base, status: "resolu" }).section, "notes");
  assert.equal(supportRequestFocus(base).section, "reply");
});
