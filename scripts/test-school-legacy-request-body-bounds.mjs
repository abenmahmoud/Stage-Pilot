import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { parseEtablissementInput } from "../shared/etablissement-input.ts";

const routes = [
  ["établissement", "../api/etablissement.ts", "16kb"],
  ["affectation élève", "../api/admin/affectations-eleves.ts", "8kb"],
  ["affectation classe", "../api/admin/affectations-classes.ts", "8kb"],
  ["fiche Grand Oral", "../api/grand-oral/mine.ts", "32kb"],
  ["signature Grand Oral", "../api/grand-oral/[id]/sign.ts", "8kb"],
  ["stage élève", "../api/stages/mine.ts", "32kb"],
  ["stage agent", "../api/stages/[id].ts", "32kb"],
  ["livret de stage", "../api/stages/livret.ts", "128kb"],
];

test("borne les huit dernières mutations historiques", () => {
  for (const [label, relativePath, limit] of routes) {
    const source = readFileSync(new URL(relativePath, import.meta.url), "utf8");
    assert.match(
      source,
      new RegExp(`bodyParser: \\{ sizeLimit: "${limit}" \\}`),
      `${label} doit conserver sa limite ${limit}`
    );
    assert.match(source, /require(?:User|Role)\(req/);
  }
});

test("normalise les paramètres autorisés de l'établissement", () => {
  const result = parseEtablissementInput({
    id: "champ-ignoré",
    nom: " Lycée Test ",
    adresse: "1 rue du Test",
    codePostal: "93270",
    ville: "Sevran",
    telephone: "01 49 36 20 50",
    email: "CONTACT@EXAMPLE.TEST",
    uai: "0932048w",
    nomProviseur: "Direction",
    civiliteProviseur: "Mme",
    anneeScolaire: "2026-2027",
    dateStageDebut: "2027-06-14",
    dateStageFin: "2027-06-25",
    dateLimiteConvention: "2027-06-01",
    dateGoDebut: "2027-06-21",
    dateGoFin: "2027-07-02",
  });
  assert.equal(result.nom, "Lycée Test");
  assert.equal(result.email, "contact@example.test");
  assert.equal(result.uai, "0932048W");
  assert.equal(Object.hasOwn(result, "id"), false);
});

test("refuse les identifiants et périodes d'établissement invalides", () => {
  const valid = {
    nom: "Lycée Test",
    adresse: "1 rue du Test",
    codePostal: "93270",
    ville: "Sevran",
    telephone: null,
    email: null,
    uai: "0932048W",
    nomProviseur: "Direction",
    civiliteProviseur: "Mme",
    anneeScolaire: "2026-2027",
    dateStageDebut: "2027-06-14",
    dateStageFin: "2027-06-25",
    dateLimiteConvention: "2027-06-01",
    dateGoDebut: "2027-06-21",
    dateGoFin: "2027-07-02",
  };
  assert.throws(() => parseEtablissementInput({ ...valid, uai: "incorrect" }), /UAI/);
  assert.throws(
    () => parseEtablissementInput({ ...valid, dateStageFin: "2027-06-01" }),
    /période de stage/
  );
});

test("la route établissement ne persiste plus le corps brut", () => {
  const source = readFileSync(new URL("../api/etablissement.ts", import.meta.url), "utf8");
  assert.match(source, /parseEtablissementInput\(req\.body\)/);
  assert.doesNotMatch(source, /values\(body as/);
  assert.doesNotMatch(source, /body\.(?:id|logoUrl|cachetUrl)/);
});
