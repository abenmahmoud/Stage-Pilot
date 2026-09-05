# LOT 5 — Clôture (compte rendu global)

Plan : `docs/operations/PLAN_FLASH_PUBLICATION_2026-09-05.md`, section LOT 5.
Session Claude Code du 5 septembre 2026, branche `codex/lycee-connect-prototype`.
Aucun `git push`. Un seul commit local pour ce lot. Ce lot ne modifie aucune
ligne de code produit : uniquement `specs/002-agent-etablissement-adaptatif/tasks.md`
(cases à cocher et notes de clôture) et ce fichier.

## Sources lues avant de trancher

- `docs/operations/PLAN_FLASH_PUBLICATION_2026-09-05.md` en entier.
- `docs/operations/night-logs/PUB-LOT1.md`, `PUB-LOT2.md`, `PUB-LOT3.md`,
  `PUB-LOT4.md` en entier — les quatre comptes rendus de ce plan.
- `docs/operations/night-logs/LOT6.md` (clôture de l'ancien plan
  `NIGHT_PLAN_FLASH_2026-09-05.md`, avant la persistance) : sert de point de
  comparaison pour mesurer ce qui a réellement changé depuis, notamment sur
  T071E (rôle vs service).
- `docs/operations/night-logs/PERSIST-LOT7.md` (extrait, scénario 7 : flash
  urgente notifiée puis ramenée à normale, sur base réelle).
- `specs/002-agent-etablissement-adaptatif/tasks.md`, lignes 1179-1269
  (T071, T071A, T071B, T071C, T071D, T071E, T071F).
- Lecture directe du code, pas seulement des comptes rendus, pour chaque
  vérification listée ci-dessous (voir "Preuves exécutées pendant ce lot").
- **Pas de lecture de `specs/project-memory.md`** : rien dans ce lot ne
  l'exigeait, tout le contexte nécessaire était dans les cinq comptes rendus
  déjà cités.

## Preuves exécutées pendant ce lot (clôture, pas de nouveau code)

- `git status --porcelain` avant toute modification : arbre propre à part
  `.nuit.lock` (non suivi, préexistant, non lu, hors périmètre — même
  discipline que LOT6.md).
- `node node_modules/typescript/bin/tsc --noEmit` : aucune erreur.
- `npm run build` (`vite build`) : succès, 7.25 s.
- `npm run test:preview-security-gate` : suite complète, `EXIT:0`, `0`
  occurrence de `✖`, `0` occurrence de `not ok` dans le journal capturé.
- `npm run test:migration-integrity` (inclus dans la porte ci-dessus) : 100
  migrations, 100 versions uniques, 77 références vérifiées — identique au
  LOT 4, aucune migration ajoutée par ce lot.
- `npm run test:flash-recette` : suite complète, `EXIT:0`, aucun échec.
- `npm run test:spec-integrity`, rejoué deux fois : avant modification des
  cases (`222` complétées / `77` ouvertes pour le domaine 002) et après
  (`227` complétées / `72` ouvertes) — écart de exactement `5`, le nombre de
  cases cochées par ce lot, aucune tâche perdue ni dupliquée.
- Lecture directe de `src/App.tsx` (lignes 255-270) : la route
  `admin/informations-flash/valider` est gardée par
  `RoleRoute allowedRoles={CONTENT_MANAGER_ROLES}`, pas par un contrôle de
  service — confirme que le point resté ouvert de T071E est toujours vrai
  aujourd'hui, pas une note obsolète recopiée sans vérification.
- Recherche (`grep`) de `assertFlashValidationAccess` dans `api/` : présent
  dans `decision.ts`, `correction.ts`, `publication.ts`, `validation/queue.ts`,
  `validation/publishable.ts` — confirme que la partie serveur de T071E, que
  la tâche disait non faite, l'est bien devenue (commit
  `3d9abb3`, LOT 1 du plan de persistance, antérieur à ce plan).
- Lecture directe de `src/pages/admin/FlashValidationPage.tsx` (lignes
  68-145, 479-598) : `access.allowed`, `access.reason`, `access.selfValidated`
  sont bien lus et affichés par ligne de la file — confirme que la remontée
  de la décision par service jusqu'à l'écran existe, même si la porte de
  navigation reste par rôle.
- Lecture directe de `api/flash/proposals/[id]/correction.ts` (lignes 143-164) :
  `previousNotifiedChannels` vient d'un `SELECT DISTINCT` réel sur
  `flash_notification_dispatches` filtré sur `status = 'sent'`, jamais d'une
  supposition depuis l'importance déclarée — confirme la partie de T071B sur
  les canaux réellement notifiés.
- Lecture directe de `db/schema.ts` (table `flash_correction_decisions`,
  lignes 2356-2388) : `gapKind`, `maintainedCount`, `removedCount`,
  `addedCount`, `eligibleChannels`, `decision`, `decidedBy`, `decidedAt` sont
  bien liés à `versionId` (unique) — confirme la partie de T071A sur la
  conservation de l'écart, de la proposition et de la décision avec la
  version.
- Lecture directe de `scripts/test-flash-proposal-page.mjs` (lignes 44-45) :
  verrouille `n'a prévenu personne` et `Ouvrir la messagerie du lycée` dans
  l'écran de proposition — confirme T071C.
- Lecture directe de `scripts/test-flash-audience-correction.mjs` (lignes
  20-128) : le cas des retirés est bien testé en priorité, avec un test
  dédié distinct des cas élargis/remplacés — confirme la partie prioritaire
  de T071B.

## Décision sur les six tâches, honnêtement

Cases modifiées dans `specs/002-agent-etablissement-adaptatif/tasks.md`
(chaque case porte désormais une note « Clôturée le 5 septembre 2026 » ou
« État au 5 septembre 2026 » expliquant précisément le raisonnement, pas
seulement ce résumé) :

- **T071F — cochée.** C'est la tâche que ce plan entier existait pour
  fermer : la transition `validee -> publiee` a une route, un service
  d'accès, une idempotence, un verrou, un refus d'échéance dépassée, et une
  expiration séparée pour une version validée jamais publiée. Recette
  PostgreSQL réelle **et** recette navigateur réelle (LOT 4), sept scénarios,
  aucune transition forcée en SQL — contrairement à tout ce qui précédait ce
  plan.
- **T071 — cochée.** Conception versionnée déjà en place, et le point qui
  manquait au LOT6.md de l'ancienne nuit (« validées par le référent
  numérique/DDFPT » sans rôle correspondant) est résolu depuis le plan de
  persistance : la validation, la correction et la publication sont toutes
  les trois ouvertes par le service, jamais par le rôle applicatif, appliqué
  côté serveur sur les trois routes qui mutent réellement une version.
- **T071A — cochée.** La règle de décision (décisif/forme), l'absence
  d'envoi automatique, l'exigence de confirmation humaine par service, et la
  conservation de l'écart/la proposition/la décision **avec la version**
  (table dédiée, liée par `versionId` unique) sont toutes prouvées, y compris
  par une recette réelle bout en bout au LOT 4 de ce plan.
- **T071B — cochée.** Les trois ensembles sont calculés, testés de façon
  adverse en priorisant les retirés (exigence explicite de la tâche), et
  affichés à l'écran après confirmation. Les canaux réellement notifiés
  viennent d'une lecture réelle de la table de trace, pas d'une supposition.
  Limite assumée et documentée dans la case elle-même : aucun aperçu avant
  clic, et le cas non trivial (canaux déjà notifiés) reste non observable en
  usage réel tant qu'aucune route n'écrit jamais dans
  `flash_notification_dispatches` — cette limite ne remet pas en cause la
  règle elle-même, testée de façon adverse par ailleurs.
- **T071C — cochée.** Le bandeau et le lien de messagerie sont testés en
  dur, la publication est structurellement impossible sans passage par
  `validee`, et cette validation est elle-même conditionnée au service.
  Réserve écrite dans la case : le lien pointe vers le Webmail du lycée,
  pas un lien ENT distinct connu du dépôt — à confirmer par Adel si besoin,
  ce n'est pas une preuve technique manquante mais une question de choix de
  canal.
- **T071E — non cochée, et ce lot ne la coche pas.** C'est la seule des six
  qui reste honnêtement incomplète : la tâche demande explicitement deux
  choses, « l'appliquer côté serveur » (fait, vérifié par lecture de code
  pendant ce lot) et « faire remonter `serviceCodes` jusqu'à l'écran, qui
  est encore protégé par les rôles de publication » (partiellement fait —
  la décision par service est bien affichée ligne par ligne, mais la porte
  de navigation vers l'écran lui-même reste `RoleRoute` par rôle, vérifié
  par lecture directe de `src/App.tsx` pendant ce lot, pas supposé depuis un
  ancien compte rendu). Un compte `administration` ou `proviseur` sans le
  service voit toujours l'écran s'ouvrir ; il ne peut plus rien y valider ou
  publier (bloqué à `403` côté serveur, boutons non actionnables faute
  d'autorisation), mais la tâche décrit une fermeture de la porte
  elle-même, qui n'a pas eu lieu.

## Ce qui reste supposé, pas prouvé, après ce plan entier

- **Aucune recette n'a jamais tourné sur un environnement Vercel Preview ou
  un PostgreSQL distant.** Toutes les preuves des LOT 1 à 4 sont locales et
  jetables (`CLAUDE.md` : une preuve locale n'est pas une recette distante).
- **Les drapeaux `FLASH_INFO_UI_ENABLED` et `FLASH_VALIDATION_UI_ENABLED`
  restent fermés** (vérifié par grep sur `src/lib/feature-flags.ts` pendant
  ce lot, inchangé depuis LOT6.md) : la recette navigateur du LOT 4 a servi
  l'écran directement par un petit serveur HTTP local, pas en passant par
  la navigation réelle de l'application avec ces drapeaux ouverts. Rien
  dans ce plan n'ouvre ces drapeaux, conformément à la règle commune n°3.
- **T071E reste ouverte** (voir ci-dessus) : la porte de navigation vers
  l'écran de validation doit encore passer d'un contrôle par rôle à un
  contrôle par service pour que la tâche soit honnêtement cochée.
- **Aucun scénario de correction réelle n'a changé l'audience** (retiré un
  groupe) sur la pile PostgreSQL jetable de ce plan précis (LOT 4) : le seul
  scénario de correction recetté en base réelle dans ce plan change un
  titre. Le calcul des trois ensembles reste prouvé par tests unitaires
  adverses (module pur) et par une recette réelle antérieure sur le module
  de correction (`PERSIST-LOT7`, scénario 7, avant que la publication n'ait
  de route), pas par une recette réelle de bout en bout incluant un
  changement de public dans ce plan-ci.
- **Aucun envoi réel n'a jamais été tenté, à aucun lot** : conforme à la
  règle commune n°3 ; conséquence directe, `flash_notification_dispatches`
  reste vide en usage réel, donc le cas « canaux déjà notifiés » d'une
  correction n'a jamais été observé autrement qu'en fixture de test.
- **La séparation stricte proposant/valideur n'est pas imposée** : un compte
  qui porte à la fois `FLASH_PROPOSAL_ROLES` et le service
  `referent_numerique`/`ddfpt` peut proposer puis valider sa propre
  proposition. Auto-validation explicitement autorisée par décision d'Adel
  (commit `f2b2a3d`), journalisée (`selfValidated`), pas un défaut caché.

## Fichiers touchés

- Modifié : `specs/002-agent-etablissement-adaptatif/tasks.md` (six cases
  T071/T071A/T071B/T071C/T071E/T071F, cinq cochées, une note de clôture ou
  d'état ajoutée à chacune des six).
- Nouveau : `docs/operations/night-logs/PUB-LOT5.md` (ce fichier).
