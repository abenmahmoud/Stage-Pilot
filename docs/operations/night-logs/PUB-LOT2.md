# LOT 2 — Expiration d'une information validée jamais publiée (clôture)

Plan : `docs/operations/PLAN_FLASH_PUBLICATION_2026-09-05.md`, section LOT 2.
Session Claude Code du 5 septembre 2026, branche `codex/lycee-connect-prototype`.
Aucun `git push`. Un seul commit local pour ce lot.

## Ce qui est prouvé par une commande exécutée

- **Détection étendue, en module distinct, jamais fusionnée avec T071D** :
  `shared/flash-expiration.ts` gagne `checkFlashValidatedProposalExpiration`,
  `selectExpiredValidatedFlashProposals` et
  `buildFlashValidatedExpirationAuthorNotice`. `checkFlashProposalExpiration`
  (le module T071D existant) n'est **pas modifié** : le test verrouillé
  `scripts/test-flash-expiration.mjs` ("une version deja validee, publiee ou
  refusee n'est plus concernee") continue d'exiger `not_applicable` pour le
  statut `validee` sur cette fonction précise, et passe toujours tel quel.
  Les deux détections restent deux fonctions séparées, comme demandé par le
  plan ("les deux causes n'appellent pas la même correction d'organisation").
- **Même avis factuel, sans fausse affirmation** : le message de
  `buildFlashValidatedExpirationAuthorNotice` ne dit jamais "sans avoir été
  validée" (ce serait faux, contrairement au cas T071D) ; il dit "sans avoir
  été publiée : personne n'a été informé." Ne nomme aucun valideur, n'ajoute
  aucun motif — testé explicitement (`assert.doesNotMatch(.../sans avoir été
  validée/)`, `assert.doesNotMatch(.../referent|référent|valideur|ddfpt/i)`).
- **Nouvel état terminal, pas une réinterprétation d'un état existant** :
  `expiree_sans_publication`, ajouté à `FLASH_VERSION_STATUSES` et à
  `LEGAL_TRANSITIONS` (`shared/flash-transitions.ts`) : `validee -> publiee`
  reste légale, `validee -> expiree_sans_publication` devient légale, l'état
  est terminal (aucune transition sortante). Sans cet état, une version
  `validee` qui expire resterait `validee` pour toujours (aucune transition
  légale vers un autre état n'existait) : elle serait redétectée à l'identique
  à chaque exécution du cron et produirait un avis dupliqué à chaque passage.
  Testé : `scripts/test-flash-transitions.mjs`.
- **Cron étendu, dans la même transaction, comptage séparé** :
  `api/cron/flash-expiry.ts` traite maintenant deux catégories dans la même
  transaction (`SELECT ... FOR UPDATE` sur `status = 'proposee'` puis sur
  `status = 'validee'`), avec deux `eventType` distincts
  (`version.expired_without_validation` /
  `version.expired_after_validation_without_publication`) et deux compteurs
  distincts dans la réponse (`expiredCount` / `expiredAfterValidationCount`),
  jamais un seul total fusionné. La route continue de n'utiliser que des
  fonctions pures importées (`selectExpiredFlashProposals`,
  `selectExpiredValidatedFlashProposals`, `buildFlashExpirationAuthorNotice`,
  `buildFlashValidatedExpirationAuthorNotice`,
  `assertLegalFlashVersionTransition`) — aucune condition d'expiration
  réécrite sur place. Aucune suppression, aucun envoi (mêmes garanties que la
  route existante, revérifiées par les tests de wiring).
- **Compte consultable séparé** : nouvelle route
  `GET /api/flash/validation/expired-after-validation.ts`, jumelle exacte de
  `api/flash/validation/expired.ts` (même accès
  `assertFlashValidationQueueAccess`, même limite de liste, même contrat de
  réponse via `toFlashVersionPayload`), mais filtrée sur
  `status = 'expiree_sans_publication'` au lieu de
  `'expiree_sans_validation'`. Un test dédié
  (`scripts/test-flash-expired-after-validation-queue.mjs`) vérifie
  explicitement qu'aucune des deux routes ne filtre sur le statut de l'autre.
  Cette route n'est pas encore branchée à un écran — hors périmètre du LOT 2
  (voir "Ce qui reste supposé").
- **Migration écrite** :
  `supabase/migrations/20260905140000_add_flash_expired_after_validation_status.sql`.
  Étend le check de colonne `status` (nom auto-généré déterministe
  `flash_info_versions_status_check`, même convention vérifiée sur ce dépôt
  par `identity_directory_imports_status_check`,
  `knowledge_documents_status_check`,
  `support_attachments_scan_status_check`,
  `site_content_assets_status_check` et
  `communication_deliveries_status_check`), ajoute l'index partiel
  `flash_info_versions_validee_expiration_pending_idx` (même forme que
  `flash_info_versions_expiration_pending_idx`), et met à jour
  `flash_guard_version()` pour autoriser `validee -> expiree_sans_publication`
  en plus de `validee -> publiee`. Les six checks de table qui énumèrent des
  statuts (`validated_at` requis, `validated_by`/`validated_at` interdits,
  etc.) ne sont **pas** touchés : relecture logique du texte SQL — chacun
  reste vrai par vacuité pour le nouveau statut (aucun n'interdit quoi que ce
  soit qu'il faudrait interdire). Cette lecture est une preuve par relecture,
  pas par exécution (voir "Ce qui reste supposé").
- `db/schema.ts` porte le nouvel index Drizzle
  (`flash_info_versions_validee_expiration_pending_idx`), en miroir de la
  migration.
- `node node_modules/typescript/bin/tsc --noEmit` : aucune erreur.
- `npm run build` : succès (`vite build`, ~8.9 s).
- `npm run test:flash` (transitions, version-diff, audience-correction,
  expiration) : 7 + 7 + 12 + 15 = 41 tests, tous verts. Les 9 tests ajoutés
  pour la nouvelle catégorie (transitions + expiration) passent, aucun test
  existant modifié n'a changé de comportement.
- `npm run test:flash-recette` : suite complète (tous les modules purs flash,
  les deux pages, la recette adverse, l'accès, le contrat de payload, les
  entrées, la correction, le cron, les deux files consultables) : tous verts,
  y compris les 6 nouveaux tests de wiring pour
  `expired-after-validation.ts`.
- `npm run test:preview-security-gate` : suite complète, `EXIT:0`, aucun `✖`.
- `npm run test:migration-integrity` : 100 migrations, 100 versions uniques,
  77 références vérifiées — la nouvelle migration passe (comptée dans les
  100 : LOT 1 en avait laissé 99).
- `npm run test:spec-integrity` : 5 specs, 634 tâches, aucune anomalie.

## Ce qui reste supposé, pas prouvé

- **Aucune recette PostgreSQL réelle n'a été rejouée dans ce lot.** Docker
  Desktop indisponible dans ce shell (`docker info` échoue : "cannot connect
  to the docker API") — même piège déjà documenté dans `CLAUDE.md` et
  constaté au LOT 1, pas contourné. La migration
  `20260905140000_add_flash_expired_after_validation_status.sql` n'a donc
  **jamais tourné** contre une base réelle : ni le remplacement du check de
  colonne, ni le nouvel index partiel, ni la nouvelle branche du trigger
  `flash_guard_version` n'ont été vérifiés autrement que par lecture. Le nom
  auto-généré `flash_info_versions_status_check` n'a pas été confirmé par
  `\d flash_info_versions` sur une base réelle — seule la convention
  identique observée sur cinq autres migrations de ce dépôt le rend probable.
  À rejouer en base réelle au LOT 4.
- **Le cron n'a jamais été exécuté contre une base réelle.** Les deux
  branches (proposée expirée / validée expirée) sont rejouées, avec les
  vraies fonctions importées, dans
  `scripts/test-flash-expiry-cron.mjs` — ce n'est pas une preuve HTTP bout en
  bout. En particulier, l'hypothèse "le nouvel état terminal empêche la
  redétection au passage suivant du cron" n'a jamais été vérifiée par deux
  exécutions successives sur une base réelle, seulement raisonnée depuis le
  graphe de transitions.
- **La route `expired-after-validation.ts` n'est branchée à aucun écran.**
  C'est le LOT 3 du plan, non traité ici — l'écran de validation n'affiche
  toujours que le compteur T071D existant.
- **`api/flash/proposals/[id]/publication.ts` (LOT 1) n'a pas été touché.**
  Il continue de comparer `current.expiresAt.getTime() <= now.getTime()` en
  ligne plutôt que de passer par un module pur d'expiration pour le statut
  `validee` — ce module existe maintenant
  (`checkFlashValidatedProposalExpiration`), mais son usage dans cette route
  précise n'est pas dans le périmètre du LOT 2 ("exécute UNIQUEMENT le LOT
  2") et n'a donc pas été fait. Signalé pour une session future, pas corrigé
  ici.
- **Les six checks de table non modifiés dans la migration** (voir
  ci-dessus) sont couverts par un raisonnement logique écrit en commentaire
  SQL, pas par une exécution contre PostgreSQL. Si ce raisonnement s'avère
  faux à l'usage réel, la seule conséquence attendue est une contrainte trop
  permissive (elle ne bloquerait rien qui devrait l'être), jamais une
  contrainte qui bloquerait à tort une transition légale — mais ça reste une
  hypothèse, pas une preuve.

## Fichiers touchés

- Nouveau :
  `supabase/migrations/20260905140000_add_flash_expired_after_validation_status.sql`
- Nouveau : `api/flash/validation/expired-after-validation.ts`
- Nouveau : `scripts/test-flash-expired-after-validation-queue.mjs`
- Modifiés : `shared/flash-transitions.ts`, `shared/flash-expiration.ts`,
  `api/cron/flash-expiry.ts`, `db/schema.ts`, `package.json`,
  `scripts/test-flash-transitions.mjs`, `scripts/test-flash-expiration.mjs`,
  `scripts/test-flash-expiry-cron.mjs`
