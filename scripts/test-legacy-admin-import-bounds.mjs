import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  LEGACY_IMPORT_MAX_ROWS,
  parseLegacyStudentImport,
  parseLegacyTeacherImport,
} from "../shared/legacy-import-input.ts";

const studentRoute = readFileSync(new URL("../api/import/eleves.ts", import.meta.url), "utf8");
const teacherRoute = readFileSync(new URL("../api/import/professeurs.ts", import.meta.url), "utf8");
const page = readFileSync(new URL("../src/pages/admin/ImportPage.tsx", import.meta.url), "utf8");

test("accepte un export lycée borné et retire les champs non utilisés", () => {
  const [student] = parseLegacyStudentImport({
    rows: [{
      nom: "  Martin  ",
      prenom: "Lina",
      classe: "2E1",
      emailEleve: "lina@example.test",
      status: "ok",
      secret: "non transmis",
    }],
  });
  assert.deepEqual(student, {
    nom: "Martin",
    prenom: "Lina",
    classe: "2E1",
    emailEleve: "lina@example.test",
    emailFamille: undefined,
    telephoneFamille: undefined,
    dateNaissance: undefined,
  });

  const [teacher] = parseLegacyTeacherImport({
    rows: [{ nom: "Durand", prenom: "Alex", matieres: "Mathématiques", status: "ok" }],
  });
  assert.equal(teacher.matieres, "Mathématiques");
  assert.equal(Object.hasOwn(teacher, "status"), false);
});

test("refuse trop de lignes et les champs démesurés", () => {
  const repeated = { nom: "Nom", prenom: "Prénom", classe: "2E1" };
  assert.throws(
    () => parseLegacyStudentImport({ rows: Array(LEGACY_IMPORT_MAX_ROWS + 1).fill(repeated) }),
    /5000 lignes/
  );
  assert.throws(
    () => parseLegacyTeacherImport({ rows: [{ nom: "x".repeat(101), prenom: "Prénom" }] }),
    /Nom ligne 1 est invalide/
  );
});

test("neutralise les caractères de contrôle avant persistance", () => {
  const [student] = parseLegacyStudentImport({
    rows: [{ nom: "Mar\u0000tin", prenom: "Li\u0007na", classe: "2E1" }],
  });
  assert.equal(student.nom, "Martin");
  assert.equal(student.prenom, "Lina");
});

test("applique les limites au navigateur et aux deux routes", () => {
  assert.match(page, /file\.size > LEGACY_IMPORT_MAX_FILE_BYTES/);
  assert.match(page, /data\.length > LEGACY_IMPORT_MAX_ROWS/g);
  for (const route of [studentRoute, teacherRoute]) {
    assert.match(route, /bodyParser: \{ sizeLimit: "5mb" \}/);
    assert.match(route, /parseLegacy(?:Student|Teacher)Import\(req\.body\)/);
  }
});
