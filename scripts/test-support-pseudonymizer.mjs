import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { pseudonymizeSupportText } from "../shared/support-pseudonymizer.ts";

test("masque les coordonnées et secrets avant analyse IA", () => {
  const input = [
    "Je m'appelle Lina Martin.",
    "Email: lina.martin@example.com",
    "Téléphone: 06 12 34 56 78",
    "Date de naissance: 12/03/2009",
    "INE: 123456789AB",
    "Adresse: 12 rue de Paris 93270 Sevran",
    "Code OTP: 739144",
  ].join("\n");
  const output = pseudonymizeSupportText(input);

  for (const secret of [
    "Lina Martin",
    "lina.martin@example.com",
    "06 12 34 56 78",
    "12/03/2009",
    "123456789AB",
    "12 rue de Paris 93270 Sevran",
    "739144",
  ]) {
    assert.equal(output.includes(secret), false, `La donnée reste visible: ${secret}`);
  }
  assert.match(output, /\[EMAIL_MASQUE\]/);
  assert.match(output, /\[TELEPHONE_MASQUE\]/);
  assert.match(output, /\[NOM_MASQUE\]/);
  assert.match(output, /\[DATE_MASQUEE\]/);
  assert.match(output, /\[IDENTIFIANT_MASQUE\]/);
  assert.match(output, /\[ADRESSE_MASQUEE\]/);
  assert.match(output, /\[SECRET_MASQUE\]/);
});

test("conserve le besoin utile pour le classement", () => {
  const output = pseudonymizeSupportText(
    "Je m'appelle Lina Martin et mon email est parent@example.com. L'ordinateur prêté à mon enfant ne démarre plus."
  );
  assert.match(output, /et mon email est \[EMAIL_MASQUE\]/i);
  assert.match(output, /ordinateur prêté à mon enfant ne démarre plus/i);
});

test("branche le pseudonymiseur sur chaque message envoyé au modèle", async () => {
  const source = await readFile(new URL("../api/_shared/support-agent.ts", import.meta.url), "utf8");
  assert.match(source, /content:\s*pseudonymizeSupportText\(message\.content\)/);
  assert.doesNotMatch(source, /content:\s*message\.content[,\n]/);
  assert.match(source, /store:\s*false/);
});
