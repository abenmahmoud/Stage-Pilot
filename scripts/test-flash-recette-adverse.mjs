// LOT 5 — Recette : fixtures adverses et preuves executees pour les
// informations flash, rejouant les huit scenarios du plan de nuit
// (docs/operations/NIGHT_PLAN_FLASH_2026-09-05.md, section "LOT 5") contre
// les fonctions pures reellement utilisees par l'ecran (LOT 2), pas contre un
// jeu d'essai illustratif. Chaque scenario reproduit la formule exacte de
// decision de `FlashValidationPage.tsx` (`analyzeProposal`) : ce module
// n'exporte pas cette fonction, donc ce script la rejoue a l'identique ici et
// verifie par une expression reguliere que le code source utilise bien la
// meme formule, pour ne pas prouver un comportement que l'ecran n'implemente
// pas reellement.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { analyzeFlashVersionGap } from "../shared/flash-version-diff.ts";
import { resolveFlashAudienceTreatment } from "../shared/flash-audience-correction.ts";
import {
  assertLegalFlashVersionTransition,
  FlashTransitionError,
} from "../shared/flash-transitions.ts";
import { checkFlashProposalExpiration, selectExpiredFlashProposals } from "../shared/flash-expiration.ts";

const validationPage = readFileSync(
  new URL("../src/pages/admin/FlashValidationPage.tsx", import.meta.url),
  "utf8"
);
const proposalPage = readFileSync(
  new URL("../src/pages/admin/FlashProposalPage.tsx", import.meta.url),
  "utf8"
);
const flashSharedFiles = [
  "../shared/flash-version-diff.ts",
  "../shared/flash-audience-correction.ts",
  "../shared/flash-transitions.ts",
  "../shared/flash-expiration.ts",
].map((relative) => readFileSync(new URL(relative, import.meta.url), "utf8"));

/**
 * Reproduit exactement `analyzeProposal` de FlashValidationPage.tsx (ligne
 * ~267-289) : ce n'est pas une reimplementation parallele des regles, c'est
 * la meme composition des fonctions pures du LOT 2, rejouee ici pour prouver
 * le comportement bout en bout de l'ecran, pas seulement celui des modules
 * pris isolement.
 */
function analyzeProposalLikeScreen(previous, next) {
  const gap = analyzeFlashVersionGap(previous.content, next.content);
  const previousAudienceSorted = [...previous.audience].sort();
  const nextAudienceSorted = [...next.audience].sort();
  const audienceChanged =
    previousAudienceSorted.length !== nextAudienceSorted.length ||
    previousAudienceSorted.some((ref, index) => ref !== nextAudienceSorted[index]);
  const audienceTreatment = resolveFlashAudienceTreatment({
    previousAudience: previous.audience,
    nextAudience: next.audience,
    previousNotifiedChannels: previous.notifiedChannels,
    nextImportance: next.content.importance,
  });
  return {
    gap,
    audienceChanged,
    isDecisive: gap.kind === "decisif" || audienceChanged,
    audienceTreatment,
  };
}

test("preuve de wiring : l'ecran utilise bien la formule isDecisive = gap decisif OU audience changee", () => {
  assert.match(validationPage, /isDecisive:\s*gap\.kind === "decisif" \|\| audienceChanged,/);
});

// 1. Correction de forme sur une flash URGENTE -> aucune proposition de
// correction par defaut. Cas adverse : une importance elevee ne doit pas, a
// elle seule, transformer une reformulation en ecart decisif.
test("1. correction de forme sur une flash urgente : aucune proposition de correction (l'urgence ne force pas le decisif)", () => {
  const previous = {
    content: {
      title: "Alerte : sortie scolaire de demain annulée",
      bodyMarkdown: "Merci de prévenir les familles concernées dès ce soir.",
      importance: "urgente",
    },
    audience: ["classe:2ndea", "personnel:enseignants"],
    notifiedChannels: ["push", "email", "sms"],
  };
  const next = {
    content: {
      // Ponctuation, casse et espace insecable modifies, aucun sens different.
      title: "Alerte : sortie scolaire de demain annulée.",
      bodyMarkdown: "merci de prévenir les familles concernées dès ce soir",
      importance: "urgente",
    },
    audience: ["classe:2ndea", "personnel:enseignants"],
  };
  const analysis = analyzeProposalLikeScreen(previous, next);
  assert.equal(analysis.gap.kind, "forme");
  assert.equal(analysis.audienceChanged, false);
  assert.equal(analysis.isDecisive, false, "une flash urgente reformulee sans changement de sens reste 'forme'");
});

// 2. Changement d'heure sur une flash IMPORTANTE -> proposition de
// correction (ecart decisif), meme a public et importance inchanges.
test("2. changement d'heure sur une flash importante : proposition de correction (ecart decisif)", () => {
  const previous = {
    content: {
      title: "Réunion parents-professeurs du niveau terminale, salle polyvalente",
      bodyMarkdown: "La réunion débute à 18h00 précises.",
      importance: "importante",
    },
    audience: ["niveau:terminale"],
    notifiedChannels: ["push"],
  };
  const next = {
    content: {
      title: "Réunion parents-professeurs du niveau terminale, salle polyvalente",
      bodyMarkdown: "La réunion débute à 19h30 précises.",
      importance: "importante",
    },
    audience: ["niveau:terminale"],
  };
  const analysis = analyzeProposalLikeScreen(previous, next);
  assert.equal(analysis.gap.kind, "decisif");
  assert.equal(analysis.gap.importanceChanged, false);
  assert.equal(analysis.gap.normalizedTextChanged, true);
  assert.equal(analysis.isDecisive, true);
});

// 3. Audience reduite -> le retire recoit bien la ligne "ne vous concerne
// plus", sans detail, et rien d'autre.
test("3. audience reduite : le groupe retire recoit la ligne factuelle 'ne vous concerne plus'", () => {
  const treatment = resolveFlashAudienceTreatment({
    previousAudience: ["classe:2ndea", "classe:2ndeb", "personnel:enseignants"],
    nextAudience: ["classe:2ndea", "classe:2ndeb"],
    previousNotifiedChannels: ["push"],
    nextImportance: "importante",
  });
  assert.deepEqual(treatment.removed, ["personnel:enseignants"]);
  assert.equal(treatment.correctionPossible, true);
  // Le texte affiche a l'ecran pour "removed" est une constante fixe, sans
  // detail, jamais derivee du contenu de la nouvelle version.
  assert.match(validationPage, /"Cette information ne vous concerne plus\."/);
});

// 4. Audience elargie -> l'ajoute recoit une information NEUVE, jamais
// presentee comme une correction pour lui.
test("4. audience elargie : le groupe ajoute recoit une information neuve, pas une correction", () => {
  const treatment = resolveFlashAudienceTreatment({
    previousAudience: ["classe:2ndea"],
    nextAudience: ["classe:2ndea", "classe:2ndeb"],
    previousNotifiedChannels: ["push", "email"],
    nextImportance: "urgente",
  });
  assert.deepEqual(treatment.added, ["classe:2ndeb"]);
  assert.deepEqual(treatment.maintained, ["classe:2ndea"]);
  assert.equal(treatment.correctionPossible, true);
  assert.match(
    validationPage,
    /`Nouvelle information \(pas une correction\) : \$\{proposal\.next\.content\.title\}`/
  );
});

// 5. Flash NORMALE modifiee -> aucune correction possible, seul le site
// change. Cas adverse : le public change reellement (donc l'ecart est
// decisif via audienceChanged), mais l'importance reste normale : le module
// doit quand meme renvoyer les trois ensembles vides, jamais un ensemble
// fantome qui laisserait croire qu'un envoi est possible.
test("5. flash normale modifiee, meme avec un public reellement different : aucune correction possible", () => {
  const previous = {
    content: {
      title: "Menu de cantine de la semaine disponible sur le site",
      bodyMarkdown: "Consultez le menu complet sur la page cantine.",
      importance: "normale",
    },
    audience: ["parents:cantine"],
    notifiedChannels: [],
  };
  const next = {
    content: {
      title: "Menu de cantine de la semaine, mis à jour",
      bodyMarkdown: "Consultez le menu complet et actualisé sur la page cantine.",
      importance: "normale",
    },
    audience: ["parents:cantine", "personnel:administratif"],
  };
  const analysis = analyzeProposalLikeScreen(previous, next);
  assert.equal(analysis.audienceChanged, true, "le public a bien reellement change");
  assert.equal(analysis.isDecisive, true, "l'ecart est decisif via le changement de public");
  assert.equal(analysis.audienceTreatment.correctionPossible, false);
  assert.deepEqual(analysis.audienceTreatment.maintained, []);
  assert.deepEqual(analysis.audienceTreatment.removed, []);
  assert.deepEqual(analysis.audienceTreatment.added, [], "aucun ensemble fantome malgre le changement reel de public");
  assert.match(
    validationPage,
    /La nouvelle version reste normale : seul le site est mis à jour, aucun envoi n'est possible\./
  );
});

// 6. Normale -> urgente -> tout le public passe en ajoutes (information
// neuve), jamais en correction. Entrees volontairement non triees et
// dupliquees pour verifier que le dedoublonnage/tri du module n'est pas
// contourne par un adversaire.
test("6. passage normale -> urgente : tout le public passe en ajoutes (deduplique et trie)", () => {
  const treatment = resolveFlashAudienceTreatment({
    previousAudience: ["classe:2ndeb", "classe:2ndea", "classe:2ndea"],
    nextAudience: ["classe:2ndea", "classe:2ndeb", "classe:2ndeb"],
    previousNotifiedChannels: [], // une flash normale ne notifie jamais reellement
    nextImportance: "urgente",
  });
  assert.deepEqual(treatment.maintained, []);
  assert.deepEqual(treatment.removed, []);
  assert.deepEqual(treatment.added, ["classe:2ndea", "classe:2ndeb"]);
  assert.equal(treatment.correctionPossible, false);
  assert.match(
    validationPage,
    /ceci n'est pas une correction,\s*\n?\s*c'est une information neuve pour tout le public visé/
  );
});

// 7. Proposition expiree sans validation -> auteur prevenu, echec compte.
// Cas adverse : egalite exacte instant/expiration (limite), et une
// proposition deja validee dont l'expiration est passee ne doit JAMAIS
// compter comme un echec (elle a deja recu une decision humaine).
test("7. proposition expiree sans validation : limite exacte comptee, une proposition deja validee ne compte jamais", () => {
  const expiresAt = new Date("2026-09-05T06:00:00.000Z");
  const exactlyAtExpiration = checkFlashProposalExpiration({
    status: "proposee",
    expiresAt,
    now: new Date(expiresAt.getTime()),
  });
  assert.equal(exactlyAtExpiration.isExpiredWithoutValidation, true, "l'egalite exacte compte comme expiree, pas comme 'still_pending'");
  assert.equal(exactlyAtExpiration.reason, "expired_without_validation");

  const alreadyValidatedPastExpiration = checkFlashProposalExpiration({
    status: "validee",
    expiresAt,
    now: new Date(expiresAt.getTime() + 60 * 60 * 1000),
  });
  assert.equal(alreadyValidatedPastExpiration.isExpiredWithoutValidation, false);
  assert.equal(alreadyValidatedPastExpiration.reason, "not_applicable");

  const now = new Date(expiresAt.getTime() + 60 * 60 * 1000);
  const mixed = [
    { id: "a", status: "proposee", expiresAt },
    { id: "b", status: "validee", expiresAt },
    { id: "c", status: "proposee", expiresAt: new Date(now.getTime() + 60 * 60 * 1000) },
  ];
  const expired = selectExpiredFlashProposals(mixed, now);
  assert.deepEqual(
    expired.map((proposal) => proposal.id),
    ["a"],
    "seule la proposition encore en attente et hors delai compte comme un echec"
  );

  assert.match(
    validationPage,
    /cette proposition n'a pas été publiée, faute de\s*\n?\s*validation à temps, et personne n'a été informé\./
  );
  assert.doesNotMatch(validationPage, /la faute (du|de la|d'un|d'une)/i);
  assert.match(validationPage, /Échecs comptés et consultables/);
});

// 8. Transition illegale -> refusee. Cas adverses : retour en arriere,
// depuis un etat terminal, non-transition (meme etat), et statut inconnu
// (chaine corrompue/injectee) des deux cotes.
test("8. transitions illegales refusees : retour en arriere, etat terminal, non-transition, statut inconnu", () => {
  assert.throws(
    () => assertLegalFlashVersionTransition("publiee", "validee"),
    (error) => error instanceof FlashTransitionError && error.reason === "transition_illegal",
    "une version publiee ne peut pas revenir a validee"
  );
  assert.throws(
    () => assertLegalFlashVersionTransition("modifiee", "publiee"),
    (error) => error instanceof FlashTransitionError && error.reason === "transition_illegal",
    "'modifiee' est un etat terminal, aucune transition sortante"
  );
  assert.throws(
    () => assertLegalFlashVersionTransition("proposee", "proposee"),
    (error) => error instanceof FlashTransitionError && error.reason === "not_a_transition"
  );
  assert.throws(
    () => assertLegalFlashVersionTransition("annulee", "validee"),
    (error) => error instanceof FlashTransitionError && error.reason === "from_status_invalid",
    "un statut d'origine invalide/corrompu est refuse, pas silencieusement ignore"
  );
  assert.throws(
    () => assertLegalFlashVersionTransition("validee", "annulee"),
    (error) => error instanceof FlashTransitionError && error.reason === "to_status_invalid"
  );

  assert.match(validationPage, /assertLegalFlashVersionTransition\(from, target\)/);
  assert.match(validationPage, /Transition refusée : \{transitionError\}/);
});

// Verification transverse demandee par le plan : "verifier aussi que la
// simulation ne declenche aucun appel externe, et que rien dans le code du
// lot ne peut envoyer un message." Balayage independant de TOUS les fichiers
// flash (LOT 1 excepte, migration SQL hors perimetre JS/TS), pas seulement de
// l'ecran de validation deja couvert par test:flash-validation-page.
/**
 * Retire les commentaires (`//...` et `/* ... *\/`) avant le balayage : le
 * module `flash-transitions.ts` mentionne legitimement le nom du fichier de
 * migration Supabase dans un commentaire (double filet documente avec le
 * trigger SQL) ; ce n'est pas un appel reseau et ne doit pas faire echouer le
 * test. Le code executable, lui, ne doit jamais mentionner ces mots.
 */
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

test("aucun fichier flash (LOT 2/3/4) ne contient de code executable capable d'emettre un message ou d'appeler un service externe", () => {
  const forbidden = [
    /fetch\(/,
    /supabase/i,
    /axios/i,
    /XMLHttpRequest/,
    /WebSocket/i,
    /nodemailer/i,
    /twilio/i,
    /sendMail/i,
    /sendGrid/i,
    /\.insert\(/,
    /\.from\(/,
    /child_process/,
  ];
  const files = [validationPage, proposalPage, ...flashSharedFiles].map(stripComments);
  for (const source of files) {
    for (const pattern of forbidden) {
      assert.doesNotMatch(source, pattern);
    }
  }
});
