# LOT 5 — Expiration et avis à l'auteur (persistance flash)

Plan : `docs/operations/PLAN_FLASH_PERSISTANCE_2026-09-05.md`, LOT 5.
Tâche spec associée : T071D (`specs/002-agent-etablissement-adaptatif/tasks.md`,
retrouvée par `grep`, jamais par lecture intégrale du fichier).
Portée exacte du lot : détection serveur des propositions expirées sans
validation, passage d'état, conservation de la proposition, préparation
(jamais l'émission) d'un avis factuel à l'auteur, et un compte de ces échecs
consultable. Aucune correction (LOT 4), aucun écran branché (LOT 6).

## Ce qui est prouvé par une commande réellement exécutée

- `node node_modules/typescript/bin/tsc --noEmit` : aucune sortie, aucune
  erreur.
- `npm run build` : succès (`✓ built in 9.33s`), code 0. `vite build` a de
  nouveau tourné sans problème dans ce shell malgré le piège noté dans
  `CLAUDE.md`.
- `npm run test:flash-expiration` (module étendu) : 8/8 tests verts, dont les
  deux nouveaux sur `buildFlashExpirationAuthorNotice` (message factuel, aucun
  valideur nommé, aucun motif ajouté ; titre/date invalides refusés).
- `npm run test:flash-expiry-cron` (nouveau) : 8/8 tests verts.
- `npm run test:flash-expired-queue` (nouveau) : 5/5 tests verts.
- `npm run test:flash-recette` (chaîne existante + les deux nouveaux
  scripts) : toutes les suites vertes, aucune régression.
- `npm run test:migration-integrity` : 98 migrations, 98 versions uniques,
  aucune anomalie — **aucune migration ajoutée par ce lot** (le statut
  `expiree_sans_validation` et le `resource_type = 'version'` existaient déjà
  dans `20260905013000_create_flash_info_foundation.sql`, LOT 1).
- `npm run test:spec-integrity` : inchangé (627 tâches, 5 specs).
- `npm run test:preview-security-gate` : code de sortie 0, aucun `ℹ fail
  [1-9]`, aucun `not ok`/`✖`/`Error:` dans la sortie complète (balayage fait
  sur le fichier de sortie entier, pas seulement sur la fin affichée).

### Preuve SQL directe (Docker disponible ce soir)

Contrairement au LOT 4 (Docker absent), Docker était disponible cette session.
`npx supabase start` puis `npx supabase db reset` ont rejoué les **98
migrations existantes sans erreur** sur une pile PostgreSQL locale jetable
(aucune commande `--linked`, aucune URL distante). Sur cette pile, avec un
établissement, un auteur et deux propositions fictives créés à la main
(aucune donnée réelle) :

- Une proposition avec `expires_at` dans le passé et `status = 'proposee'` a
  été identifiée par la même condition que `selectExpiredFlashProposals`
  (`expires_at < now()`), rejouée en SQL brut ;
- L'`UPDATE ... WHERE status = 'proposee' AND id IN (...)` exact de la route
  a fait passer **seulement** cette ligne à `expiree_sans_validation` ; la
  seconde proposition (encore dans les temps) est restée `proposee` ;
- L'insertion `flash_info_events` avec `resource_type = 'version'`,
  `actor_type = 'system'`, `actor_user_id = null`,
  `event_type = 'version.expired_without_validation'` a réussi sans violer
  aucune contrainte CHECK ;
- **Idempotence vérifiée** : rejouer le même `UPDATE` une seconde fois renvoie
  `UPDATE 0` (plus aucune ligne `proposee` expirée) ;
- **Conservation vérifiée** : la ligne existe toujours en base après la
  transition (`select count(*) = 1`), jamais supprimée ;
- **Transition illégale interceptée par la base** : un retour forcé
  `expiree_sans_validation -> proposee` est rejeté par le trigger
  `flash_guard_version` avec `invalid_flash_info_version_transition` — le
  même refus que `assertLegalFlashVersionTransition` côté application (double
  filet confirmé, pas une redéfinition divergente).

Cette preuve est bornée au périmètre de ce lot (pas la recette complète du
LOT 7) : elle ne couvre ni RLS, ni un vrai jeton Supabase, ni la route Node
exécutée via un serveur HTTP réel (`requireUser`/`secretMatches` avec un vrai
en-tête `Authorization`). `npx supabase stop` a été exécuté en fin de session
pour arrêter la pile locale ; aucune trace fictive n'a été laissée en dehors
de ce conteneur jetable.

## Fichiers créés

- `api/cron/flash-expiry.ts` — `GET|POST /api/cron/flash-expiry`, protégée
  par `secretMatches(process.env.CRON_SECRET, ...)` (même motif que
  `api/cron/knowledge-expiry.ts`, déjà en place pour un autre domaine). Dans
  une seule transaction : sélectionne toutes les versions `status =
  'proposee'` (`SELECT ... FOR UPDATE`), délègue la décision "expiré ou pas"
  à `selectExpiredFlashProposals` (LOT 1, jamais réécrite), délègue la
  transition à `assertLegalFlashVersionTransition` (LOT 1, jamais réécrite),
  puis en bloc : `UPDATE ... WHERE status = 'proposee' AND id IN (...)` vers
  `expiree_sans_validation`, et une ligne `flash_info_events` par proposition
  expirée (`resource_type = 'version'`, `actor_type = 'system'`,
  `actor_user_id = null`, `event_type =
  'version.expired_without_validation'`, `summary.authorNotice` = l'avis
  préparé par `buildFlashExpirationAuthorNotice`). Aucune suppression,
  aucun envoi, aucun appel externe — vérifié par un test qui lit le fichier
  source.
- `api/flash/validation/expired.ts` — `GET
  /api/flash/validation/expired`. Compte consultable (T071D : « rendre le
  compte de ces échecs consultable ») des propositions
  `status = 'expiree_sans_validation'` de l'établissement de l'acteur, réservé
  au même public que la file de validation (LOT 3,
  `assertFlashValidationQueueAccess`, jamais un contrôle réécrit ici). Répond
  `{ count, items }`, chaque item repassant par `toFlashVersionPayload` (LOT
  1). Refuse d'afficher une liste partielle au-delà de 200 lignes (même motif
  que `queue.ts`).
- `scripts/test-flash-expiry-cron.mjs` — 8 tests. Ne teste pas la route
  contre une base RLS/HTTP (réserve identique aux LOT 3/4) : vérifie par
  lecture du fichier source que la route importe et enchaîne réellement
  `selectExpiredFlashProposals` -> `assertLegalFlashVersionTransition` ->
  `buildFlashExpirationAuthorNotice`, jamais une réimplémentation, et rejoue
  cette composition avec les fonctions réellement importées sur un jeu de
  deux propositions (une expirée, une non).
- `scripts/test-flash-expired-queue.mjs` — 5 tests. Même méthode : vérifie
  par lecture du fichier source que l'accès et le filtre exacts sont
  utilisés, jamais recopiés.

## Fichiers modifiés

- `shared/flash-expiration.ts` — ajoute `buildFlashExpirationAuthorNotice`
  (et son type `FlashExpirationAuthorNotice`), qui prépare le message factuel
  à l'auteur (T071D) : dit seulement que la proposition a expiré, qu'elle
  n'a pas été publiée et que personne n'a été informé — jamais un valideur
  nommé, jamais un motif ajouté. `status` vaut toujours `"a_emettre"` : ce
  module prépare, il n'émet jamais. En-tête du fichier mis à jour (l'ancien
  commentaire renvoyait la préparation du message et le comptage à "LOT 4"
  et "LOT 5" avec une numérotation antérieure à ce plan ; corrigé pour
  refléter que les deux relèvent de ce lot).
- `scripts/test-flash-expiration.mjs` — ajoute 2 tests pour
  `buildFlashExpirationAuthorNotice`.
- `package.json` — ajoute `test:flash-expiry-cron` et
  `test:flash-expired-queue`, les ajoute à la chaîne `test:flash-recette`.
- `vercel.json` — ajoute `api/cron/flash-expiry.ts` à `functions`
  (`maxDuration: 60`, même valeur que `knowledge-expiry`) et une entrée
  `crons` (`*/15 * * * *`). Aucun déploiement déclenché par ce changement de
  fichier local.

## Décisions prises dans ce lot (à confirmer avec Adel)

- **Le balayage est un job de cron global, pas une route par établissement.**
  Même architecture que `api/cron/knowledge-expiry.ts` : protégé par
  `CRON_SECRET`, pas par `requireFlashActor`/`requireConfiguredInstitution`,
  et traite toutes les propositions `proposee` de tous les établissements en
  une passe (chaque ligne insérée dans `flash_info_events` garde son propre
  `institution_id`). Choix cohérent avec le seul précédent existant dans ce
  dépôt pour ce type de tâche, pas une décision produit validée.
- **Fréquence choisie : toutes les 15 minutes (`*/15 * * * *`), pas
  quotidienne.** Une information flash a une expiration bien plus courte
  qu'une source de connaissance (le seul autre cron du dépôt tourne une fois
  par jour) ; ce choix n'est pas confirmé par Adel et peut être resserré ou
  desserré sans changer le code de la route.
- **Le compte des échecs est exposé par établissement
  (`GET /api/flash/validation/expired`), pas par un total global.** Cohérent
  avec le cloisonnement déjà en place partout ailleurs dans le domaine flash
  (LOT 1 à 4) ; personne n'a demandé explicitement une vue inter-
  établissements, et `requireFlashActor` ne donne accès qu'à un seul
  établissement configuré.
- **L'avis à l'auteur est un champ `summary.authorNotice` d'un
  `flash_info_event`, pas une table dédiée.** La contrainte CHECK
  `resource_type in ('flash_info','version','audience','notification',
  'correction_decision')` du LOT 1 n'ouvre aucune valeur du type
  "avis"/"notice" : ajouter une table ou une valeur de contrainte aurait
  exigé une migration, ce qu'aucune tâche de ce lot ne demande explicitement
  et que la pile locale jetable de ce soir n'a pas cherché à couvrir au-delà
  de ce qui existait déjà. Choix le plus compatible avec le schéma existant,
  pas une confirmation produit : un futur lot peut vouloir une vraie table
  d'avis à émettre (avec un état propre, une date d'émission, etc.) si "à
  émettre" doit un jour devenir "émis" pour de vrai.
- **`actor_user_id = null` / `actor_type = 'system'` sur l'événement
  d'expiration.** Personne n'a pris cette décision : c'est le job de fond qui
  la constate. Vérifié en SQL direct que la contrainte l'accepte (voir preuve
  SQL ci-dessus).

## Ce qui reste supposé, pas prouvé

- **Aucune preuve HTTP bout en bout** : ni `requireUser` avec un vrai jeton
  Supabase pour `GET /api/flash/validation/expired`, ni `secretMatches` avec
  un vrai en-tête `Authorization: Bearer` pour le cron — seulement des
  requêtes SQL directes rejouant la composition exacte de la route, et des
  tests qui lisent le fichier source. Réserve identique aux LOT 1 à 4.
- **RLS non exercée** : les insertions/mises à jour de ce soir ont été faites
  avec le rôle `postgres` (superutilisateur), pas avec `service_role` au
  travers de PostgREST/Drizzle ni avec un rôle `authenticated` soumis aux
  politiques RLS. `force row level security` est actif sur les six tables
  flash depuis le LOT 1 mais n'a jamais été testé activement dans aucun de
  ces cinq lots. Réservé au LOT 7.
- **Cloisonnement inter-établissements non exercé pour ce lot précis** :
  un seul établissement fictif a été créé ce soir ; rien ne prouve encore
  qu'une proposition expirée de l'établissement A reste invisible dans
  `GET /api/flash/validation/expired` appelée par un acteur de
  l'établissement B (le filtre `eq(flashInfos.institutionId,
  actor.institutionId)` existe dans le code et suit exactement le motif de
  `queue.ts`, mais n'a pas été rejoué avec deux établissements ce soir).
- **`test:preview-security-gate` ne connaît toujours pas le domaine flash**
  (choix du LOT 1, non révisé ici) : sa réussite ce soir prouve l'absence de
  régression ailleurs dans le dépôt, pas une couverture du domaine flash.
- **Le trou de publication signalé aux LOT 3/4 reste hors du périmètre de ce
  lot** : ce lot ne concerne que `proposee -> expiree_sans_validation`, jamais
  `validee -> publiee`. Il n'ajoute ni ne résout rien à ce trou.

## Commit

Un commit local sur `codex/lycee-connect-prototype`, aucun push.
