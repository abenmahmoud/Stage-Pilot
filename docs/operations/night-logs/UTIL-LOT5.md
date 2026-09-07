# LOT 5 — Clôture honnête

Plan : `docs/operations/PLAN_IMPORT_UTILISABLE_2026-09-07.md`. Périmètre
exécuté strictement : LOT 5 seulement (aucun code touché). Branche
`codex/lycee-connect-prototype`, aucun `git push`. Ce lot ne fait que
constater et rapporter l'état laissé par LOT 1 à LOT 4 (déjà commités :
`f463013`, `85313ac`, `587aab8`, `17f0508`), relire leurs journaux
(`UTIL-LOT1.md` à `UTIL-LOT4.md`) et rejouer les quatre contrôles demandés
par le plan avant de conclure.

## Ce qui est réellement prouvé (PostgreSQL local réel, pas une hypothèse)

- **Le dépôt et la correspondance de colonnes d'un fichier tabulaire**
  (CSV ou Excel) produisent réellement une page par classe/professeur
  trouvé dans le fichier, avec le bon `page_count` — `recipe:local-schedule-
  tabular-mapping-adversarial` (LOT 3), 11 assertions.
- **L'écriture des créneaux** passe par un seul point d'écriture
  (`api/_shared/schedule-slot-write.ts`), identique pour un PDF saisi à la
  main et pour un fichier tabulaire — vérifié en base réelle dans les deux
  cas (LOT 2, LOT 3, LOT 4).
- **Le refus réel d'approbation** d'un import portant au moins une page
  vérifiée sans créneau écrit, avec relecture du statut en base (`review`,
  jamais `approved`) — `recipe:local-schedule-approval-gate-adversarial`
  (LOT 2), 8 assertions ; rejoué avec succès pour une source tabulaire au
  LOT 4.
- **L'activation avec retrait propre de l'ancienne version**, et
  l'invariant « jamais deux versions actives » tenu au niveau du schéma
  PostgreSQL lui-même (contrainte unique partielle, code `23505`), pas
  seulement au niveau applicatif — `recipe:local-schedule-import-e2e`
  (LOT 4), 24 assertions.
- **La lecture par l'agent sur la version activée** distingue réellement
  trois cas en base réelle : une classe couverte par l'import reçoit son
  cours du jour ; une classe jamais importée ne reçoit rien
  (`courses: []`) sans erreur ; une classe dont la version a été retirée
  (`superseded`) ne reçoit plus rien non plus, alors que ses créneaux
  existent toujours physiquement en base — même recette LOT 4.
- **Deux bogues bloquants réels ont été trouvés et corrigés par ces
  recettes, pas par relecture** : l'ordre de création des pages avant le
  passage en `review` (LOT 3, contrainte `enforce_schedule_page_review_
  bounds`), et l'impossibilité totale d'approuver un import tabulaire
  faute d'image de page PDF (LOT 4, `schedule_validate_source_promotion`,
  corrigé par la migration `20260907130000_allow_tabular_schedule_
  approval.sql` en ne touchant qu'à la branche `tabular_import`). Le
  pipeline PDF a été rejoué après chaque correctif et reste vert.
- **Le rétro-effet sur le pipeline PDF est nul** : `api/_shared/schedule-
  slot-write.ts`, `approve.ts`, `activate.ts` n'ont subi aucune
  modification depuis le LOT 1 de `PLAN_DONNEES_REELLES_2026-09-06.md` ;
  seule une clause conditionnelle sur `source_format` a été ajoutée dans
  la fonction de validation de transition.

## Ce qui est simulé ou vérifié seulement par lecture de code / contrôles statiques

- **Aucun clic navigateur réel n'a jamais eu lieu**, sur aucun des quatre
  lots. Le sélecteur de format, le panneau de correspondance de colonnes
  (`ScheduleTabularMappingPanel`), l'éditeur de créneaux
  (`ScheduleSlotEditor`), le bandeau d'erreur d'approbation et le bouton
  d'activation n'ont été vérifiés que par `tsc --noEmit`, `vite build` et
  lecture directe du code — jamais par une session de navigateur contre
  une base locale. C'est la preuve la plus significative qui manque
  encore : tout ce qui précède prouve que la **base de données et les
  fonctions serveur** se comportent correctement, pas que l'écran les
  déclenche correctement dans les faits.
- **Aucune route HTTP authentifiée complète n'a été rejouée.** Toutes les
  recettes appellent directement la logique de transaction extraite des
  fichiers `api/schedule/admin/imports/...`, jamais le handler Vercel
  complet avec `requireScheduleManager` (JWT, appartenance à
  l'établissement, MFA). Un problème d'autorisation ou de session
  pourrait donc exister sans qu'aucune recette de ce plan ne l'attrape.
- **Le worker de file d'attente réelle (`pgmq`) n'a jamais tourné sur un
  fichier tabulaire.** La branche tabulaire de
  `schedule-document-worker.mjs` (antivirus réel inclus) n'a été vérifiée
  que par lecture de code et par les tests unitaires du parseur seul
  (`test-schedule-tabular-parser.mjs`), contrairement à la branche PDF qui
  a sa propre recette dédiée à l'antivirus réel.
- **La diversité réelle des fichiers Excel n'est pas couverte** : toutes
  les fixtures de test sont produites par la bibliothèque `xlsx`
  elle-même, jamais par un vrai tableur (feuilles multiples, formules,
  encodages exotiques d'un export EDT réel).
- **La résolution identité → périmètre autorisé n'est pas rejouée dans la
  chaîne complète du LOT 4** ; elle est prouvée séparément
  (`schedule-identity-sql-recipe.mjs`,
  `test-local-schedule-identity-adversarial.mjs`), la recette LOT 4 part
  d'un périmètre déjà résolu.

## Ce qui reste fermé — une limite assumée, pas un oubli

- **Aucune expansion de récurrence hebdomadaire.** Une ligne du fichier
  déposé (tabulaire ou saisie manuelle) doit être une occurrence datée
  explicite (`AAAA-MM-JJ`). Un export EDT « classique » (un jour de
  semaine + une heure, répété sur toute l'année) ne s'importera pas tel
  quel tant que `shared/schedule-slot-input.ts` n'aura pas été retravaillé
  pour porter une notion de récurrence. Ce n'était pas dans le périmètre
  de ce plan.
- **Aucun format XML automatisé.** L'intro du plan mentionne l'activation
  à venir de l'export automatisé chez Index Éducation : ce plan n'a
  construit ni format XML, ni webhook, ni tâche planifiée. Il n'existe
  aujourd'hui que deux chemins : dépôt manuel d'un PDF (saisie créneau par
  créneau) et dépôt manuel d'un fichier tabulaire (CSV/Excel, avec
  correspondance de colonnes). L'écriture passant par un point unique
  (`schedule-slot-write.ts`), un format XML pourra s'y brancher plus tard
  sans reprendre l'existant — mais rien de cette route n'existe encore.
- **Le parcours de retrait humain explicite (`retire.ts`, avec motif et
  gouvernance de rétention) n'a jamais été rejoué** dans ce plan. Seul le
  retrait automatique lors d'une nouvelle activation a été prouvé (LOT 4).
- **Aucun drapeau n'a été créé ni activé pour cette fonctionnalité** : il
  n'existe pas de `SCHEDULE_IMPORT_*_ENABLED` à ouvrir. L'accès est
  entièrement gouverné par les rôles existants
  (`requireScheduleManager`) et par la vérification humaine page par
  page — recherche faite sur le dépôt, aucun drapeau de ce nom trouvé.

## Ce qu'Adel pourra faire lui-même, dans l'ordre, le jour où il aura un fichier

Cette séquence correspond à ce que l'écran est censé permettre d'après le
code et les recettes base de données — **pas à un parcours vérifié par un
clic réel** (voir section précédente) :

1. Sur `ScheduleImportPage.tsx`, choisir le format du fichier (PDF officiel
   ou export tabulaire CSV/Excel) et le déposer.
2. Si tabulaire : dans `ScheduleTabularMappingPanel`, faire correspondre
   chaque colonne réelle du fichier (classe/professeur, matière, salle,
   jour, heure de début, heure de fin) — rien n'est deviné, tout est un
   menu déroulant sur les en-têtes réels. Cette correspondance sera
   réutilisée pour le prochain import du même périmètre.
3. Vérifier chaque page proposée (une page = une classe ou un professeur).
4. Pour chaque page vérifiée, cliquer sur le bouton d'écriture des
   créneaux (« Écrire les X créneaux du fichier » pour le tabulaire,
   éditeur manuel ligne par ligne pour un PDF) et constater le rapport réel
   affiché (nombre de créneaux, horaires, matière, salle).
5. Cliquer « Approuver » : le bouton refusera tant qu'une page vérifiée n'a
   aucun créneau écrit, avec un message nommant la page en cause.
6. Activer la version approuvée : l'ancienne version active pour le même
   périmètre (établissement/année) est automatiquement retirée
   (`superseded`), jamais laissée active en parallèle.
7. À partir de ce moment, l'agent répond « mes cours aujourd'hui »
   correctement pour toute identité vérifiée d'une classe couverte par
   cette version, et ne répond rien pour une classe non couverte ou dont
   la version a été retirée.

**Avant de faire confiance à cette séquence en conditions réelles**, il
reste nécessaire de la rejouer une fois dans un vrai navigateur contre une
base locale (voir « Ce qui est simulé » ci-dessus) — ce plan ne l'a pas
fait, faute de périmètre prévu pour ça.

## Ce qui restera fermé après ce lot

- L'import automatisé XML (Index Éducation) : à construire entièrement,
  probablement comme une troisième source alimentant le même point
  d'écriture.
- La récurrence hebdomadaire dans un fichier déposé.
- Le retrait manuel explicite (`retire.ts`) avec motif, non exercé.
- La route HTTP authentifiée complète (JWT/MFA/appartenance) et la
  recette navigateur réelle : à faire avant toute mise à disposition à un
  vrai administrateur non technicien, pas seulement souhaitable.

## Preuves obtenues pour cette clôture

- `node node_modules/typescript/bin/tsc --noEmit` : aucune erreur.
- `npx vite build` : succès (même avertissement préexistant, sans rapport,
  sur la taille du chunk `xlsx`).
- `npm run test:preview-security-gate` : code de sortie 0, 896 occurrences
  de `✔`, 0 `✖` sur l'ensemble de la chaîne, terminée sur
  `test:migration-integrity` (111 migrations, versions uniques) — aucune
  régression détectée depuis le LOT 4.
- `npm run test:spec-integrity` : OK (5 specs, 635 tâches, inchangé —
  aucune tâche Spec Kit n'était associée à ce plan, qui n'appartient à
  aucune spec numérotée).

## Statut

LOT 5 terminé au sens du plan : ce document distingue explicitement ce qui
est prouvé en base PostgreSQL réelle (dépôt tabulaire, correspondance de
colonnes, écriture, refus d'approbation, approbation, activation avec
retrait propre, lecture différenciée par l'agent) de ce qui reste simulé
(tout clic navigateur, toute route HTTP authentifiée complète, le worker
de file réelle pour un fichier tabulaire) et de ce qui reste fermé par
choix assumé (récurrence hebdomadaire, format XML, retrait manuel
explicite). Les quatre contrôles demandés par le plan avant clôture ont
été rejoués dans cette session et sont verts. Aucun drapeau n'a été
activé, aucune donnée réelle utilisée, aucun `git push` effectué.
