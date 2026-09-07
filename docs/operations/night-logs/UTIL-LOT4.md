# LOT 4 — Recette réelle de bout en bout

Plan : `docs/operations/PLAN_IMPORT_UTILISABLE_2026-09-07.md`. Périmètre
exécuté strictement : LOT 4 seulement. Branche `codex/lycee-connect-prototype`,
aucun `git push`, aucune donnée réelle, aucun drapeau activé. Une migration a
été ajoutée et jouée (nécessaire, voir plus bas), uniquement sur la pile
Supabase locale jetable (`127.0.0.1:54322`), jamais `--linked`, jamais
`db push`, jamais d'URL distante.

## Ce qui devait être prouvé (rappel du plan)

« PostgreSQL local jetable, fichier tabulaire inventé. À prouver : le dépôt,
la correspondance des colonnes, l'écriture des créneaux, le refus
d'approbation d'un import vide, l'activation, et le retrait propre de la
version précédente (jamais deux versions actives). Puis, sur cette version
activée : l'agent répond « mes cours aujourd'hui » pour une identité vérifiée
de la bonne classe, et ne répond rien pour une autre classe. »

## Ce qui a été construit

### La recette elle-même

`scripts/test-local-schedule-import-e2e.mjs` (nouveau, npm run
`recipe:local-schedule-import-e2e`), contre `127.0.0.1:54322` uniquement,
établissement/personnel/fichier entièrement fictifs. Différence assumée avec
les recettes des LOT 2 et LOT 3 : celles-ci tenaient tout dans **une seule
transaction annulée** (`rollback`) à la fin. Ce lot va, pour de vrai, jusqu'à
l'activation — la lecture finale par l'agent
(`readCoursesForDayFromPrivateSchedule`) passe par la connexion applicative
normale (`db/index.ts`), une connexion PostgreSQL distincte de celle qui
écrit les données de la recette : une transaction non validée y serait
invisible. Le nettoyage final est donc fait par des suppressions explicites
en fin de script, vérifiées à zéro trace, pas par un `rollback`.

Séquence rejouée, dans l'ordre du LOT 4 :

1. **Version précédente déjà active** (PDF fictif, classe
   `6Z-FICTIF-LOT4-ANCIEN`) construite par le même chemin que n'importe quelle
   version (`processing` → écriture des créneaux → `approved` → `active`),
   pas injectée directement à `active` — pour que les contraintes réelles
   (`approved_by`/`activated_by` non nuls, image de page privée requise pour
   un PDF) soient satisfaites honnêtement, pas contournées.
2. **Dépôt tabulaire + correspondance de colonnes** : rejoue exactement la
   transaction de `tabular-mapping.ts` déjà prouvée au LOT 3 (verrou, upsert
   de la correspondance, une page par classe trouvée dans le fichier fictif
   à deux classes `6A-FICTIF-LOT4` / `6B-FICTIF-LOT4`, passage en `review`
   avec le bon `page_count`), puis vérification humaine des deux pages.
3. **Écriture partielle + refus réel d'approbation** : écrit les créneaux
   d'une seule des deux pages vérifiées, puis rejoue la garde d'`approve.ts`
   (`findVerifiedPagesWithoutSlots`) : l'approbation est refusée tant que la
   seconde page vérifiée n'a aucun créneau — vérifié en relisant le statut en
   base (`review`, pas `approved`), pas sur la seule valeur de retour de la
   fonction.
4. **Écriture complète + approbation réelle** : la seconde page reçoit ses
   créneaux, la garde se lève, l'approbation aboutit réellement en base.
5. **Cas adverse au niveau du schéma, pas seulement du code** : avant
   d'exécuter la séquence d'activation d'`activate.ts`, tentative directe
   d'activer la nouvelle version sans retirer l'ancienne (déjà active pour le
   même périmètre établissement/`classes`/`2026-2027`). PostgreSQL rejette
   lui-même l'écriture (`23505`, index unique partiel
   `schedule_source_versions_one_active_uidx`) — preuve que l'invariant
   « jamais deux versions actives » tient au niveau du schéma, même si le
   code applicatif d'`activate.ts` était contourné ou buggé. Vérifié aussi
   que la tentative rejetée ne laisse aucune trace (la version reste
   `approved`).
6. **Activation réelle**, dans l'ordre exact d'`activate.ts` (verrou de
   périmètre, retrait de l'ancienne version active vers `superseded`,
   activation de la nouvelle) : vérifié en base qu'une seule version est
   active pour le périmètre, l'ancienne étant proprement `superseded`.
7. **Lecture réelle par l'agent**, via `db/index.ts` (connexion applicative
   distincte de celle de l'écriture), avec un périmètre déjà résolu — voir
   « Portée assumée » ci-dessous :
   - une identité de la classe `6A-FICTIF-LOT4` reçoit exactement son cours
     du jour (matière, source = la version activée par ce lot) ;
   - une identité d'une classe jamais importée (`6C-FICTIF-LOT4`) ne reçoit
     rien (`courses: []`), sans erreur ;
   - une identité de la classe de l'**ancienne version retirée**
     (`6Z-FICTIF-LOT4-ANCIEN`) ne reçoit plus rien non plus, alors que ses
     créneaux existent toujours physiquement en base : la requête de lecture
     ne regarde que les versions `active`, donc une version supplantée ne
     répond plus, même pour sa propre classe.

24 assertions, cible `127.0.0.1:54322`, nettoyage explicite vérifié à zéro
trace (`select count(*) from institutions where id = ...` → `0`).

### Portée assumée de la recette

La résolution identité → périmètre autorisé
(`resolveVerifiedScheduleScope`, `api/_shared/schedule-identity-reader.ts`)
n'est **pas** rejouée par ce script : elle est déjà recettée par
`scripts/schedule-identity-sql-recipe.mjs` et
`scripts/test-local-schedule-identity-adversarial.mjs`. Cette recette part
d'un périmètre déjà résolu (`TrustedScheduleScope`), exactement la forme que
produirait une identité vérifiée, et prouve la suite de la chaîne : dépôt →
écriture → approbation → activation → lecture réelle sur la version activée.
La route HTTP complète avec authentification Supabase (JWT, MFA,
appartenance à l'établissement) n'est pas rejouée non plus — même niveau de
preuve que les LOT 1, 2 et 3 de ce plan.

## Bogue réel trouvé et corrigé — pas contourné dans la recette

**Aucun import tabulaire ne pouvait jamais être approuvé.**
`schedule_validate_source_promotion()`
(`20260901101500_add_schedule_retirement_governance.sql`) exige, pour
`approved`/`active`/`superseded`, que `validation_summary` porte
`pageCountVerified = 'true'` et `pageAssetsVerified = 'true'`, et qu'une
image de page privée (`schedule_page_assets`) existe pour chaque page —
deux notions propres au pipeline PDF (page scannée, comptage de pages par
OCR) sans équivalent pour un fichier tabulaire. Le LOT 3 n'était jamais allé
jusqu'à l'approbation et n'avait donc pas touché cette fonction ; sa
correspondance de colonnes ne renseigne jamais ces deux clés et ne produit
aucune image de page.

Sans correctif, ce lot se serait arrêté net à la première tentative
d'approbation — c'est bien la recette PostgreSQL réelle qui l'a révélé, pas
une relecture de code. Corrigé par
`supabase/migrations/20260907130000_allow_tabular_schedule_approval.sql` :
pour `source_format = 'tabular_import'`, seul `securityScan = 'clean'` est
désormais exigé et aucune image de page n'est requise ; le contrôle
`pageCountVerified`/`pageAssetsVerified` et l'exigence d'image de page
restent strictement identiques pour `source_format = 'pdf_import'` — la
recette du LOT 2 (`recipe:local-schedule-approval-gate-adversarial`) et
celle du LOT 3 (`recipe:local-schedule-tabular-mapping-adversarial`) ont été
rejouées après ce correctif et restent vertes, preuve que le pipeline PDF
n'a pas bougé.

Ce correctif était un préalable strictement nécessaire à la preuve demandée
par ce LOT 4 (« l'activation »), pas une extension du périmètre : sans lui,
« l'activation » d'un import tabulaire est un état inatteignable aujourd'hui,
pas seulement non testé.

## Nettoyage : une difficulté révélatrice, pas un oubli

`schedule_slots_guard_source_trigger` (sur `schedule_slots`) et
`schedule_page_assets_guard_write` (sur `schedule_page_assets`) interdisent
délibérément toute suppression une fois qu'une version est
`active`/`superseded`/`retired` — y compris via une suppression en cascade
depuis `institutions`. C'est une garantie de gouvernance réelle (un emploi du
temps déjà diffusé ne peut pas être discrètement effacé ou falsifié), pas un
oubli : elle a d'ailleurs empêché le nettoyage naïf du script pendant sa
mise au point. Contournée uniquement pour le nettoyage de cette recette, en
tant que superutilisateur `postgres` de la pile locale jetable
(`alter table ... disable/enable trigger`, jamais possible pour
`service_role` ni pour un rôle applicatif, jamais sur une base distante).

## Ce qui n'a pas été touché

- `api/_shared/schedule-slot-write.ts`, `approve.ts`, `activate.ts`,
  `api/_shared/schedule-identity-reader.ts`,
  `api/_shared/schedule-reader.ts` : zéro ligne modifiée. La recette rejoue
  leur logique de transaction ou les appelle directement, sans les changer.
- Le pipeline PDF (`schedule_validate_source_promotion` pour
  `source_format = 'pdf_import'`) : comportement strictement identique
  avant/après le correctif, vérifié par les recettes du LOT 2 et du LOT 3
  rejouées après coup.

## Preuves obtenues

- `node node_modules/typescript/bin/tsc --noEmit` : aucune erreur.
- `npx vite build` : succès (même avertissement préexistant sur la taille du
  chunk `xlsx`, sans rapport avec ce lot).
- **`npm run recipe:local-schedule-import-e2e` — preuve PostgreSQL locale
  réelle de bout en bout** : 24 assertions passées, cible `127.0.0.1:54322`,
  nettoyage explicite vérifié à zéro trace (`cleanupVerified: true`).
- `npm run recipe:local-schedule-approval-gate-adversarial` (LOT 2) : rejouée
  après le correctif de migration, 8 assertions, toujours verte.
- `npm run recipe:local-schedule-tabular-mapping-adversarial` (LOT 3) :
  rejouée après le correctif de migration, 11 assertions, toujours verte.
- `npm run test:migration-integrity` : 111 migrations, versions uniques,
  aucune référence cassée.
- `npm run test:preview-security-gate` : code de sortie 0, 0 échec sur
  l'ensemble de la chaîne existante, terminée sur `test:migration-integrity`.
- `npm run test:spec-integrity` : OK (5 specs, 635 tâches, inchangé).

## Non vérifié (à dire explicitement)

- **Aucune recette navigateur réelle** : personne n'a cliqué dans un vrai
  navigateur (dépôt, correspondance, écriture, approbation, activation).
  Cette recette prouve la chaîne au niveau base de données et fonctions
  serveur réelles, pas l'écran ni la route HTTP authentifiée complète.
- **La résolution identité → périmètre n'est pas rejouée ici** : voir
  « Portée assumée » ci-dessus. Elle est prouvée ailleurs
  (`schedule-identity-sql-recipe.mjs`,
  `test-local-schedule-identity-adversarial.mjs`), pas dans ce script.
- **Le worker de file d'attente (`schedule-document-worker.mjs`) n'est pas
  rejoué** : la recette part d'une version déjà en `mapping_pending`/`review`
  construite directement en SQL, pas d'un job réel dans `pgmq`.
- **Un seul scénario de « retrait propre »** : la recette prouve qu'une
  ancienne version active est supplantée par la nouvelle lors d'une
  activation normale et que l'invariant est protégé au niveau du schéma. Le
  parcours humain explicite de retrait (`retire.ts`, avec motif et
  gouvernance de rétention) n'est pas rejoué par ce lot.

## Statut

LOT 4 terminé au sens du plan : la chaîne complète (dépôt tabulaire →
correspondance de colonnes → écriture des créneaux → refus réel d'une
approbation incomplète → approbation → activation avec retrait propre et
invariant « une seule version active » prouvé au niveau du schéma
PostgreSQL → lecture réelle par l'agent distinguant une classe couverte
d'une classe non couverte et d'une classe dont la version a été retirée) est
prouvée sur PostgreSQL réel jetable, avec commit réel puis nettoyage
explicite vérifié. Un bogue bloquant réel (aucune approbation tabulaire
possible) a été trouvé et corrigé au minimum nécessaire, sans toucher au
pipeline PDF. Non prouvé par un clic navigateur réel, par la route HTTP
authentifiée complète, ni par un job de file d'attente réel — à couvrir
ailleurs si Adel le demande. Reste ouvert pour le LOT 5 du plan (clôture
honnête).
