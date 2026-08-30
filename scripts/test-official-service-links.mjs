import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../src/pages/prototype/LyceeConnectPrototype.tsx", import.meta.url), "utf8");

test("keeps LyceeGest and its existing modules as contextual links", () => {
  assert.match(page, /const LYCEEGEST_URL = "\/login"/);
  assert.match(page, /title: "Stages de seconde"[\s\S]{0,260}href: "\/stages"/);
  assert.match(page, /title: "Grand Oral"[\s\S]{0,260}href: "\/grand-oral"/);
});

test("uses the official ministry information page for Scolarité Services", () => {
  assert.match(page, /const SCOLARITE_SERVICES_URL = "https:\/\/www\.education\.gouv\.fr\/scolarite-services-un-acces-unique-pour-toutes-les-demarches-scolaires-326158"/);
  assert.match(page, /title: "Scolarité Services"[\s\S]{0,360}href: SCOLARITE_SERVICES_URL/);
});

test("routes PRONOTE through the known ENT instead of inventing a school URL", () => {
  assert.match(page, /const ENT_URL = "https:\/\/ent\.iledefrance\.fr\/auth\/login"/);
  assert.match(page, /title: "PRONOTE via l’ENT"[\s\S]{0,360}href: ENT_URL/);
  assert.doesNotMatch(page, /https:\/\/[^"\s]*pronote/i);
});
