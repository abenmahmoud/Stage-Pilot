import assert from "node:assert/strict";
import { generateKeyPairSync, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  decryptIdentityLookupRequest,
  decryptIdentityLookupResult,
  encryptIdentityLookupRequest,
  encryptIdentityLookupResult,
  identityLookupApiConfig,
  identityLookupWorkerConfig,
  openIdentityLookupReceipt,
  sealIdentityLookupReceipt,
} from "../shared/identity-directory-lookup-crypto.mjs";
import {
  parseIdentityLookupInput,
  parseIdentityLookupResult,
} from "../shared/identity-directory-lookup.ts";

const { publicKey, privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "der" },
  privateKeyEncoding: { type: "pkcs8", format: "der" },
});
const receiptKey = randomBytes(32);
const env = {
  IDENTITY_DIRECTORY_LOOKUP_KEY_VERSION: "v1",
  IDENTITY_DIRECTORY_LOOKUP_PUBLIC_KEY_V1: publicKey.toString("base64"),
  IDENTITY_DIRECTORY_LOOKUP_PRIVATE_KEY_V1: privateKey.toString("base64"),
  IDENTITY_DIRECTORY_LOOKUP_RECEIPT_SECRET: receiptKey.toString("base64"),
};
const apiConfig = identityLookupApiConfig(env);
const workerConfig = identityLookupWorkerConfig(env);
const requestId = "11111111-1111-4111-8111-111111111111";
const institutionId = "22222222-2222-4222-8222-222222222222";
const actorId = "33333333-3333-4333-8333-333333333333";
const responseKey = randomBytes(32);
const requestValue = {
  schema: 1,
  requestId,
  institutionId,
  actorId,
  searchType: "academic_email",
  query: "camille@example.test",
  reasonCategory: "support_case",
  justification: "Contrôle du dossier fictif BC-TEST-001.",
  responseKey: responseKey.toString("base64"),
  requestedAt: "2026-08-29T08:00:00.000Z",
  expiresAt: "2026-08-29T08:05:00.000Z",
};

const requestEnvelope = encryptIdentityLookupRequest({
  value: requestValue,
  requestId,
  institutionId,
  actorId,
  config: apiConfig,
});
assert.doesNotMatch(JSON.stringify(requestEnvelope), /camille|example\.test|BC-TEST/);
assert.deepEqual(
  decryptIdentityLookupRequest({
    envelope: requestEnvelope,
    requestId,
    institutionId,
    actorId,
    privateKey: workerConfig.privateKey,
  }),
  requestValue
);
assert.throws(() => decryptIdentityLookupRequest({
  envelope: requestEnvelope,
  requestId,
  institutionId,
  actorId: "44444444-4444-4444-8444-444444444444",
  privateKey: workerConfig.privateKey,
}), /invalid|authenticate/i);
assert.throws(() => decryptIdentityLookupRequest({
  envelope: { ...requestEnvelope, ciphertext: `${requestEnvelope.ciphertext.slice(0, -4)}AAAA` },
  requestId,
  institutionId,
  actorId,
  privateKey: workerConfig.privateKey,
}), /invalid|authenticate/i);

const resultValue = {
  firstName: "CamilleTest",
  lastName: "MartinTest",
  personType: "student",
  classRef: "2GT-TEST",
  serviceCode: null,
  personRef: "TEST-STUDENT-001",
  matchedBy: "academic_email",
  directoryVersionId: "55555555-5555-4555-8555-555555555555",
  directoryActivatedAt: "2026-08-29T07:30:00.000Z",
};
const resultEnvelope = encryptIdentityLookupResult({
  value: resultValue,
  responseKey,
  requestId,
  institutionId,
  actorId,
});
assert.doesNotMatch(JSON.stringify(resultEnvelope), /CamilleTest|MartinTest|2GT-TEST/);
assert.deepEqual(parseIdentityLookupResult(decryptIdentityLookupResult({
  envelope: resultEnvelope,
  responseKey,
  requestId,
  institutionId,
  actorId,
})), resultValue);
assert.throws(() => decryptIdentityLookupResult({
  envelope: resultEnvelope,
  responseKey: randomBytes(32),
  requestId,
  institutionId,
  actorId,
}), /invalid|authenticate/i);

const claims = {
  schema: 1,
  requestId,
  institutionId,
  actorId,
  responseKey: responseKey.toString("base64"),
  expiresAt: "2026-08-29T08:05:00.000Z",
};
const receipt = sealIdentityLookupReceipt(claims, receiptKey);
assert.doesNotMatch(receipt, new RegExp(responseKey.toString("base64").replace(/[+/=]/g, "\\$&")));
assert.deepEqual(openIdentityLookupReceipt(receipt, receiptKey), claims);
assert.throws(() => openIdentityLookupReceipt(`${receipt.slice(0, -3)}abc`, receiptKey), /invalid|authenticate/i);
assert.throws(() => openIdentityLookupReceipt(receipt, randomBytes(32)), /invalid|authenticate/i);

assert.deepEqual(parseIdentityLookupInput({
  searchType: "phone",
  query: "06 00 00 00 01",
  reasonCategory: "identity_verification",
  justification: "Vérification fictive avant traitement du dossier.",
}), {
  searchType: "phone",
  query: "06 00 00 00 01",
  reasonCategory: "identity_verification",
  justification: "Vérification fictive avant traitement du dossier.",
});
assert.throws(() => parseIdentityLookupInput({
  searchType: "name",
  query: "Camille",
  reasonCategory: "other",
  justification: "Recherche libre interdite dans le répertoire.",
}), /type de recherche/);
assert.throws(() => parseIdentityLookupInput({
  searchType: "academic_email",
  query: "camille",
  reasonCategory: "support_case",
  justification: "Justification suffisamment longue pour ce test.",
}), /email complète/);
assert.throws(() => parseIdentityLookupInput({
  searchType: "person_ref",
  query: "TEST-STUDENT-001",
  reasonCategory: "support_case",
  justification: "trop court",
}), /20 à 500/);

const migration = await readFile(new URL("../supabase/migrations/20260829031650_create_identity_directory_lookup.sql", import.meta.url), "utf8");
const minimizationMigration = await readFile(new URL("../supabase/migrations/20260829031912_minimize_identity_lookup_payloads.sql", import.meta.url), "utf8");
const route = await readFile(new URL("../api/identity/admin/lookups/index.ts", import.meta.url), "utf8");
const pollRoute = await readFile(new URL("../api/identity/admin/lookups/[id].ts", import.meta.url), "utf8");
const worker = await readFile(new URL("../workers/identity-directory-lookup-worker.mjs", import.meta.url), "utf8");
assert.match(migration, /force row level security/);
assert.match(migration, /revoke all[\s\S]+public, anon, authenticated/);
assert.match(migration, /pgmq\.create\('identity_directory_lookup'\)/);
assert.doesNotMatch(migration, /query text|first_name|last_name|academic_email text|phone text/);
assert.match(minimizationMigration, /status not in \('queued', 'processing'\)[\s\S]+request_ciphertext is null/);
assert.match(route, /requireIdentityDirectoryManager/);
assert.match(route, /justificationHash/);
assert.doesNotMatch(route + pollRoute, /support\/assistant|openai|agentSkill/);
assert.match(worker, /i\.status = 'active'/);
assert.match(worker, /limit 2/);
assert.match(worker, /decryptIdentityVaultPayload/);
assert.match(worker, /expireStaleRequests/);
assert.match(worker, /request_ciphertext = null/);
assert.doesNotMatch(worker, /console\.(log|error)/);

console.log("identity directory lookup: 23/23 checks passed");
