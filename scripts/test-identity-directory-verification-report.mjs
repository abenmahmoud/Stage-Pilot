import assert from "node:assert/strict";
import { parseIdentityDirectoryBytes } from "../workers/identity-directory-parser.mjs";
import {
  IdentityDirectoryVerificationError,
  verifyIdentityDirectoryReport,
} from "../workers/identity-directory-verification-report.mjs";

const parsed = parseIdentityDirectoryBytes({
  bytes: Buffer.from(`type_ligne,reference_personne,type_personne,nom,prenom,date_naissance,reference_classe,email,telephone,type_relation,reference_sujet,reference_objet,valide_depuis,valide_jusquau,source,commentaire,actif
person,STU-DEMO-201,student,Fictif,Eleve,2010-04-02,2D1,eleve.201@example.test,,,,,2026-09-01,2027-08-31,ent,Donnee fictive,true
person,RESP-DEMO-201,guardian,Fictif,Responsable,,,responsable.201@example.test,+33600000201,,,,2026-09-01,2027-08-31,ent,Donnee fictive,true
relationship,,,,,,,,,guardian_of,RESP-DEMO-201,STU-DEMO-201,2026-09-01,2027-08-31,siecle,Donnee fictive,true`, "utf8"),
  fileName: "annuaire_import.csv",
  contactPepper: "0123456789abcdef0123456789abcdef",
});

const report = Buffer.from(`Rapport de verification fictif
lignes_total=3
personnes=2
relations=1
references_orphelines=0
doublons_reference_personne=0
classes_distinctes=1
colonnes_interdites=0
codes_detectes=0
Liste des reference_classe : 2D1`, "utf8");
const verified = verifyIdentityDirectoryReport({ bytes: report, parsed });
assert.equal(verified.matches, true);
assert.deepEqual(verified.mismatchCodes, []);
assert.equal(verified.reported.personCount, 2);

const mismatch = verifyIdentityDirectoryReport({
  bytes: Buffer.from(report.toString("utf8").replace("personnes=2", "personnes=3"), "utf8"),
  parsed,
});
assert.equal(mismatch.matches, false);
assert.ok(mismatch.mismatchCodes.includes("mismatch_personCount"));

const missingClass = verifyIdentityDirectoryReport({
  bytes: Buffer.from(report.toString("utf8").replace(" : 2D1", " : 2D2"), "utf8"),
  parsed,
});
assert.ok(missingClass.mismatchCodes.includes("class_list_mismatch"));

assert.throws(
  () => verifyIdentityDirectoryReport({
    bytes: Buffer.from(`${report.toString("utf8")}\nMot de passe: valeur-fictive-interdite`, "utf8"),
    parsed,
  }),
  (error) => error instanceof IdentityDirectoryVerificationError
    && error.code === "verification_report_secret_forbidden"
    && !error.message.includes("valeur-fictive-interdite")
);

console.log("identity directory verification report: 4/4 checks passed");
