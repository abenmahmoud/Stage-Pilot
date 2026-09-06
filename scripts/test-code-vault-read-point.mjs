// Test pur du LOT 1 (`docs/operations/PLAN_LECTURE_COFFRE_2026-09-06.md`) :
// aucune base, aucun réseau. Trois garanties couvertes :
//
// 1. `readVaultCodeValue` (`api/_shared/code-vault-read.ts`) n'interroge
//    jamais `code_vault_private_rows` si le `displayOutcome` reçu n'est pas
//    un `{ outcome: "displayed" }` réel — un appelant ne peut donc pas
//    obtenir de valeur sans être passé par `recordVaultCodeDisplay`.
// 2. Le round-trip chiffrement (LOT 1 du branchement) / lecture (ce lot)
//    retrouve exactement la valeur d'origine, et une erreur Postgres pendant
//    la lecture est sanitisée avant de remonter (jamais de `detail`).
// 3. Aucun autre fichier de `api/`, `shared/` ou `workers/` ne contient de
//    littéral `from public.code_vault_private_rows` que
//    `api/_shared/code-vault-read.ts` — la garantie structurelle du « point
//    de lecture unique » exigée par le plan, vérifiée par lecture du dépôt,
//    pas par confiance, exactement comme
//    `scripts/test-code-vault-write-point.mjs` côté écriture.
import assert from "node:assert/strict";
import test from "node:test";
import { randomBytes } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { readVaultCodeValue } from "../api/_shared/code-vault-read.ts";
import { encryptVaultCodeValue } from "../shared/code-vault-crypto.ts";
import { SanitizedPgReadError } from "../shared/code-vault-pg-error.ts";

const INSTITUTION_A = "institution-lecture-lot1-a";
const ASSIGNMENT_A = "assignment-lecture-lot1-a";
const CODE_VALUE = "Cantine2026Eleve456";

function testEnv() {
  return {
    CODE_VAULT_ENCRYPTION_KEY_VERSION: "v1",
    CODE_VAULT_ENCRYPTION_KEY_V1: randomBytes(32).toString("base64"),
  };
}

function fakeTx(rows) {
  const calls = [];
  return {
    calls,
    execute: async (query) => {
      calls.push(query);
      return rows;
    },
  };
}

function displayedOutcome() {
  return { outcome: "displayed", revealedAt: new Date(), remainingDisplaysToday: 2 };
}

test("une remise refusée (quota dépassé) n'interroge jamais la table et renvoie null", async () => {
  const tx = fakeTx([]);
  const value = await readVaultCodeValue(tx, {
    assignmentId: ASSIGNMENT_A,
    institutionId: INSTITUTION_A,
    displayOutcome: { outcome: "quota_exceeded" },
    env: testEnv(),
  });
  assert.equal(value, null);
  assert.equal(tx.calls.length, 0, "aucune interrogation de code_vault_private_rows attendue");
});

test("une remise refusée (code défectueux) n'interroge jamais la table et renvoie null", async () => {
  const tx = fakeTx([]);
  const value = await readVaultCodeValue(tx, {
    assignmentId: ASSIGNMENT_A,
    institutionId: INSTITUTION_A,
    displayOutcome: { outcome: "defective" },
    env: testEnv(),
  });
  assert.equal(value, null);
  assert.equal(tx.calls.length, 0);
});

test("une remise accordée sans ligne trouvée renvoie null", async () => {
  const tx = fakeTx([]);
  const value = await readVaultCodeValue(tx, {
    assignmentId: ASSIGNMENT_A,
    institutionId: INSTITUTION_A,
    displayOutcome: displayedOutcome(),
    env: testEnv(),
  });
  assert.equal(value, null);
  assert.equal(tx.calls.length, 1);
});

test("une remise accordée avec la ligne chiffrée retrouve exactement la valeur d'origine", async () => {
  const env = testEnv();
  const config = { version: "v1", key: Buffer.from(env.CODE_VAULT_ENCRYPTION_KEY_V1, "base64") };
  const envelope = encryptVaultCodeValue({
    value: CODE_VALUE,
    institutionId: INSTITUTION_A,
    assignmentId: ASSIGNMENT_A,
    config,
  });
  const tx = fakeTx([
    {
      key_version: envelope.keyVersion,
      payload_schema: envelope.payloadSchema,
      iv: envelope.iv,
      auth_tag: envelope.authTag,
      ciphertext: envelope.ciphertext,
    },
  ]);
  const value = await readVaultCodeValue(tx, {
    assignmentId: ASSIGNMENT_A,
    institutionId: INSTITUTION_A,
    displayOutcome: displayedOutcome(),
    env,
  });
  assert.equal(value, CODE_VALUE);
});

test("une ligne chiffrée pour une autre attribution échoue au déchiffrement plutôt que de révéler la mauvaise valeur", async () => {
  const env = testEnv();
  const config = { version: "v1", key: Buffer.from(env.CODE_VAULT_ENCRYPTION_KEY_V1, "base64") };
  const envelope = encryptVaultCodeValue({
    value: CODE_VALUE,
    institutionId: INSTITUTION_A,
    assignmentId: "assignment-lecture-lot1-b",
    config,
  });
  const tx = fakeTx([
    {
      key_version: envelope.keyVersion,
      payload_schema: envelope.payloadSchema,
      iv: envelope.iv,
      auth_tag: envelope.authTag,
      ciphertext: envelope.ciphertext,
    },
  ]);
  await assert.rejects(() =>
    readVaultCodeValue(tx, {
      assignmentId: ASSIGNMENT_A,
      institutionId: INSTITUTION_A,
      displayOutcome: displayedOutcome(),
      env,
    })
  );
});

test("une erreur Postgres pendant la lecture est sanitisée, sans detail ni cause", async () => {
  const rawError = {
    message: "duplicate key value violates unique constraint",
    detail: `Failing row contains (${INSTITUTION_A}, ${ASSIGNMENT_A}, ${CODE_VALUE}).`,
    constraint_name: "code_vault_private_rows_assignment_scope_uidx",
  };
  const tx = {
    execute: async () => {
      throw rawError;
    },
  };
  let caught = null;
  try {
    await readVaultCodeValue(tx, {
      assignmentId: ASSIGNMENT_A,
      institutionId: INSTITUTION_A,
      displayOutcome: displayedOutcome(),
      env: testEnv(),
    });
  } catch (error) {
    caught = error;
  }
  assert.ok(caught instanceof SanitizedPgReadError);
  assert.equal(caught.constraintName, rawError.constraint_name);
  const serialized = `${caught.message} ${JSON.stringify(caught)}`;
  assert.equal(serialized.includes(CODE_VALUE), false, "le detail brut ne doit jamais réapparaître");
  assert.equal("detail" in caught, false);
  assert.equal("cause" in caught, false);
});

// ---------------------------------------------------------------------------
// Garantie structurelle : point de lecture unique dans le dépôt applicatif.
// ---------------------------------------------------------------------------
test("aucun fichier applicatif hormis code-vault-read.ts ne lit code_vault_private_rows", () => {
  const repoRoot = fileURLToPath(new URL("..", import.meta.url));
  const readModule = path.join(repoRoot, "api", "_shared", "code-vault-read.ts");
  const selectPattern = /from\s+public\.code_vault_private_rows/i;

  const matches = [];
  for (const dir of ["api", "shared", "workers"]) {
    const dirPath = path.join(repoRoot, dir);
    const walk = (currentPath) => {
      for (const entry of readdirSync(currentPath)) {
        const fullPath = path.join(currentPath, entry);
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          walk(fullPath);
        } else if (/\.(ts|tsx|mjs|js)$/.test(entry)) {
          const content = readFileSync(fullPath, "utf8");
          if (selectPattern.test(content)) matches.push(fullPath);
        }
      }
    };
    walk(dirPath);
  }

  assert.deepEqual(matches, [readModule], "un seul fichier doit lire code_vault_private_rows");
});
