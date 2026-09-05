import assert from "node:assert/strict";
import test from "node:test";

import {
  VAULT_SERVICES,
  VAULT_CODE_STATUSES,
  isLegalVaultTransition,
  applyVaultCodeEvent,
  VaultTransitionError,
  vaultAssignmentKey,
  hasConflictingActiveVaultAssignment,
  buildModelVisibleVaultFact,
  decideVaultAccess,
  VAULT_PROFILE_ROLES,
} from "../shared/code-vault-policy.ts";

const INSTITUTION = "institution-1";
const AUTRE_INSTITUTION = "institution-2";

test("les services couverts sont ent, cantine, koxo — pas la messagerie académique", () => {
  assert.deepEqual([...VAULT_SERVICES], ["ent", "cantine", "koxo"]);
});

test("le cycle de vie n'autorise que la progression stricte", () => {
  assert.deepEqual([...VAULT_CODE_STATUSES], ["disponible", "reserve", "remis", "utilise"]);

  assert.equal(isLegalVaultTransition("disponible", "reserve"), true);
  assert.equal(isLegalVaultTransition("reserve", "remis"), true);
  assert.equal(isLegalVaultTransition("remis", "utilise"), true);

  assert.equal(isLegalVaultTransition("disponible", "utilise"), false, "saut interdit");
  assert.equal(isLegalVaultTransition("reserve", "utilise"), false, "saut interdit");
  assert.equal(isLegalVaultTransition("utilise", "disponible"), false, "pas de retour en arrière en LOT 1");
  assert.equal(isLegalVaultTransition("remis", "reserve"), false);
});

test("une consultation seule ne fait jamais progresser le statut", () => {
  for (const status of VAULT_CODE_STATUSES) {
    assert.equal(applyVaultCodeEvent(status, { kind: "consult" }), status);
  }
});

test("seul un contrôle d'activation réel ou une validation autorisée marque `utilise`, et seulement depuis `remis`", () => {
  assert.equal(applyVaultCodeEvent("remis", { kind: "activation_confirmed" }), "utilise");
  assert.equal(applyVaultCodeEvent("remis", { kind: "authorized_validation" }), "utilise");

  for (const status of ["disponible", "reserve", "utilise"]) {
    assert.throws(
      () => applyVaultCodeEvent(status, { kind: "activation_confirmed" }),
      (error) => error instanceof VaultTransitionError && error.reason === "illegal_transition_to_utilise"
    );
    assert.throws(
      () => applyVaultCodeEvent(status, { kind: "authorized_validation" }),
      (error) => error instanceof VaultTransitionError
    );
  }
});

test("une seule attribution active par quadruplet personne/service/année/version", () => {
  const base = {
    institutionId: INSTITUTION,
    personRef: "eleve-1",
    service: "cantine",
    schoolYear: "2026-2027",
    version: 1,
  };
  const identique = { ...base };
  const autreVersion = { ...base, version: 2 };
  const autrePersonne = { ...base, personRef: "eleve-2" };

  assert.equal(vaultAssignmentKey(base), vaultAssignmentKey(identique));
  assert.notEqual(vaultAssignmentKey(base), vaultAssignmentKey(autreVersion));

  assert.equal(hasConflictingActiveVaultAssignment(identique, [base]), true);
  assert.equal(hasConflictingActiveVaultAssignment(autreVersion, [base]), false);
  assert.equal(hasConflictingActiveVaultAssignment(autrePersonne, [base]), false);
  assert.equal(hasConflictingActiveVaultAssignment(base, []), false);
});

test("le fait visible par le modèle ne peut structurellement pas porter la valeur du code", () => {
  const internalRecordAvecValeur = {
    service: "koxo",
    status: "remis",
    valeur: "AB12-CD34",
    value: "AB12-CD34",
  };

  const fact = buildModelVisibleVaultFact({
    service: internalRecordAvecValeur.service,
    status: internalRecordAvecValeur.status,
    validationRequired: false,
    deliveryAuthorized: true,
    refusalReason: null,
    receipt: null,
  });

  const serialized = JSON.stringify(fact);
  assert.equal(serialized.includes("AB12-CD34"), false, "aucune valeur de code ne doit apparaître");
  assert.deepEqual(Object.keys(fact).sort(), [
    "deliveryAuthorized",
    "receipt",
    "refusalReason",
    "service",
    "status",
    "validationRequired",
  ]);
});

test("même étalé depuis un enregistrement interne portant une valeur, le fait construit reste propre", () => {
  const interneAvecValeur = {
    service: "ent",
    status: "utilise",
    validationRequired: false,
    deliveryAuthorized: true,
    refusalReason: null,
    receipt: null,
    value: "SECRET-NE-DOIT-PAS-SORTIR",
  };

  // Étaler l'interne dans l'entrée ne fait pas fuiter la valeur en sortie :
  // `buildModelVisibleVaultFact` reconstruit toujours un littéral explicite.
  const fact = buildModelVisibleVaultFact(interneAvecValeur);
  assert.equal(JSON.stringify(fact).includes("SECRET-NE-DOIT-PAS-SORTIR"), false);
});

test("élève : son propre code, jamais celui d'un autre", () => {
  const actor = { profile: "eleve", personRef: "eleve-1", institutionId: INSTITUTION };

  const soi = decideVaultAccess({
    actor,
    target: {
      service: "ent",
      institutionId: INSTITUTION,
      subjectKind: "self",
      subjectPersonRef: "eleve-1",
      subjectClassRef: null,
    },
  });
  assert.deepEqual(soi, { allowed: true });

  const autre = decideVaultAccess({
    actor,
    target: {
      service: "ent",
      institutionId: INSTITUTION,
      subjectKind: "student",
      subjectPersonRef: "eleve-2",
      subjectClassRef: "classe-1",
    },
  });
  assert.deepEqual(autre, { allowed: false, reason: "self_only" });
});

test("professeur : son propre code ent/koxo, cantine selon disponibilité validée", () => {
  const actor = { profile: "professeur", personRef: "prof-1", institutionId: INSTITUTION };
  const cibleSoi = (service) => ({
    service,
    institutionId: INSTITUTION,
    subjectKind: "self",
    subjectPersonRef: "prof-1",
    subjectClassRef: null,
  });

  assert.deepEqual(decideVaultAccess({ actor, target: cibleSoi("ent") }), { allowed: true });
  assert.deepEqual(decideVaultAccess({ actor, target: cibleSoi("koxo") }), { allowed: true });

  assert.deepEqual(
    decideVaultAccess({ actor, target: cibleSoi("cantine"), cantineAvailabilityValidated: false }),
    { allowed: false, reason: "cantine_availability_not_validated" }
  );
  assert.deepEqual(
    decideVaultAccess({ actor, target: cibleSoi("cantine"), cantineAvailabilityValidated: true }),
    { allowed: true }
  );

  const autrePersonne = decideVaultAccess({
    actor,
    target: {
      service: "ent",
      institutionId: INSTITUTION,
      subjectKind: "student",
      subjectPersonRef: "eleve-1",
      subjectClassRef: "classe-1",
    },
  });
  assert.deepEqual(autrePersonne, { allowed: false, reason: "self_only" });
});

test("professeur principal : jamais l'ENT, un code élève à la fois dans ses classes validées", () => {
  const actor = {
    profile: "professeur_principal",
    personRef: "pp-1",
    institutionId: INSTITUTION,
    validatedClassRefs: ["classe-1"],
  };
  const cibleEleve = (service, classe) => ({
    service,
    institutionId: INSTITUTION,
    subjectKind: "student",
    subjectPersonRef: "eleve-1",
    subjectClassRef: classe,
  });

  assert.deepEqual(decideVaultAccess({ actor, target: cibleEleve("ent", "classe-1") }), {
    allowed: false,
    reason: "professeur_principal_ent_forbidden",
  });

  assert.deepEqual(decideVaultAccess({ actor, target: cibleEleve("koxo", "classe-1") }), {
    allowed: true,
  });
  assert.deepEqual(decideVaultAccess({ actor, target: cibleEleve("cantine", "classe-1") }), {
    allowed: true,
  });

  assert.deepEqual(decideVaultAccess({ actor, target: cibleEleve("koxo", "classe-2") }), {
    allowed: false,
    reason: "professeur_principal_class_not_validated",
  });

  assert.deepEqual(
    decideVaultAccess({
      actor,
      target: cibleEleve("koxo", "classe-1"),
      professeurPrincipalAlreadyHoldingAnotherActiveCode: true,
    }),
    { allowed: false, reason: "professeur_principal_single_active_code_required" }
  );
});

test("intendance : cantine seulement, dans son établissement", () => {
  const actor = {
    profile: "service",
    institutionId: INSTITUTION,
    grantedServices: ["intendance"],
  };
  const cible = (service) => ({
    service,
    institutionId: INSTITUTION,
    subjectKind: "institution_wide",
    subjectPersonRef: null,
    subjectClassRef: null,
  });

  assert.deepEqual(decideVaultAccess({ actor, target: cible("cantine") }), { allowed: true });
  assert.deepEqual(decideVaultAccess({ actor, target: cible("ent") }), {
    allowed: false,
    reason: "service_scope_required",
  });
  assert.deepEqual(decideVaultAccess({ actor, target: cible("koxo") }), {
    allowed: false,
    reason: "service_scope_required",
  });
});

test("administration, DDFPT, référent numérique : tout leur établissement, ouvert par le service pas le rôle", () => {
  for (const service of ["administration", "ddfpt", "referent_numerique"]) {
    const actor = { profile: "service", institutionId: INSTITUTION, grantedServices: [service] };
    for (const cibleService of VAULT_SERVICES) {
      const decision = decideVaultAccess({
        actor,
        target: {
          service: cibleService,
          institutionId: INSTITUTION,
          subjectKind: "institution_wide",
          subjectPersonRef: null,
          subjectClassRef: null,
        },
      });
      assert.deepEqual(decision, { allowed: true }, `${service} doit voir ${cibleService}`);
    }
  }

  const sansService = { profile: "service", institutionId: INSTITUTION, grantedServices: ["secretariat"] };
  assert.deepEqual(
    decideVaultAccess({
      actor: sansService,
      target: {
        service: "ent",
        institutionId: INSTITUTION,
        subjectKind: "institution_wide",
        subjectPersonRef: null,
        subjectClassRef: null,
      },
    }),
    { allowed: false, reason: "service_scope_required" }
  );
});

test("aucun accès hors établissement, même avec le bon service", () => {
  const actor = {
    profile: "service",
    institutionId: AUTRE_INSTITUTION,
    grantedServices: ["administration"],
  };
  const decision = decideVaultAccess({
    actor,
    target: {
      service: "ent",
      institutionId: INSTITUTION,
      subjectKind: "institution_wide",
      subjectPersonRef: null,
      subjectClassRef: null,
    },
  });
  assert.deepEqual(decision, { allowed: false, reason: "institution_mismatch" });
});

test("superadministration : accès par défaut, configurable plus tard", () => {
  const decision = decideVaultAccess({
    actor: { profile: "superadmin" },
    target: {
      service: "ent",
      institutionId: INSTITUTION,
      subjectKind: "institution_wide",
      subjectPersonRef: null,
      subjectClassRef: null,
    },
  });
  assert.deepEqual(decision, { allowed: true });
});

test("parent vers enfant : toujours refusé, avec motif explicite", () => {
  const actor = { profile: "parent", personRef: "parent-1", institutionId: INSTITUTION };
  const decision = decideVaultAccess({
    actor,
    target: {
      service: "cantine",
      institutionId: INSTITUTION,
      subjectKind: "student",
      subjectPersonRef: "enfant-1",
      subjectClassRef: "classe-1",
    },
  });
  assert.deepEqual(decision, { allowed: false, reason: "parent_to_child_forbidden" });
});

test("les rôles des profils vérifiés correspondent au rôle LyceeGest existant", () => {
  assert.deepEqual(VAULT_PROFILE_ROLES, {
    eleve: "eleve",
    professeur: "professeur",
    professeur_principal: "pp",
  });
});
