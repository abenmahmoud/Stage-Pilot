// Test pur du LOT 1 (`docs/operations/PLAN_BRANCHEMENT_COFFRE_2026-09-06.md`) :
// aucune base, aucun réseau. Deux garanties couvertes :
//
// 1. Le module de chiffrement (`shared/code-vault-crypto.ts`) produit un
//    envelope conforme aux contraintes de forme réelles de la migration
//    `20260905170000` (bornes exactes de `iv`, `auth_tag`, `ciphertext`),
//    ne fuit jamais la valeur en clair dans le chiffré, et lie le chiffré à
//    son établissement/attribution/version de clé (l'AAD).
// 2. Aucun autre fichier de `api/`, `shared/` ou `workers/` ne contient de
//    littéral `insert into public.code_vault_private_rows` que
//    `api/_shared/code-vault-write.ts` — la garantie structurelle du
//    « point d'écriture unique » exigée par le plan, vérifiée par lecture du
//    dépôt, pas par confiance.
import assert from "node:assert/strict";
import test from "node:test";
import { randomBytes } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  CODE_VAULT_PAYLOAD_SCHEMA,
  codeVaultCryptoConfig,
  encryptVaultCodeValue,
  decryptVaultCodeValue,
} from "../shared/code-vault-crypto.ts";

const INSTITUTION_A = "institution-lot1-a";
const INSTITUTION_B = "institution-lot1-b";
const ASSIGNMENT_A = "assignment-lot1-a";
const ASSIGNMENT_B = "assignment-lot1-b";
const CODE_VALUE = "Koxo2026Eleve123";

function envWith(overrides = {}) {
  return {
    CODE_VAULT_ENCRYPTION_KEY_VERSION: "v1",
    CODE_VAULT_ENCRYPTION_KEY_V1: randomBytes(32).toString("base64"),
    ...overrides,
  };
}

test("le chiffré respecte les bornes exactes de la migration du coffre", () => {
  const config = codeVaultCryptoConfig(envWith());
  const envelope = encryptVaultCodeValue({
    value: CODE_VALUE,
    institutionId: INSTITUTION_A,
    assignmentId: ASSIGNMENT_A,
    config,
  });

  assert.equal(envelope.payloadSchema, CODE_VAULT_PAYLOAD_SCHEMA);
  assert.equal(envelope.keyVersion, "v1");

  // Reprend exactement les contraintes `check` de
  // `supabase/migrations/20260905170000_create_code_vault.sql`.
  assert.match(envelope.iv, /^[A-Za-z0-9+/]+={0,2}$/);
  assert.ok(envelope.iv.length >= 16 && envelope.iv.length <= 24, "iv hors bornes");
  assert.match(envelope.authTag, /^[A-Za-z0-9+/]+={0,2}$/);
  assert.ok(envelope.authTag.length >= 20 && envelope.authTag.length <= 32, "auth_tag hors bornes");
  assert.match(envelope.ciphertext, /^[A-Za-z0-9+/]+={0,2}$/);
  assert.ok(
    envelope.ciphertext.length >= 16 && envelope.ciphertext.length <= 512,
    "ciphertext hors bornes"
  );

  assert.equal(envelope.ciphertext.includes(CODE_VALUE), false);
  assert.equal(Buffer.from(envelope.ciphertext, "base64").toString("utf8").includes(CODE_VALUE), false);
});

test("le round-trip retrouve exactement la valeur d'origine", () => {
  const config = codeVaultCryptoConfig(envWith());
  const envelope = encryptVaultCodeValue({
    value: CODE_VALUE,
    institutionId: INSTITUTION_A,
    assignmentId: ASSIGNMENT_A,
    config,
  });
  const decrypted = decryptVaultCodeValue({
    envelope,
    institutionId: INSTITUTION_A,
    assignmentId: ASSIGNMENT_A,
    key: config.key,
  });
  assert.equal(decrypted, CODE_VALUE);
});

test("un chiffré rejoué sous une autre attribution ou un autre établissement échoue au déchiffrement", () => {
  const config = codeVaultCryptoConfig(envWith());
  const envelope = encryptVaultCodeValue({
    value: CODE_VALUE,
    institutionId: INSTITUTION_A,
    assignmentId: ASSIGNMENT_A,
    config,
  });

  assert.throws(() =>
    decryptVaultCodeValue({
      envelope,
      institutionId: INSTITUTION_B,
      assignmentId: ASSIGNMENT_A,
      key: config.key,
    })
  );
  assert.throws(() =>
    decryptVaultCodeValue({
      envelope,
      institutionId: INSTITUTION_A,
      assignmentId: ASSIGNMENT_B,
      key: config.key,
    })
  );
});

test("un chiffré altéré (iv, auth_tag ou ciphertext) échoue au déchiffrement", () => {
  const config = codeVaultCryptoConfig(envWith());
  const envelope = encryptVaultCodeValue({
    value: CODE_VALUE,
    institutionId: INSTITUTION_A,
    assignmentId: ASSIGNMENT_A,
    config,
  });

  const flipLastByte = (base64) => {
    const bytes = Buffer.from(base64, "base64");
    bytes[bytes.length - 1] ^= 0xff;
    return bytes.toString("base64");
  };

  for (const field of ["iv", "authTag", "ciphertext"]) {
    assert.throws(() =>
      decryptVaultCodeValue({
        envelope: { ...envelope, [field]: flipLastByte(envelope[field]) },
        institutionId: INSTITUTION_A,
        assignmentId: ASSIGNMENT_A,
        key: config.key,
      })
    );
  }
});

test("une valeur en clair hors bornes est rejetée avant tout chiffrement", () => {
  const config = codeVaultCryptoConfig(envWith());
  for (const invalid of ["", "ab", "x".repeat(129), "code\ninjecté", 42, null, undefined]) {
    assert.throws(() =>
      encryptVaultCodeValue({
        value: invalid,
        institutionId: INSTITUTION_A,
        assignmentId: ASSIGNMENT_A,
        config,
      })
    );
  }
});

test("une version de clé absente de l'environnement est rejetée", () => {
  assert.throws(() => codeVaultCryptoConfig(envWith({ CODE_VAULT_ENCRYPTION_KEY_VERSION: "v9" })));
  assert.throws(() => codeVaultCryptoConfig({}));
});

// ---------------------------------------------------------------------------
// Garantie structurelle : point d'écriture unique dans le dépôt applicatif.
// ---------------------------------------------------------------------------
test("aucun fichier applicatif hormis code-vault-write.ts n'insère dans code_vault_private_rows", () => {
  const repoRoot = fileURLToPath(new URL("..", import.meta.url));
  const writeModule = path.join(repoRoot, "api", "_shared", "code-vault-write.ts");
  const insertPattern = /insert\s+into\s+public\.code_vault_private_rows/i;

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
          if (insertPattern.test(content)) matches.push(fullPath);
        }
      }
    };
    walk(dirPath);
  }

  assert.deepEqual(matches, [writeModule], "un seul fichier doit écrire dans code_vault_private_rows");
});
