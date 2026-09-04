import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";
import { encryptNominativePayload, decryptNominativePayload, nominativeEncryptionConfig, nominativePrivateFingerprint } from "../shared/nominative-private-store.ts";

const config = { version: "v1", key: randomBytes(32) };
const context = { institutionId: "11111111-1111-4111-8111-111111111111", importId: "22222222-2222-4222-8222-222222222222", beneficiaryRef: "eleve:fictif01" };

test("la valeur et les noms restent chiffrés et le zéro initial est conservé", () => {
  const payload = { value: "0042", firstName: "Alice", lastName: "Fictif" };
  const envelope = encryptNominativePayload(payload, context, config);
  assert.deepEqual(decryptNominativePayload(envelope, context, config), payload);
  assert.ok(!JSON.stringify(envelope).includes("Alice"));
  assert.notEqual(envelope.ciphertext, encryptNominativePayload(payload, context, config).ciphertext);
});

test("déplacer une enveloppe vers un autre enfant, établissement ou import est refusé", () => {
  const envelope = encryptNominativePayload({ value: "0042" }, context, config);
  for (const changed of [
    { ...context, beneficiaryRef: "eleve:fictif02" },
    { ...context, institutionId: "33333333-3333-4333-8333-333333333333" },
    { ...context, importId: "33333333-3333-4333-8333-333333333333" },
  ]) assert.throws(() => decryptNominativePayload(envelope, changed, config), /nominative_envelope_invalid/);
});

test("une altération ou une mauvaise clé ne révèle pas de contenu", () => {
  const envelope = encryptNominativePayload({ value: "0042" }, context, config);
  const changed = Buffer.from(envelope.ciphertext, "base64");
  changed[0] ^= 1;
  assert.throws(() => decryptNominativePayload({ ...envelope, ciphertext: changed.toString("base64") }, context, config), /nominative_envelope_invalid/);
  assert.throws(() => decryptNominativePayload(envelope, context, { ...config, key: randomBytes(32) }), /nominative_envelope_invalid/);
});

test("aucune clé par défaut n'est créée et les empreintes nécessitent un secret distinct", () => {
  assert.throws(() => nominativeEncryptionConfig({}), /key_unavailable/);
  assert.throws(() => nominativePrivateFingerprint(["0042"], undefined), /key_unavailable/);
  assert.notEqual(nominativePrivateFingerprint(["0042"], "a".repeat(32)), nominativePrivateFingerprint(["0042"], "b".repeat(32)));
  assert.notEqual(nominativePrivateFingerprint(["0042"], "a".repeat(32)), nominativePrivateFingerprint(["42"], "a".repeat(32)));
});
