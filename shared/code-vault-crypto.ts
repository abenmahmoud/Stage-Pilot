// Chiffrement applicatif du coffre de codes — LOT 1 du plan du 6 septembre
// 2026 (`docs/operations/PLAN_BRANCHEMENT_COFFRE_2026-09-06.md`). Sur le
// motif exact de `shared/identity-directory-lookup-crypto.mjs` : AES-256-GCM,
// IV aléatoire à chaque écriture, AAD liant le chiffré à son établissement,
// à son attribution et à la version de clé — un chiffré déplacé d'une ligne
// à l'autre, ou rejoué sous une autre version de clé, échoue au
// déchiffrement au lieu de révéler une valeur qui n'est pas la sienne.
//
// Module pur : aucune connexion, aucune écriture en base. Aucune contrainte
// SQL ne peut distinguer un chiffré d'une chaîne qui ressemble à du base64
// (`code_vault_private_rows_ciphertext_check` ne vérifie que la forme) : la
// garantie ne vient donc pas de la base, mais du fait qu'un seul appelant
// dans tout le dépôt a le droit d'invoquer `encryptVaultCodeValue` avant une
// écriture — `writeVaultCodeValue` dans `api/_shared/code-vault-write.ts`,
// seul point d'écriture autorisé dans `code_vault_private_rows`.

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export const CODE_VAULT_PAYLOAD_SCHEMA = 1;

export type VaultCipherEnvelope = {
  keyVersion: string;
  payloadSchema: number;
  iv: string;
  authTag: string;
  ciphertext: string;
};

export type VaultCryptoConfig = {
  version: string;
  key: Buffer;
};

function base64Bytes(
  value: unknown,
  { code, exactBytes, minBytes = 1, maxBytes = 8192 }: { code: string; exactBytes?: number; minBytes?: number; maxBytes?: number }
): Buffer {
  if (typeof value !== "string" || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    throw new Error(code);
  }
  const bytes = Buffer.from(value, "base64");
  if (
    bytes.toString("base64") !== value ||
    (exactBytes !== undefined && bytes.length !== exactBytes) ||
    bytes.length < minBytes ||
    bytes.length > maxBytes
  ) {
    throw new Error(code);
  }
  return bytes;
}

function keyVersion(value: unknown): string {
  if (typeof value !== "string" || !/^v[1-9][0-9]{0,3}$/.test(value)) {
    throw new Error("code_vault_key_version_invalid");
  }
  return value;
}

function encryptionKey(value: unknown): Buffer {
  return base64Bytes(value, { code: "code_vault_key_invalid", exactBytes: 32 });
}

function contextId(value: unknown, code: string): string {
  if (typeof value !== "string" || value.length < 3 || value.length > 200) {
    throw new Error(code);
  }
  return value;
}

/**
 * Un code d'accès (ENT, cantine, Koxo) tient largement dans quelques dizaines
 * de caractères imprimables. La borne haute reste très en-dessous de la
 * limite de 512 caractères du chiffré en base : la contrainte de forme sur
 * `ciphertext` n'est jamais le premier obstacle rencontré par une valeur
 * anormalement longue.
 */
function vaultCodeValue(value: unknown): string {
  if (typeof value !== "string") throw new Error("code_vault_value_invalid");
  if (value.length < 4 || value.length > 128) throw new Error("code_vault_value_invalid");
  if (!/^[\x20-\x7e]+$/.test(value)) throw new Error("code_vault_value_invalid");
  return value;
}

function aad({
  institutionId,
  assignmentId,
  version,
}: {
  institutionId: string;
  assignmentId: string;
  version: string;
}): Buffer {
  return Buffer.from(
    `lyceegest:code-vault:${CODE_VAULT_PAYLOAD_SCHEMA}:${keyVersion(version)}:${contextId(institutionId, "code_vault_context_invalid")}:${contextId(assignmentId, "code_vault_context_invalid")}`,
    "utf8"
  );
}

/** Lit la clé active depuis l'environnement — jamais depuis un `.env` de production, jamais depuis une valeur en dur. */
export function codeVaultCryptoConfig(env: NodeJS.ProcessEnv = process.env): VaultCryptoConfig {
  const version = keyVersion(env.CODE_VAULT_ENCRYPTION_KEY_VERSION);
  const encodedKey = env[`CODE_VAULT_ENCRYPTION_KEY_${version.toUpperCase()}`];
  return { version, key: encryptionKey(encodedKey) };
}

export function encryptVaultCodeValue({
  value,
  institutionId,
  assignmentId,
  config,
}: {
  value: string;
  institutionId: string;
  assignmentId: string;
  config: VaultCryptoConfig;
}): VaultCipherEnvelope {
  const version = keyVersion(config?.version);
  const key = Buffer.isBuffer(config?.key) ? config.key : encryptionKey(config?.key);
  if (key.length !== 32) throw new Error("code_vault_key_invalid");
  const plaintext = vaultCodeValue(value);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(aad({ institutionId, assignmentId, version }));
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return {
    keyVersion: version,
    payloadSchema: CODE_VAULT_PAYLOAD_SCHEMA,
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
}

export function decryptVaultCodeValue({
  envelope,
  institutionId,
  assignmentId,
  key,
}: {
  envelope: VaultCipherEnvelope;
  institutionId: string;
  assignmentId: string;
  key: Buffer | string;
}): string {
  if (envelope?.payloadSchema !== CODE_VAULT_PAYLOAD_SCHEMA) {
    throw new Error("code_vault_schema_unsupported");
  }
  const version = keyVersion(envelope.keyVersion);
  const decodedKey = Buffer.isBuffer(key) ? key : encryptionKey(key);
  if (decodedKey.length !== 32) throw new Error("code_vault_key_invalid");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    decodedKey,
    base64Bytes(envelope.iv, { code: "code_vault_envelope_invalid", exactBytes: 12 })
  );
  decipher.setAAD(aad({ institutionId, assignmentId, version }));
  decipher.setAuthTag(
    base64Bytes(envelope.authTag, { code: "code_vault_envelope_invalid", exactBytes: 16 })
  );
  const plaintext = Buffer.concat([
    decipher.update(base64Bytes(envelope.ciphertext, { code: "code_vault_envelope_invalid", maxBytes: 384 })),
    decipher.final(),
  ]).toString("utf8");
  return vaultCodeValue(plaintext);
}
