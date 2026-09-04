// Server/worker only. Personal values never enter a model context or a public
// browser bundle. AES-GCM binds every envelope to its institution and row.
import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";
import { parseBeneficiaryRef, parseSchoolYear } from "./nominative-value-policy.js";

export type NominativeEncryptionConfig = { version: string; key: Buffer };
export type NominativeEnvelope = { keyVersion: string; iv: string; authTag: string; ciphertext: string };
export type NominativeEnvelopeContext = { institutionId: string; importId: string; beneficiaryRef: string };
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

export function nominativeEncryptionConfig(env: NodeJS.ProcessEnv = process.env, version = env.NOMINATIVE_ENCRYPTION_KEY_VERSION): NominativeEncryptionConfig {
  if (!version || !/^v[1-9][0-9]{0,3}$/.test(version)) throw new Error("nominative_key_unavailable");
  const encoded = env[`NOMINATIVE_ENCRYPTION_KEY_${version.toUpperCase()}`];
  const key = Buffer.from(encoded ?? "", "base64");
  if (key.length !== 32 || key.toString("base64") !== encoded) throw new Error("nominative_key_unavailable");
  return { version, key };
}

function aad(context: NominativeEnvelopeContext, version: string) {
  if (!UUID.test(context.institutionId) || !UUID.test(context.importId)) throw new Error("nominative_context_invalid");
  parseBeneficiaryRef(context.beneficiaryRef);
  return Buffer.from(JSON.stringify(["nominative-private-v1", version, context.institutionId, context.importId, context.beneficiaryRef]));
}

export function encryptNominativePayload(value: unknown, context: NominativeEnvelopeContext, config: NominativeEncryptionConfig): NominativeEnvelope {
  const plaintext = Buffer.from(JSON.stringify(value));
  if (plaintext.length > 16384) throw new Error("nominative_payload_too_large");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", config.key, iv);
  cipher.setAAD(aad(context, config.version));
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return { keyVersion: config.version, iv: iv.toString("base64"), authTag: cipher.getAuthTag().toString("base64"), ciphertext: ciphertext.toString("base64") };
}

export function decryptNominativePayload(envelope: NominativeEnvelope, context: NominativeEnvelopeContext, config: NominativeEncryptionConfig): unknown {
  try {
    if (envelope.keyVersion !== config.version || envelope.ciphertext.length > 22000) throw new Error();
    const iv = Buffer.from(envelope.iv, "base64");
    const tag = Buffer.from(envelope.authTag, "base64");
    if (iv.length !== 12 || tag.length !== 16) throw new Error();
    const decipher = createDecipheriv("aes-256-gcm", config.key, iv);
    decipher.setAAD(aad(context, config.version));
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, "base64")), decipher.final()]);
    return JSON.parse(plaintext.toString("utf8"));
  } catch {
    throw new Error("nominative_envelope_invalid");
  }
}

// A badge has little entropy: a public SHA digest would allow guessing it.
// Persist only a keyed version, separate from the encryption key.
export function nominativePrivateFingerprint(parts: unknown[], secret: string | undefined): string {
  if (!secret || secret.length < 32 || secret.length > 512) throw new Error("nominative_fingerprint_key_unavailable");
  return createHmac("sha256", secret).update(JSON.stringify(["nominative-fingerprint-v1", ...parts])).digest("hex");
}

export function nominativeSourceFingerprint(input: { institutionId: string; sourceRef: string; schoolYear: string; contents: string; mapping: unknown }, secret: string | undefined): string {
  if (!UUID.test(input.institutionId)) throw new Error("nominative_context_invalid");
  return nominativePrivateFingerprint([input.institutionId, parseBeneficiaryRef(input.sourceRef), parseSchoolYear(input.schoolYear), input.contents, input.mapping], secret);
}
