import assert from "node:assert/strict";
import test from "node:test";
import {
  createEquipmentExternalSession,
  equipmentExternalCodeHash,
  equipmentExternalCodeMatches,
  generateEquipmentExternalCode,
  verifyEquipmentExternalSession,
} from "../shared/equipment-external-access.mjs";

const secret = "test-secret-with-more-than-thirty-two-bytes-2026";
const grantId = "c2f78d3e-b2b1-4e45-82df-4d67a9b0fef4";

test("hashes and verifies an eight-digit SPIE access code", () => {
  const code = generateEquipmentExternalCode();
  assert.match(code, /^\d{8}$/);
  const codeHash = equipmentExternalCodeHash({ grantId, code, secret });
  assert.match(codeHash, /^[a-f0-9]{64}$/);
  assert.equal(equipmentExternalCodeMatches({ grantId, code, codeHash, secret }), true);
  assert.equal(equipmentExternalCodeMatches({ grantId, code: "00000000", codeHash, secret }), code === "00000000");
  assert.equal(equipmentExternalCodeMatches({ grantId, code: "bad", codeHash, secret }), false);
});

test("signs a short-lived session and rejects tampering or expiry", () => {
  const expiresAt = new Date(Date.now() + 60_000);
  const token = createEquipmentExternalSession({ grantId, expiresAt, secret, nonce: "abcdefghijklmnopqrstuvwxyz" });
  assert.equal(verifyEquipmentExternalSession({ token, secret })?.grantId, grantId);
  assert.equal(verifyEquipmentExternalSession({ token: `${token}x`, secret }), null);
  assert.equal(verifyEquipmentExternalSession({ token, secret, now: expiresAt.getTime() + 1 }), null);
});
