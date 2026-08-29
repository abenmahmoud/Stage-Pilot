import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  detectForbiddenSupportSecret,
  FORBIDDEN_SUPPORT_SECRET_MESSAGE,
} from "../shared/support-secret-policy.ts";

test("refuse les secrets explicitement divulgués", () => {
  const cases = [
    ["Mon mot de passe est Azerty123!", "password"],
    ["mdp: rentree2026", "password"],
    ["Code OTP : 739144", "one_time_code"],
    ["Le code reçu par SMS est 481902", "one_time_code"],
    ["Mon code ENT est BC93-2026", "school_access_code"],
    ["code Pronote: 923864", "school_access_code"],
    ["api_key = sk-exampletoken123456789", "api_secret"],
    ["Authorization: Bearer abcdefghijklmnopqrstuvwxyz123456", "api_secret"],
    ["-----BEGIN PRIVATE KEY-----", "private_key"],
  ];

  for (const [value, expected] of cases) {
    assert.equal(detectForbiddenSupportSecret(value), expected, value);
  }
});

test("accepte une demande d'aide qui ne révèle aucun secret", () => {
  const cases = [
    "J'ai oublié mon mot de passe.",
    "Mon mot de passe est incorrect.",
    "Mon code ENT est perdu.",
    "Je n'ai pas reçu le code par SMS.",
    "Pouvez-vous réinitialiser mon accès PRONOTE ?",
    "Mon ENT ne fonctionne plus depuis ce matin.",
    "J'ai besoin de mes codes de connexion.",
  ];

  for (const value of cases) {
    assert.equal(detectForbiddenSupportSecret(value), null, value);
  }
});

test("ne renvoie jamais le secret dans le message de refus", () => {
  const secret = "MotDePasseTresSecret2026!";
  assert.equal(FORBIDDEN_SUPPORT_SECRET_MESSAGE.includes(secret), false);
  assert.match(FORBIDDEN_SUPPORT_SECRET_MESSAGE, /retirez tout mot de passe/i);
});

test("branche la politique avant chaque stockage ou analyse du guichet", async () => {
  const files = [
    "../api/_shared/support.ts",
    "../api/support/assistant.ts",
    "../api/support/requests/[code]/messages.ts",
    "../api/support/requests/[code]/attachments.ts",
    "../api/support/agent/requests/[code]/notes.ts",
    "../api/support/agent/requests/[code]/reply.ts",
    "../api/support/agent/requests/[code]/translate.ts",
    "../api/support/agent/templates.ts",
    "../api/webhooks/brevo/inbound.ts",
  ];

  for (const file of files) {
    const source = await readFile(new URL(file, import.meta.url), "utf8");
    assert.match(source, /assertNoForbiddenSupportSecret/, file);
  }
});
