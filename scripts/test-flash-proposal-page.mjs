import { flashAudienceOptions } from '../shared/flash-audience-groups.mjs';
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

const picker=readFileSync(new URL("../src/components/FlashAudiencePicker.tsx",import.meta.url),"utf8");
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

test("le SMS reste rattache a des personnes choisies, jamais a un groupe, et est desormais envoye au serveur sous smsContactRefs (LOT 3 du plan de publication publique, contrat etendu depuis le LOT 1)", () => {
  assert.doesNotMatch(page, /FICTITIOUS_FLASH_SMS_CONTACTS/);
  assert.match(page, /Aucun SMS ne part de cet écran/);
  const bodyMatch = page.match(/body: JSON\.stringify\(\{([\s\S]*?)\}\),/);
  assert.ok(bodyMatch, "le corps de la requete POST doit etre identifiable");
  assert.match(bodyMatch[1], /smsContactRefs:\s*smsContacts/);
});

test("reste mobile-first : pas de largeur fixe superieure a 320 px qui casserait l'ecran le plus etroit", () => {
  assert.doesNotMatch(page, /min-w-\[(3[3-9]\d|[4-9]\d{2}|\d{4,})px\]/);
  assert.doesNotMatch(page, /<table/);
  assert.match(picker, /grid-cols-1 gap-2 sm:grid-cols-2/);
});

test("garde des cibles tactiles d'au moins 40 pixels sur les champs a cocher", () => {
  assert.match(page, /min-h-\[40px\]/);
});

// LOT 3 du plan de correction visible
// (docs/operations/PLAN_FLASH_CORRECTION_VISIBLE_2026-09-05.md) : avant ce
// lot, FLASH_PUBLIC_AUDIENCE_GROUP_REF n'avait aucun chemin depuis l'ecran,
// donc aucune flash proposee ne pouvait jamais atteindre la route publique
// par un usage normal.

test("le sélecteur commun distingue le site public des audiences issues de l’annuaire",()=>{
  assert.match(page,/FlashAudiencePicker/);
  assert.match(picker,/Visible par tous, sans connexion/);
  assert.match(picker,/flash\/audiences/);
});

test("les references de groupes issues des classes respectent le meme filtre que la base (group_ref, LOT 1/LOT 2)", () => {
  const refs = flashAudienceOptions(["2GT A","2GT B"]).map(group=>group.ref);
  assert.ok(refs.length >= 6, "profils et classes fictives de recette");
  for (const ref of refs) {
    assert.doesNotThrow(() => parseFlashGroupRef(ref), `${ref} devrait rester un group_ref valide`);
  }
  assert.throws(() => parseFlashGroupRef("nom@exemple.invalid"), FlashAudienceError);
});
