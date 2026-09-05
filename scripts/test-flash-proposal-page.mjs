// Verifications statiques de l'ecran de proposition d'information flash
// (LOT 6 : branchement sur /api/flash/proposals). Pas de rendu reel dans un
// navigateur : ce script relit le code source et verifie par expressions
// regulieres l'envoi reel via `apiFetch` (jamais un appel direct a supabase/
// axios/XMLHttpRequest depuis l'ecran), la presence des garanties exigees par
// le plan de nuit (avertissement "n'a prevenu personne", expiration
// obligatoire, disposition mobile-first sans largeur fixe qui casserait a
// 320 px).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  parseFlashGroupRef,
  FlashAudienceError,
} from "../shared/flash-audience-correction.ts";

const page = readFileSync(
  new URL("../src/pages/admin/FlashProposalPage.tsx", import.meta.url),
  "utf8"
);

test("envoie la proposition via apiFetch, jamais un appel direct au reseau ou a supabase", () => {
  assert.match(page, /import \{ apiFetch \} from "\.\.\/\.\.\/lib\/api"/);
  assert.match(page, /apiFetch<unknown>\("flash\/proposals"/);
  assert.match(page, /method: "POST"/);
  assert.match(page, /"Idempotency-Key": idempotencyKeyRef\.current/);
  assert.doesNotMatch(page, /(?<!api)[Ff]etch\(/);
  assert.doesNotMatch(page, /supabase/i);
  assert.doesNotMatch(page, /axios/i);
  assert.doesNotMatch(page, /XMLHttpRequest/);
  assert.doesNotMatch(page, /\.insert\(/);
});

test("regenere la cle d'idempotence apres un envoi reussi", () => {
  assert.match(page, /idempotencyKeyRef\.current = crypto\.randomUUID\(\)/);
});

test("verifie le contrat de reponse avant d'afficher la confirmation", () => {
  assert.match(page, /isValidFlashInfoVersionPayload/);
  assert.match(page, /isFlashProposalSubmissionPayload/);
});

test("previent explicitement qu'une proposition en attente n'a prevenu personne", () => {
  assert.match(page, /n'a prévenu personne/);
  assert.match(page, /Ouvrir la messagerie du lycée/);
  assert.match(page, /href=\{WEBMAIL_URL\}/);
});

test("rend l'expiration obligatoire et l'importance decidee par la personne, pas par la suggestion seule", () => {
  assert.match(page, /type="datetime-local"/);
  assert.match(page, /required/);
  assert.match(page, /L'agent suggère ; vous décidez\./);
  assert.match(page, /const \[importance, setImportance\] = useState<FlashImportance \| null>\(null\)/);
  assert.match(page, /Choisissez l'importance : la suggestion de l'agent n'est pas une décision\./);
});

test("le SMS reste rattache a des personnes choisies, jamais a un groupe, et n'est pas envoye au serveur (pas de champ dans le contrat LOT 1)", () => {
  assert.match(page, /FICTITIOUS_FLASH_SMS_CONTACTS/);
  assert.match(page, /jamais à un groupe/);
  const bodyMatch = page.match(/body: JSON\.stringify\(\{([\s\S]*?)\}\),/);
  assert.ok(bodyMatch, "le corps de la requete POST doit etre identifiable");
  assert.doesNotMatch(bodyMatch[1], /smsContacts/);
});

test("reste mobile-first : pas de largeur fixe superieure a 320 px qui casserait l'ecran le plus etroit", () => {
  assert.doesNotMatch(page, /min-w-\[(3[3-9]\d|[4-9]\d{2}|\d{4,})px\]/);
  assert.doesNotMatch(page, /<table/);
  assert.match(page, /grid-cols-1 gap-2 sm:grid-cols-2/);
});

test("garde des cibles tactiles d'au moins 40 pixels sur les champs a cocher", () => {
  assert.match(page, /min-h-\[40px\]/);
});

test("les references de groupes fictifs respectent le meme filtre que la base (group_ref, LOT 1/LOT 2)", () => {
  const refs = [...page.matchAll(/ref: "([a-z0-9:_-]+)"/g)].map((match) => match[1]);
  assert.ok(refs.length >= 6, "au moins les groupes et contacts fictifs attendus");
  for (const ref of refs) {
    assert.doesNotThrow(() => parseFlashGroupRef(ref), `${ref} devrait rester un group_ref valide`);
  }
  assert.throws(() => parseFlashGroupRef("nom@exemple.invalid"), FlashAudienceError);
});
