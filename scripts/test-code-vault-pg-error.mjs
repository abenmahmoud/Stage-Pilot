// Test adverse du LOT 2 (`docs/operations/PLAN_BRANCHEMENT_COFFRE_2026-09-06.md`) :
// aucune base, aucun réseau. Une erreur Postgres fabriquée, portant un
// marqueur secret dans son `detail` (comme le ferait un vrai
// « Failing row contains (...) » de violation de contrainte), ne doit
// laisser ce marqueur nulle part : ni dans le résultat du sanitiseur, ni
// dans l'erreur relancée par `writeVaultCodeValue`, ni dans son message, sa
// pile d'appel, ou sa sérialisation JSON.
import assert from "node:assert/strict";
import test from "node:test";
import { randomBytes } from "node:crypto";

import { sanitizePgError, SanitizedPgWriteError } from "../shared/code-vault-pg-error.ts";
import { writeVaultCodeValue } from "../api/_shared/code-vault-write.ts";

const SECRET_MARKER = "LOT2-SECRET-Koxo2026Eleve123-ne-doit-jamais-fuir";

function fabricatedPgError(overrides = {}) {
  // Reprend la forme réelle d'une `PostgresError` du paquet `postgres`
  // (`node_modules/postgres/src/errors.js` : `Object.assign(this, x)`), donc
  // un objet plat avec les noms de champs du protocole
  // (`node_modules/postgres/src/connection.js`, `errorFields`).
  const error = new Error("new row for relation \"code_vault_private_rows\" violates check constraint");
  Object.assign(error, {
    code: "23514",
    severity: "ERROR",
    detail: `Failing row contains (inst-1, assign-1, v1, 1, iv, tag, ${SECRET_MARKER}).`,
    hint: undefined,
    schema_name: "public",
    table_name: "code_vault_private_rows",
    constraint_name: "code_vault_private_rows_ciphertext_check",
    ...overrides,
  });
  return error;
}

function assertNoMarkerAnywhere(value, marker, label) {
  const seen = new Set();
  const stack = [value];
  while (stack.length > 0) {
    const current = stack.pop();
    if (current === null || current === undefined) continue;
    if (typeof current === "string") {
      assert.equal(current.includes(marker), false, `${label} : marqueur trouvé dans une chaîne`);
      continue;
    }
    if (typeof current !== "object" && typeof current !== "function") continue;
    if (seen.has(current)) continue;
    seen.add(current);
    for (const key of Object.getOwnPropertyNames(current)) {
      let propValue;
      try {
        propValue = current[key];
      } catch {
        continue;
      }
      stack.push(propValue);
    }
  }
}

test("sanitizePgError ne garde que message et constraint_name", () => {
  const sanitized = sanitizePgError(fabricatedPgError());
  assert.deepEqual(Object.keys(sanitized).sort(), ["constraintName", "message"]);
  assert.equal(sanitized.constraintName, "code_vault_private_rows_ciphertext_check");
  assert.equal(
    sanitized.message,
    "new row for relation \"code_vault_private_rows\" violates check constraint"
  );
  assertNoMarkerAnywhere(sanitized, SECRET_MARKER, "sanitizePgError");
});

test("sanitizePgError rejette un constraint_name qui ne ressemble pas à un identifiant", () => {
  const sanitized = sanitizePgError(
    fabricatedPgError({ constraint_name: `injected; -- ${SECRET_MARKER}` })
  );
  assert.equal(sanitized.constraintName, undefined);
  assertNoMarkerAnywhere(sanitized, SECRET_MARKER, "sanitizePgError (constraint_name invalide)");
});

test("sanitizePgError extrait uniquement les champs sûrs d'une erreur Drizzle enveloppée", () => {
  const driverError = fabricatedPgError({
    constraint_name: "code_vault_private_rows_assignment_id_institution_id_key",
  });
  const wrapped = new Error(`Failed query with hidden params ${SECRET_MARKER}`, {
    cause: driverError,
  });
  const sanitized = sanitizePgError(wrapped);

  assert.equal(
    sanitized.constraintName,
    "code_vault_private_rows_assignment_id_institution_id_key"
  );
  assert.equal(sanitized.message, driverError.message);
  assertNoMarkerAnywhere(sanitized, SECRET_MARKER, "sanitizePgError (Drizzle enveloppé)");
});

test("sanitizePgError tolère une entrée qui n'est pas une PostgresError", () => {
  assert.deepEqual(sanitizePgError(null), { message: "pg_error_unknown" });
  assert.deepEqual(sanitizePgError(undefined), { message: "pg_error_unknown" });
  assert.deepEqual(sanitizePgError("chaîne brute"), { message: "pg_error_unknown" });
  assert.deepEqual(sanitizePgError({ message: 42 }), {
    message: "pg_error_unknown",
    constraintName: undefined,
  });
});

test("SanitizedPgWriteError ne porte aucune trace de l'erreur d'origine", () => {
  const sanitized = sanitizePgError(fabricatedPgError());
  const error = new SanitizedPgWriteError(sanitized);

  assert.equal(error instanceof Error, true);
  assert.equal(error.name, "SanitizedPgWriteError");
  assert.equal(error.constraintName, "code_vault_private_rows_ciphertext_check");
  assert.equal("cause" in error, false, "aucune référence à l'erreur d'origine via cause");
  assertNoMarkerAnywhere(error.message, SECRET_MARKER, "SanitizedPgWriteError.message");
  assertNoMarkerAnywhere(error.stack, SECRET_MARKER, "SanitizedPgWriteError.stack");
  assertNoMarkerAnywhere(
    JSON.stringify(error, Object.getOwnPropertyNames(error)),
    SECRET_MARKER,
    "SanitizedPgWriteError JSON"
  );
});

test("writeVaultCodeValue relance une erreur sanitisée, jamais l'erreur Postgres brute", async () => {
  const fabricated = fabricatedPgError();
  const tx = {
    execute: async () => {
      throw fabricated;
    },
  };
  const env = {
    CODE_VAULT_ENCRYPTION_KEY_VERSION: "v1",
    CODE_VAULT_ENCRYPTION_KEY_V1: randomBytes(32).toString("base64"),
  };

  await assert.rejects(
    writeVaultCodeValue(tx, {
      assignmentId: "assignment-lot2",
      institutionId: "institution-lot2",
      value: "Koxo2026Eleve123",
      env,
    }),
    (error) => {
      assert.equal(error instanceof SanitizedPgWriteError, true);
      assert.notEqual(error, fabricated);
      assert.equal(error.constraintName, "code_vault_private_rows_ciphertext_check");
      assertNoMarkerAnywhere(error.message, SECRET_MARKER, "writeVaultCodeValue rejet — message");
      assertNoMarkerAnywhere(error.stack, SECRET_MARKER, "writeVaultCodeValue rejet — stack");
      assertNoMarkerAnywhere(
        JSON.stringify(error, Object.getOwnPropertyNames(error)),
        SECRET_MARKER,
        "writeVaultCodeValue rejet — JSON"
      );
      return true;
    }
  );
});
