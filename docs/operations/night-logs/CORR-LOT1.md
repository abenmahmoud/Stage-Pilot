# LOT 1 — Ouvrir la transition et protéger l'affichage, pur et testé

5 septembre 2026. Plan : `docs/operations/PLAN_FLASH_CORRECTION_VISIBLE_2026-09-05.md`.
Session unique, LOT 1 seulement, conformément au même découpage que les plans
précédents (LOT 1 = module partagé pur, sans base ni réseau — voir
`PUBLIC-LOT1.md`).

## Ce qui a été fait

### 1. `modifiee -> publiee` devient une transition légale

`shared/flash-transitions.ts` : `LEGAL_TRANSITIONS.modifiee` passe de `[]`
(terminal) à `["publiee"]`. Conséquences directes, toutes vérifiées par test :

- `isFlashVersionStatusTerminal("modifiee")` retourne maintenant `false`.
- Une même ligne peut désormais faire l'aller-retour `publiee -> modifiee ->
  publiee -> modifiee -> ...` indéfiniment (correction, republication,
  nouvelle correction), pas seulement un aller simple.
- Rester sur `modifiee` (`modifiee -> modifiee`) reste refusé
  (`not_a_transition`), et aucune autre transition vers ou depuis `modifiee`
  n'a été ouverte au-delà de ce seul aller-retour avec `publiee`.

### 2. La règle de visibilité protège l'affichage contre la disparition

`shared/flash-visibility.ts` : ajout de `selectLatestVisibleFlashVersionPerInfo`
et du type `FlashVisibilityFlashCandidate` (`{ flashInfoId, version, ... }`).

`selectVisibleFlashVersions` (LOT 1 du plan de visibilité publique, inchangé)
reste la seule autorité sur *ce qui* est visible : un statut différent de
`publiee`, une expiration atteinte ou une audience non autorisée excluent déjà
une version, que cette version soit une ancienne publication supplantée ou une
nouvelle correction pas encore publiée — dans les deux cas le résultat correct
est « non visible individuellement », ce que le module faisait déjà avant ce
lot.

Ce qui manquait : une garantie explicite, testée, qu'entre plusieurs versions
d'une **même** information flash, on ne retient jamais que la plus récente
réellement publiée — en défense en profondeur, pour le cas où la persistance
laisserait un jour deux versions `publiee` simultanées pour la même
information (ce qui ne devrait jamais arriver, mais que ce module pur ne
suppose pas).

### 3. Tests — les quatre scénarios du plan, plus les cas limites

`scripts/test-flash-visibility.mjs` (+7 tests) et
`scripts/test-flash-transitions.mjs` (+2 tests, 1 modifié) :

- correction enregistrée puis non publiée → l'ancienne version `publiee`
  reste seule servie ;
- correction publiée → la nouvelle version remplace l'ancienne ;
- correction publiée mais déjà expirée → rien n'est servi ;
- deux corrections successives → seule la toute dernière version publiée est
  visible ;
- deux informations distinctes n'interfèrent jamais entre elles ;
- défense en profondeur : deux versions `publiee` simultanées de la même
  information (cas qui ne devrait jamais arriver) → seule la plus récente est
  retenue, jamais un doublon ;
- transitions : `modifiee -> publiee` légale, aller-retour répété légal,
  `modifiee` n'est plus terminal, `modifiee -> modifiee` toujours refusé.

## Preuves réellement exécutées

- `npm run test:flash-transitions` → 8/8 tests passés.
- `npm run test:flash-visibility` → 17/17 tests passés.
- `npm run test:flash` (agrégat, inclut aussi flash-public-feed et
  flash-public-route) → tout vert, aucune régression sur les routes
  existantes qui consomment ces deux modules.
- `npm run test:flash-correction` → 10/10 tests passés (la route de
  correction, qui appelle déjà `assertLegalFlashVersionTransition`, continue
  de fonctionner à l'identique : elle ne demande jamais `modifiee ->
  publiee`, donc l'ouverture de cette transition ne la change pas).
- `node node_modules/typescript/bin/tsc --noEmit` → aucune erreur.
- `npm run test:preview-security-gate` → intégralement vert.
- `npm run test:spec-integrity` → vert (635 tâches, comptage inchangé par ce
  lot).

Aucune de ces preuves n'est une recette PostgreSQL réelle ni une recette
navigateur : ce sont des exécutions locales de tests purs et de compilation,
conformément à CLAUDE.md. `vite build` n'a pas pu être rejoué dans ce shell
(piège connu, binaires natifs Windows de rollup absents) ; seul le typage
(`tsc --noEmit`) a été vérifié.

## Ce qui reste supposé, pas prouvé

- **Écart réel entre ce module et la base.** Le trigger `flash_guard_version`
  (`supabase/migrations/20260905013000_create_flash_info_foundation.sql`,
  lignes 256-262) n'autorise que `old.status = 'publiee' and new.status =
  'modifiee'` — il refusera aujourd'hui toute tentative réelle de
  `modifiee -> publiee` avec `invalid_flash_info_version_transition`. Ce lot
  ne touche à aucune migration (hors périmètre du LOT 1, comme pour les plans
  précédents). Documenté explicitement dans le code
  (`shared/flash-transitions.ts`, commentaire d'en-tête) pour qu'il ne soit
  pas manqué : **une migration doit ouvrir cette même transition côté trigger
  avant que la route de publication (LOT existant `publication.ts`) puisse
  réellement republier une correction sur une base réelle.**
- **`selectLatestVisibleFlashVersionPerInfo` n'est branché sur aucune route.**
  `api/content/flash/public.ts` (LOT 2 du plan de visibilité publique)
  continue d'utiliser `selectVisibleFlashVersions` seul et de ne lire qu'UNE
  ligne par information (jointure sur `flash_infos.current_version`). Ce lot
  ne modifie pas cette route : c'est un module pur prêt à être branché, pas
  encore une garantie en production.
- **La route `correction.ts` existante ne crée pas de nouvelle version : elle
  mute la même ligne en place** (title/body/etc. écrasés, statut
  `publiee -> modifiee`), comme documenté dans son propre en-tête. Avec ce
  mécanisme, le contenu de l'ancienne version publiée n'existe plus nulle part
  ailleurs que dans `flash_info_events.summary.before` (trace d'audit, pas une
  source de service) au moment où la correction est enregistrée. **Le
  problème que ce plan cherche à résoudre — l'ancienne version doit rester
  affichée telle quelle jusqu'à republication — n'est donc pas encore résolu
  en pratique : ce lot pose la règle et le graphe purs et les prouve par test,
  mais ni `correction.ts` ni `publication.ts` ni `public.ts` n'ont été
  modifiés pour que la persistance réelle respecte cette règle.** C'est,
  d'après la même convention que les plans précédents (LOT 1 = règle pure),
  du travail pour un lot suivant, mais il faut le trancher avec Adel avant de
  déclarer le plan terminé : soit LOT 2/3 doivent aussi changer la
  persistance (pas seulement l'écran), soit un lot dédié doit être ajouté.
- Aucune ligne de base, aucune migration, aucun appel réseau, aucun drapeau
  ouvert : conforme au périmètre strict du LOT 1.

## Portée strictement respectée

Fichiers touchés, rien d'autre :

- `shared/flash-transitions.ts`
- `shared/flash-visibility.ts`
- `scripts/test-flash-transitions.mjs`
- `scripts/test-flash-visibility.mjs`

Aucune route, aucun composant, aucune migration, aucun drapeau. Aucun envoi,
aucune donnée réelle.
