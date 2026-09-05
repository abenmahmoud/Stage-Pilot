# LOT 3 — Valider, refuser, modifier (persistance flash)

Plan : `docs/operations/PLAN_FLASH_PERSISTANCE_2026-09-05.md`, LOT 3.
Portée exacte du lot : la file de validation et la décision (valider / refuser
/ modifier) sur une proposition en attente. Aucune publication (transition
`validee` -> `publiee`), aucune correction après publication (LOT 4), aucune
expiration automatique (LOT 5).

## Ce qui est prouvé par une commande réellement exécutée

- `node node_modules/typescript/bin/tsc --noEmit` : aucune sortie, aucune erreur.
- `npm run build` : succès (`✓ built in 8.91s`), code 0. Contrairement au piège
  noté dans `CLAUDE.md` le 3 septembre, `vite build` a tourné sans problème ce
  soir dans ce shell (même constat que Docker au LOT 2 : un blocage antérieur
  n'est pas une garantie qu'il persiste).
- `npm run test:flash-decision-input` (nouveau) : 8/8 tests verts.
- `npm run test:flash-recette` (chaîne existante + le nouveau script) : toutes
  les suites vertes, aucune régression sur `flash-transitions`,
  `flash-version-diff`, `flash-audience-correction`, `flash-expiration`,
  `flash-proposal-page`, `flash-validation-page`, `flash-recette-adverse`,
  `flash-validation-access` (y compris après le refactor de
  `grantedFlashValidationService`, voir plus bas), `flash-access`,
  `flash-payload-policy`, `flash-proposal-input`, `flash-decision-input`.
- `npm run test:migration-integrity` : 98 migrations, 98 versions uniques,
  aucune anomalie — **aucune migration ajoutée par ce lot** (voir plus bas,
  ce lot n'a eu besoin d'aucune colonne ni fonction SQL nouvelle).
- `npm run test:spec-integrity` : inchangé (627 tâches, 5 specs), aucune
  régression.
- `npm run test:preview-security-gate` : code de sortie 0, aucun `ℹ fail
  [1-9]` dans la sortie complète.
- Docker était de nouveau disponible ce soir. `npx supabase db reset` a rejoué
  les 98 migrations existantes (aucune nouvelle) sans erreur sur la pile
  locale jetable. Sur cette pile, avec un établissement et deux acteurs
  fictifs créés à la main (aucune donnée réelle), en exécutant *exactement*
  les requêtes que la route `decision.ts` exécute (mêmes colonnes, mêmes
  clauses `WHERE`) :
  - **"Modifier"** : une seule `UPDATE` qui édite `title`/`importance` et fait
    passer `status` de `proposee` à `validee` avec `validated_by`/
    `validated_at` renseignés, en une seule opération — confirme que le
    contenu et le statut peuvent être écrits ensemble sans violer le trigger
    `flash_guard_version` ni les contraintes CHECK ;
  - **Verrou de concurrence** : rejouer la même `UPDATE ... WHERE status =
    'proposee'` sur une ligne déjà décidée renvoie `UPDATE 0` — c'est
    exactement la garde utilisée par `decision.ts` pour qu'une seconde
    décision simultanée ne puisse jamais écraser la première ;
  - **Transition illégale interceptée par la base** : un saut direct
    `proposee` -> `publiee` (sans passer par `validee`) est rejeté par le
    trigger avec `invalid_flash_info_version_transition` — le même code que
    `assertLegalFlashVersionTransition` (LOT 1) refuse déjà côté application ;
    double filet confirmé, pas une redéfinition divergente ;
  - **"Refuser"** : une `UPDATE ... WHERE status = 'proposee'` isolée fait
    passer une version à `refusee` avec `validated_by`/`validated_at`
    renseignés (la base exige ces deux champs même pour un refus — vérifié) ;
  - **Journal** : une ligne `flash_info_events` avec
    `event_type = 'flash_info.validated_with_changes'` s'insère sans violer la
    contrainte de forme (`^[a-z][a-z0-9_]*([.][a-z][a-z0-9_]*)+$`) ;
  - **Audience éditée** : un remplacement `DELETE` puis `INSERT` sur
    `flash_info_audiences` pour la même `version_id` (tel que la route le fait
    pour "modifier") s'exécute sans erreur.
  Cette preuve est bornée au périmètre de ce lot (pas la recette complète du
  LOT 7) : elle ne couvre ni RLS, ni un vrai jeton Supabase, ni les routes
  Node exécutées via un serveur HTTP réel.

## Fichiers créés

- `shared/flash-decision-input.ts` — validation pure de l'entrée d'une
  décision (`{ decision: "validee" | "refusee", content?: ... }`). Réutilise
  entièrement `parseFlashProposalInput` (LOT 2) pour le contenu édité d'un
  "modifier" plutôt que de redéfinir titre/texte/canaux/audience/expiration.
- `api/flash/validation/queue.ts` — `GET /api/flash/validation/queue`. Liste
  les versions `status = 'proposee'` de l'établissement, triée par
  `expiresAt` croissant (la plus proche de l'expiration en premier — choix de
  ce soir, pas confirmé par Adel, voir plus bas). Ouverte par
  `assertFlashValidationQueueAccess` (service, jamais le rôle). Pour chaque
  élément, l'autorisation de décider *cette* proposition précise
  (`FlashValidationAccessPayload`, LOT 1, jusqu'ici jamais consommée par
  aucune route) est recalculée par `decideFlashValidationAccess`, car voir la
  file n'implique pas de pouvoir décider chaque ligne (auto-validation
  éventuellement fermée au cas par cas).
- `api/flash/proposals/[id]/decision.ts` — `POST
  /api/flash/proposals/[id]/decision`. Verrou `SELECT ... FOR UPDATE` puis
  `UPDATE ... WHERE status = 'proposee'` (voir preuve ci-dessus). La légalité
  de la transition passe entièrement par
  `assertLegalFlashVersionTransition` (LOT 1) — aucune condition de statut
  écrite à la main, comme l'exige le plan. Une proposition expirée
  (`checkFlashProposalExpiration`, LOT 1) ne peut plus être décidée ici. Un
  contenu édité met à jour titre/texte/importance/canaux/expiration en place
  et remplace l'audience ; dans tous les cas une ligne `flash_info_events` est
  écrite avec `selfValidated`/`grantedByService` et, pour un "modifier",
  l'ancienne et la nouvelle valeur du contenu.
- `scripts/test-flash-decision-input.mjs` — 8 tests de
  `shared/flash-decision-input.ts`.

## Fichiers modifiés

- `shared/flash-validation-access.ts` — extraction de
  `grantedFlashValidationService(role, serviceCodes)` (le calcul du service
  accordé, déjà interne à `decideFlashValidationAccess`) en fonction exportée,
  réutilisée telle quelle par `assertFlashValidationQueueAccess`. Refactor
  pur : `decideFlashValidationAccess` appelle maintenant cette fonction au
  lieu de dupliquer le calcul ; les 8 tests existants de ce module restent
  verts sans modification.
- `api/_shared/flash-access.ts` — ajoute `assertFlashValidationQueueAccess`
  (ouvre la file par service) et `flashProposalRouteId` (identifiant `[id]`
  de route, même motif que `agentApprovalRouteId`, dupliqué plutôt qu'importé
  pour ne pas coupler flash à support, même choix que `flash-idempotency.ts`
  au LOT 2).
- `api/_shared/flash-response.ts` — ajoute `toFlashValidationAccessPayload`,
  qui fait passer une `FlashValidationDecision` par
  `isValidFlashValidationAccessPayload` (LOT 1) avant de répondre, même motif
  que `toFlashVersionPayload`.
- `package.json` — ajoute `test:flash-decision-input`, l'ajoute à la chaîne
  `test:flash-recette`.

## Décisions prises dans ce lot

- **"Modifier" n'est pas un troisième statut en base.** La base n'autorise
  depuis `proposee` que les transitions vers `validee`, `refusee` ou
  `expiree_sans_validation` (trigger `flash_guard_version`, vérifié en direct
  ce soir, voir preuve ci-dessus). "Modifier" est donc une validation
  (`validee`) accompagnée d'un contenu édité, écrit dans la MÊME ligne de
  version en une seule `UPDATE` (le trigger ne verrouille que
  `institution_id`/`flash_info_id`/`version`/`previous_version_id`/
  `proposed_by`/`created_at`, jamais titre/texte/importance/canaux/
  expiration). L'ancienne et la nouvelle valeur sont conservées dans
  `flash_info_events.summary` (`before`/`after`), pas dans une seconde ligne
  `flash_info_versions` : créer une vraie nouvelle ligne de version
  échouerait de toute façon, le trigger d'insertion (`flash_info_version_
  insert_guard`) exigeant qu'une ligne insérée démarre toujours à `proposee`,
  jamais à `validee`. Ce point n'était pas explicite dans le plan ; c'est la
  seule lecture compatible avec les contraintes déjà en base.
- **Un refus enregistre aussi `validated_by`/`validated_at`.** La contrainte
  CHECK existante (migration LOT 1) l'exige pour tout statut différent de
  `proposee`/`expiree_sans_validation`, refus compris : ces deux colonnes
  portent en réalité "qui a décidé, et quand", pas seulement "qui a validé".
  Aucune redéfinition de règle, juste son application côté route.
- **La file est ordonnée par expiration croissante.** Choix de ce soir : une
  file de validation existe pour agir avant l'expiration (§13, T071D), le tri
  le plus utile est donc la plus proche échéance en premier. Non confirmé par
  Adel, à réviser si l'écran (LOT 6) attend un autre ordre (ex. plus ancienne
  proposition en premier).
- **Verrou transactionnel par `SELECT ... FOR UPDATE` + `UPDATE ... WHERE
  status = 'proposee'`, pas par une fonction SQL dédiée.** Le motif le plus
  proche dans le code existant (`api/support/agent/approvals/[id]/decision.ts`)
  utilise une fonction Postgres (`agent_decide_approval`) parce que sa logique
  métier est plus riche (expiration en base, permissions multi-service). Ici,
  la légalité de transition est déjà entièrement portée par un module pur
  déjà testé (`flash-transitions.ts`) : ajouter une fonction SQL aurait
  dupliqué cette logique en PL/pgSQL sans bénéfice, contrairement à la règle
  commune n°5. La preuve SQL directe ci-dessus (`UPDATE 0` au rejeu) montre
  que la garde fonctionne sans fonction dédiée.

## Ce qui reste supposé, pas prouvé

- **La publication (`validee` -> `publiee`) n'est couverte par aucune tâche
  explicite de ce plan.** LOT 3 s'arrête intentionnellement à `validee`/
  `refusee` (titre du lot : "Valider, refuser, modifier" — pas "publier").
  Or LOT 4 ("Corriger après publication") suppose une information déjà
  publiée, et la seule transition légale vers `publiee` part de `validee`.
  Personne, dans aucun des 9 lots du plan, n'écrit explicitement cette
  transition ni `flash_infos.status = 'published'`. **C'est un trou à
  trancher avec Adel avant d'attaquer le LOT 4** : la publication est-elle
  automatique dès la validation (dans ce cas ce lot devrait être complété),
  ou un geste humain distinct restant à spécifier ? Ce lot ne tranche pas la
  question unilatéralement et ne l'implémente donc pas.
- Aucun test de bout en bout via une vraie requête HTTP (serveur Vercel dev ou
  équivalent) : la preuve SQL ci-dessus est au niveau base directe, pas au
  niveau des routes Node. `requireFlashActor`/`requireUser` restent non
  testés avec un vrai jeton Supabase, même réserve qu'aux LOT 1 et LOT 2.
  Un identifiant `groupRefs` erroné venant du valideur (canal non éligible à
  l'audience réelle, LOT 4) n'est pas non plus dans ce périmètre.
- L'ordre de tri de la file (expiration croissante) est une supposition, pas
  une confirmation d'Adel (voir ci-dessus).
- Concurrence multi-établissement, RLS et cas des deux enfants d'un même
  contact restent hors preuve de ce lot : réservés au LOT 7, comme au LOT 2.
- `test:preview-security-gate` ne connaît toujours pas le domaine flash
  (choix du LOT 1, non révisé ici).

## Commit

Un commit local sur `codex/lycee-connect-prototype`, aucun push.
