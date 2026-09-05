# LOT 6 — Brancher les écrans (persistance flash)

Plan : `docs/operations/PLAN_FLASH_PERSISTANCE_2026-09-05.md`, LOT 6.
Tâche spec associée : T071E (`specs/002-agent-etablissement-adaptatif/tasks.md`,
retrouvée par `grep`, jamais par lecture intégrale du fichier — le fichier
fait 355 Ko et n'a pas été lu en entier non plus).
Portée exacte du lot : remplacer les jeux d'essai `useState` de
`FlashProposalPage.tsx` et `FlashValidationPage.tsx` par les routes réelles
des LOT 1 à 5, et faire remonter jusqu'à l'écran de validation ce que le
serveur autorise vraiment (T071E), plutôt qu'un contrôle par rôle recalculé
côté client. Drapeaux inchangés, tous fermés. Aucune migration touchée.

## Ce qui est prouvé par une commande réellement exécutée

- `node node_modules/typescript/bin/tsc --noEmit` : aucune sortie, aucune
  erreur, après correction d'un renommage incomplet (`setPrepared` restant
  dans quatre `onChange` alors que l'état avait été renommé `submitted` —
  détecté par cette commande, pas deviné).
- `npm run build` : succès (`✓ built in 8.22s`), code 0. `vite build` a de
  nouveau tourné sans problème dans ce shell — le piège noté dans
  `CLAUDE.md` ne s'est pas reproduit ce soir non plus (déjà noté au LOT 5).
  Les deux écrans apparaissent bien comme chunks séparés dans la sortie
  (`FlashProposalPage-*.js`, `FlashValidationPage-*.js`).
- `npm run test:flash-proposal-page` (réécrit) : 9/9 verts.
- `npm run test:flash-validation-page` (réécrit) : 8/8 verts.
- `npm run test:flash-recette-adverse` (modifié) : 9/9 verts.
- `npm run test:flash-recette` (chaîne complète, LOT 1 à 6) : toutes les
  suites vertes, aucune régression sur les modules purs ni sur les routes
  serveur des LOT 1 à 5 (ces routes n'ont pas été touchées par ce lot).
- `npm run test:spec-integrity` : inchangé (627 tâches, 5 specs).
- `npm run test:migration-integrity` : 98 migrations, 98 versions uniques —
  **aucune migration touchée par ce lot**, comme attendu (LOT 6 est un lot
  d'écran, pas de schéma).
- `npm run test:preview-security-gate` : code de sortie 0 ; sortie complète
  balayée (pas seulement la fin affichée) pour `✖`, `not ok`, `ℹ fail [1-9]` —
  aucune occurrence.

Aucune recette navigateur n'a été faite (Chromium, clic réel sur les
boutons) : c'est le périmètre du LOT 8, pas de celui-ci. Rien ci-dessus ne
prouve qu'un clic réel sur "Valider" dans un vrai navigateur, avec un vrai
jeton Supabase, aboutit — seulement que le code compile, type-check, et que
les tests statiques/unitaires (lecture de fichier source + appel direct des
modules) passent.

## Fichiers modifiés

- `src/pages/admin/FlashProposalPage.tsx` — le bouton « Préparer la
  proposition (simulation) » devient « Envoyer la proposition » et appelle
  réellement `POST /api/flash/proposals` via `apiFetch` (LOT 2), avec un
  en-tête `Idempotency-Key` généré par `crypto.randomUUID()` et régénéré
  après un envoi réussi (même motif que `LyceeConnectPrototype.tsx`). La
  réponse est vérifiée par `isValidFlashInfoVersionPayload` (LOT 1) avant
  affichage. La carte de confirmation affiche désormais les valeurs
  **retournées par le serveur** (titre, importance, statut, canaux,
  expiration), plus l'indication que l'envoi était un doublon
  (`duplicate: true`) le cas échéant, au lieu d'un aperçu recalculé
  localement. Le public visé (groupes) et les contacts SMS restent un jeu
  d'essai fictif : aucun annuaire réel n'existe encore pour ces deux
  listes, ce n'est pas dans le périmètre de ce lot.
- `src/pages/admin/FlashValidationPage.tsx` — remplacement complet des
  générateurs `buildFictitiousPendingProposals`/`buildFictitiousExpiredProposals`
  par deux appels réels au chargement (`GET /api/flash/validation/queue`,
  `GET /api/flash/validation/expired`, en parallèle), chacun vérifié par les
  contrats stricts du LOT 1 (`isValidFlashInfoVersionPayload`,
  `isValidFlashValidationAccessPayload`) avant d'entrer dans l'état React.
  Le bouton « Valider »/« Refuser » appelle réellement
  `POST /api/flash/proposals/[id]/decision` (LOT 3, `content: null` — pas de
  modification de texte dans ce lot) et recharge la file après confirmation.
  **T071E** : l'autorisation affichée pour chaque proposition vient de
  `access` — le `FlashValidationAccessPayload` que la route calcule déjà
  côté serveur à partir de `serviceCodes` (`decideFlashValidationAccess`,
  LOT 1/3) — et non d'un rôle recalculé à l'écran. Un compte sans le service
  voit le motif exact (`service_not_granted`/`self_validation_forbidden`,
  traduit) au lieu des boutons ; c'est la remontée effective de
  `serviceCodes` jusqu'à l'écran, via la décision déjà prise, pas la liste
  brute des codes.

## Ce qui a été retiré de l'écran de validation, et pourquoi

La démonstration de correction du LOT 3/4 (comparaison `previous`/`next`,
`analyzeFlashVersionGap`, `resolveFlashAudienceTreatment`, recalcul client de
`assertLegalFlashVersionTransition`) a été retirée de
`FlashValidationPage.tsx`, pour une raison factuelle et non une préférence de
style : **aucune route existante ne renvoie ce dont cette démonstration avait
besoin**.

- `GET /api/flash/validation/queue` renvoie une seule version courante par
  proposition (`FlashInfoVersionPayload`), jamais une version précédente ni
  l'audience (`flash_info_audiences` n'est lue par aucune route GET flash à
  ce jour, LOT 1 à 5 inclus).
- La correction réelle (LOT 4, `POST /api/flash/proposals/[id]/correction`)
  s'applique à une version déjà `publiee` ; aucune route ne liste les
  informations flash publiées, donc l'écran n'a aujourd'hui aucun moyen
  d'obtenir un `flashInfoId` publié à corriger.
- Le serveur (`decision.ts`) est déjà seul juge de la légalité de la
  transition ; recalculer `assertLegalFlashVersionTransition` côté client
  sur une file qui ne contient de toute façon que des propositions
  `status = 'proposee'` (filtrées par la route) aurait été une duplication
  de règle métier sans valeur, contraire à la règle commune n°5 du plan.

Continuer d'afficher cette démonstration avec des données fictives à côté
d'une file désormais réelle aurait mélangé simulation et réalité sur le même
écran sans le dire clairement : retrait plutôt que camouflage.

Le script `scripts/test-flash-recette-adverse.mjs` gardait des assertions
qui relisaient le **source** de l'écran pour vérifier cette démonstration
(formule `isDecisive`, textes affichés). Ces assertions ont été retirées ;
les scénarios eux-mêmes (1 à 8), qui prouvent le comportement des modules
purs du LOT 2 indépendamment de tout écran, sont inchangés et toujours
verts. `scripts/test-flash-proposal-page.mjs` et
`scripts/test-flash-validation-page.mjs` ont été réécrits pour vérifier la
réalité de ce lot (appel `apiFetch` réel, vérification stricte des
contrats de réponse, autorisation par service remontée) plutôt que
l'absence d'appel réseau, qui était l'invariant du lot précédent et
l'inverse de l'objectif de celui-ci.

## Décisions prises dans ce lot (à confirmer avec Adel)

- **`serviceCodes` remonte via la décision déjà prise (`access`), jamais en
  valeur brute.** Envoyer les codes de service bruts au navigateur aurait
  obligé l'écran à réimplémenter `decideFlashValidationAccess` côté client
  pour savoir qui peut agir — exactement la duplication que la règle
  commune n°5 interdit. Le contrat `FlashValidationAccessPayload` existait
  déjà (LOT 1) et porte l'information utile (`allowed`, `selfValidated`,
  `grantedByService`, `reason`) : c'est ce contrat qui est affiché.
- **Aucune modification de texte avant validation dans ce lot**
  (`content: null` systématique). La route `decision.ts` accepte un
  contenu édité (LOT 3, « valider avec modifications »), mais construire cet
  écran d'édition est un travail d'écran distinct, non explicitement demandé
  par ce lot (« brancher les écrans », pas « ajouter un formulaire
  d'édition »). Un compte qui veut modifier une proposition avant validation
  doit aujourd'hui la refuser puis redemander une nouvelle proposition à
  l'auteur — dégradation réelle par rapport à la démonstration retirée, à
  corriger dans un lot dédié si Adel le confirme utile.
- **Les contacts SMS choisis ne sont pas envoyés au serveur.** En relisant
  `shared/flash-proposal-input.ts` (LOT 2) pour construire l'appel réel, la
  liste `ALLOWED_FIELDS` ne contient pas de champ `smsContacts` : le contrat
  serveur accepte seulement `channels` (qui peut inclure `"sms"`), jamais la
  liste des destinataires choisis. C'est un trou du LOT 1/2 découvert par ce
  lot, pas introduit par lui : la sélection de contacts SMS à l'écran reste
  décorative tant qu'aucun champ ni table ne porte cette information côté
  serveur.

## Ce qui reste supposé, pas prouvé

- **Aucune preuve HTTP bout en bout ni recette navigateur** : ni un vrai
  jeton Supabase pour `apiFetch`, ni un clic réel dans Chromium. Réserve
  identique aux LOT 1 à 5, non levée par ce lot (LOT 7 et LOT 8).
- **Le public visé (audience) et le nom de l'auteur restent invisibles sur
  l'écran de validation.** Ce n'est pas un oubli de ce lot : aucune route
  actuelle ne les renvoie (voir section ci-dessus). L'écran le dit
  explicitement à l'utilisateur plutôt que d'inventer un affichage.
- **La publication (`validee -> publiee`) reste non branchée**, comme
  documenté depuis le LOT 3 : valider une proposition l'enregistre en base
  mais ne la fait apparaître nulle part côté public. Le message affiché à
  l'écran après validation le dit explicitement.
- **La correction après publication (LOT 4) et l'édition avant validation
  (LOT 3) restent des routes serveur fonctionnelles mais sans écran** : leurs
  tests dédiés (`test:flash-correction`, `test:flash-decision-input`)
  continuent de passer, prouvant que les routes elles-mêmes n'ont pas
  régressé, pas qu'un écran les utilise.
- **RLS non exercée par ce lot** : aucun changement de schéma, aucune
  requête SQL directe faite ce soir. Réserve inchangée, réservée au LOT 7.

## Commit

Un commit local sur `codex/lycee-connect-prototype`, aucun push.
