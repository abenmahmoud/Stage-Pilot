import assert from "node:assert/strict";
import {
  createCipheriv,
  generateKeyPairSync,
  publicEncrypt,
  randomBytes,
  constants,
} from "node:crypto";
import test from "node:test";
process.env.DATABASE_URL ||= "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
process.env.NEXT_PUBLIC_SUPABASE_URL ||= "http://127.0.0.1:54321";
process.env.SUPABASE_SERVICE_ROLE_KEY ||= "fictitious-service-role-key";
const {
  decryptDepotCodeBundle,
  parseDecryptedDepotCodes,
} = await import("../api/_shared/depot-codes.ts");

function encryptedBundle(plaintext, publicKey) {
  const key = randomBytes(32);
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  cipher.setAAD(Buffer.from("lyceegest-codes-v1", "ascii"));
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final(), cipher.getAuthTag()]);
  const wrapped = publicEncrypt(
    { key: publicKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" },
    key
  );
  const length = Buffer.alloc(2);
  length.writeUInt16BE(wrapped.length);
  key.fill(0);
  return Buffer.concat([Buffer.from("LGC1", "ascii"), length, wrapped, nonce, ciphertext]);
}

test("déchiffre LGC1 puis valide le CSV sans exposer ses valeurs", () => {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const csv = Buffer.from(`reference_personne,type_code,identifiant,code,genere_le
STU-DEMO-301,ent,identifiant-fictif,code-fictif-301,2026-09-07T12:00:00Z
STA-DEMO-301,session,session-fictive,code-fictif-302,2026-09-07T12:00:00Z`, "utf8");
  const bundle = encryptedBundle(csv, publicKey);
  const plaintext = decryptDepotCodeBundle(bundle, {
    LYCEEGEST_CODES_PRIVATE_KEY_PEM: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
  });
  const rows = parseDecryptedDepotCodes(plaintext, "2026-2027");
  assert.equal(rows.length, 2);
  assert.equal(rows[0].service, "ent");
  assert.equal(rows[1].service, "koxo");
  plaintext.fill(0);
});

test("refuse un chiffré altéré avec un message neutre", () => {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const bundle = encryptedBundle(Buffer.from("contenu fictif"), publicKey);
  bundle[bundle.length - 1] ^= 1;
  assert.throws(
    () => decryptDepotCodeBundle(bundle, {
      LYCEEGEST_CODES_PRIVATE_KEY_PEM: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
    }),
    (error) => error.status === 400 && !error.message.includes("contenu fictif")
  );
});

test("refuse les doublons d'attribution avant toute écriture", () => {
  const csv = Buffer.from(`reference_personne,type_code,identifiant,code,genere_le
STU-DEMO-302,ent,identifiant-a,code-fictif-401,2026-09-07
STU-DEMO-302,ent,identifiant-b,code-fictif-402,2026-09-07`, "utf8");
  assert.throws(
    () => parseDecryptedDepotCodes(csv, "2026-2027"),
    (error) => error.status === 400 && !error.message.includes("code-fictif")
  );
});
