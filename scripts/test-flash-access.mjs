import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL ??= "postgres://fixture:fixture@127.0.0.1:1/fixture";
process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://fixture.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "fixture-service-role-key";

const { activeFlashServiceCodes, assertFlashValidationAccess } = await import(
  "../api/_shared/flash-access.ts"
);
const { HttpError } = await import("../api/_shared/auth.ts");

const ADEL = "11111111-1111-4111-8111-111111111111";
const AUTRE = "22222222-2222-4222-8222-222222222222";

function actor(overrides = {}) {
  return {
    user: { id: ADEL, email: null, emailConfirmedAt: null, role: "professeur", appMetadata: {} },
    institutionId: "33333333-3333-4333-8333-333333333333",
    serviceCodes: ["referent_numerique"],
    ...overrides,
  };
}

test("n'accorde aucun service depuis une appartenance inactive", () => {
  assert.deepEqual(
    activeFlashServiceCodes({
      status: "disabled",
      institutionStatus: "pilot",
      serviceCodes: ["ddfpt"],
    }),
    []
  );
});

test("n'accorde aucun service depuis un établissement suspendu", () => {
  assert.deepEqual(
    activeFlashServiceCodes({
      status: "active",
      institutionStatus: "suspended",
      serviceCodes: ["ddfpt"],
    }),
    []
  );
});

test("n'accorde aucun service quand l'appartenance est absente", () => {
  assert.deepEqual(activeFlashServiceCodes(null), []);
});

test("filtre les entrées mal formées d'une colonne service_codes valide", () => {
  assert.deepEqual(
    activeFlashServiceCodes({
      status: "active",
      institutionStatus: "active",
      serviceCodes: ["ddfpt", 42, null],
    }),
    ["ddfpt"]
  );
});

test("autorise la validation quand le service est réellement accordé", () => {
  const decision = assertFlashValidationAccess(actor(), AUTRE);
  assert.equal(decision.allowed, true);
  assert.equal(decision.grantedByService, "referent_numerique");
});

test("refuse par une HttpError 403 quand le service n'est pas accordé", () => {
  const refused = actor({ serviceCodes: ["secretariat"] });
  assert.throws(
    () => assertFlashValidationAccess(refused, AUTRE),
    (error) => error instanceof HttpError && error.status === 403
  );
});

test("garde la trace de l'auto-validation plutôt que de la cacher", () => {
  const decision = assertFlashValidationAccess(actor(), ADEL);
  assert.equal(decision.allowed, true);
  assert.equal(decision.selfValidated, true);
});

test("le superadmin reste autorisé même sans service déclaré", () => {
  const superadmin = actor({
    user: { id: ADEL, email: null, emailConfirmedAt: null, role: "superadmin", appMetadata: {} },
    serviceCodes: [],
  });
  const decision = assertFlashValidationAccess(superadmin, AUTRE);
  assert.equal(decision.allowed, true);
  assert.equal(decision.grantedByService, "superadmin");
});
