import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export const PERSON_ATTRIBUTE_PAYLOAD_SCHEMA = 1;

function context(value: string): string {
  if (typeof value !== "string" || value.length < 3 || value.length > 200) {
    throw new Error("person_attribute_context_invalid");
  }
  return value;
}

function version(value: unknown): string {
  if (typeof value !== "string" || !/^v[1-9][0-9]{0,3}$/.test(value)) {
    throw new Error("person_attribute_key_version_invalid");
  }
  return value;
}

function keyFor(versionValue: string, env: NodeJS.ProcessEnv): Buffer {
  const encoded = env[`PERSON_ATTRIBUTE_ENCRYPTION_KEY_${versionValue.toUpperCase()}`];
  if (typeof encoded !== "string" || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) {
    throw new Error("person_attribute_key_invalid");
  }
  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32 || key.toString("base64") !== encoded) {
    throw new Error("person_attribute_key_invalid");
  }
  return key;
}

function aad(input: {
  version: string;
  institutionId: string;
  importId: string;
  rowId: string;
  personRef: string;
  attributeKey: string;
}) {
  return Buffer.from(
    `lyceegest:person-attribute:1:${version(input.version)}:${context(input.institutionId)}:${context(input.importId)}:${context(input.rowId)}:${context(input.personRef)}:${context(input.attributeKey)}`,
    "utf8"
  );
}

function valueOf(value: unknown): string {
  if (typeof value !== "string" || value.length < 1 || value.length > 2000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) {
    throw new Error("person_attribute_value_invalid");
  }
  return value;
}

export function personAttributeCryptoConfig(env: NodeJS.ProcessEnv = process.env) {
  const keyVersion = version(env.PERSON_ATTRIBUTE_ENCRYPTION_KEY_VERSION);
  return { version: keyVersion, key: keyFor(keyVersion, env) };
}

export function encryptPersonAttributeValue(input: {
  value: string;
  institutionId: string;
  importId: string;
  rowId: string;
  personRef: string;
  attributeKey: string;
  env?: NodeJS.ProcessEnv;
}) {
  const config = personAttributeCryptoConfig(input.env);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", config.key, iv);
  cipher.setAAD(aad({ ...input, version: config.version }));
  const ciphertext = Buffer.concat([cipher.update(valueOf(input.value), "utf8"), cipher.final()]);
  return {
    keyVersion: config.version,
    payloadSchema: PERSON_ATTRIBUTE_PAYLOAD_SCHEMA,
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
}

export function decryptPersonAttributeValue(input: {
  envelope: { keyVersion: string; payloadSchema: number; iv: string; authTag: string; ciphertext: string };
  institutionId: string;
  importId: string;
  rowId: string;
  personRef: string;
  attributeKey: string;
  env?: NodeJS.ProcessEnv;
}) {
  if (input.envelope.payloadSchema !== PERSON_ATTRIBUTE_PAYLOAD_SCHEMA) {
    throw new Error("person_attribute_schema_invalid");
  }
  const configVersion = version(input.envelope.keyVersion);
  const key = keyFor(configVersion, input.env ?? process.env);
  const iv = Buffer.from(input.envelope.iv, "base64");
  const authTag = Buffer.from(input.envelope.authTag, "base64");
  const ciphertext = Buffer.from(input.envelope.ciphertext, "base64");
  if (iv.length !== 12 || authTag.length !== 16 || ciphertext.length < 1 || ciphertext.length > 2000) {
    throw new Error("person_attribute_envelope_invalid");
  }
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAAD(aad({ ...input, version: configVersion }));
  decipher.setAuthTag(authTag);
  return valueOf(Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8"));
}
