# LOT 2 — Fermer la porte d'approbation

Plan : `docs/operations/PLAN_IMPORT_UTILISABLE_2026-09-07.md`. Périmètre
exécuté strictement : LOT 2 seulement. Branche `codex/lycee-connect-prototype`,
aucun `git push`, aucune donnée réelle, aucun drapeau activé, aucune
migration jouée (aucun changement de schéma n'était nécessaire pour ce lot).

## Constat de départ (vérifié, pas supposé)

Lecture directe de `api/schedule/admin/imports/[id]/approve.ts` (avant
modification) : la route exige que chaque page indexée soit `verified`
(`pageCounts.verified === source.pageCount`), mais ne vérifie jamais que la
page vérifiée porte réellement des lignes dans `schedule_slots`. Le LOT 1
(`docs/operations/night-logs/UTIL-LOT1.md`) a branché l'écriture des
créneaux sur l'écran, mais rien n'empêche un administrateur de vérifier une
page sans jamais cliquer « Écrire les créneaux », ou de renvoyer une liste
vide via l'éditeur (`ScheduleSlotEditor.tsx` accepte un tableau de lignes
vide, qui remplace les créneaux existants par rien). Dans les deux cas,
l'import restait approuvable : le trou décrit par le plan était réel.

## Ce qui a été construit

- `api/_shared/schedule-slot-write.ts` — nouvelle fonction exportée
  `findVerifiedPagesWithoutSlots(tx, { institutionId, sourceVersionId })`.
  Elle interroge `schedule_page_indexes` pour les pages `review_status =
  'verified'` de la version, et rapporte celles pour lesquelles aucune ligne
  `schedule_slots` ne correspond — en rejouant exactement la même
  correspondance `class_ref`/`teacher_ref` que `writeScheduleSlots` (même
  fichier, même point de vérité) pour éviter toute divergence entre le point
  d'écriture et le point de contrôle.
- `api/schedule/admin/imports/[id]/approve.ts` — appelle cette fonction dans
  la même transaction que le reste de la promotion (après le contrôle
  d'existence/vérification de page déjà en place, avant la mise à jour de
  statut). Si au moins une page vérifiée n'a aucun créneau, l'approbation est
  refusée avec `HttpError(409, ...)` et un motif lisible nommant la ou les
  pages en cause (« Aucun créneau n'a été écrit pour la page 2. Retournez à
  l'étape d'écriture avant d'approuver. »).
- Le front (`ScheduleImportPage.tsx`, `runPromotion`) affichait déjà
  `reason.message` de toute erreur d'API dans le bandeau d'erreur de l'écran
  (`setError(reason instanceof Error ? reason.message : ...)`, via
  `apiFetch` → `readJsonApiResponse`) : le motif lisible à l'écran demandé
  par le plan est donc déjà porté par ce mécanisme existant, sans changement
  front nécessaire. Vérifié par lecture directe du code, pas par un clic
  navigateur réel (voir « Non vérifié » plus bas).
- `scripts/test-schedule-import-security.mjs` — nouveau test statique
  (« refuses approval while a verified page carries no written slot ») qui
  confirme par inspection de fichier que `approve.ts` appelle bien
  `findVerifiedPagesWithoutSlots` et interrompt l'approbation, et que la
  fonction existe avec la bonne clause `verified` / `not exists`.
- `scripts/test-local-schedule-approval-gate-adversarial.mjs` (+ script npm
  `recipe:local-schedule-approval-gate-adversarial`) — recette PostgreSQL
  locale jetable, établissement et emploi du temps entièrement fictifs.
  Rejoue la même logique de transaction qu'`approve.ts` (verrou, garde de
  page, mise à jour du statut) directement contre la base réelle : deux
  pages vérifiées, une seule porteuse de créneaux réels
  (`writeScheduleSlots`). Preuve obtenue : `findVerifiedPagesWithoutSlots`
  désigne la bonne page vide, la tentative d'approbation est réellement
  refusée (la version reste `review` en base, pas seulement un retour de
  fonction), puis après écriture des créneaux manquants sur la page vide,
  la même tentative d'approbation réussit réellement (`status = 'approved'`
  relu en base). Rollback vérifié : aucune trace de l'établissement fictif
  après la transaction.

## Ce qui n'a pas été touché

- Aucun changement de schéma / migration : le contrôle se fait entièrement
  en lecture sur les tables existantes (`schedule_page_indexes`,
  `schedule_slots`).
- Aucun changement dans `ScheduleSlotEditor.tsx` ou `ScheduleImportPage.tsx`
  : le plan demandait un motif lisible à l'écran, déjà porté par le
  mécanisme d'erreur existant du composant.
- Format tabulaire (LOT 3) et recette de bout en bout depuis le navigateur
  (LOT 4) : explicitement hors périmètre.

## Preuves obtenues

- `node node_modules/typescript/bin/tsc --noEmit` : aucune erreur.
- `npx vite build` : succès, aucune régression de résolution.
- `node scripts/test-schedule-import-security.mjs` : 17/17 tests passés
  (16 existants + 1 nouveau pour ce lot).
- `npm run test:schedule-import-security` : chaîne complète (import security
  + identity reader) verte, 4 + 20 tests passés.
- `npm run recipe:local-schedule-approval-gate-adversarial` — **preuve
  PostgreSQL locale réelle**, pas une hypothèse sur le comportement de la
  requête : 8 assertions passées, `rollbackVerified: true`, `realData:
  false`. Cible `127.0.0.1:54322` (pile Supabase locale jetable, jamais
  `--linked`, jamais d'URL distante).
- `npm run test:spec-integrity` : OK (5 specs, 635 tâches, inchangé).
- `npm run test:preview-security-gate` : code de sortie 0, aucune ligne
  d'échec sur l'ensemble de la chaîne (894 occurrences de `✔` dans la sortie
  complète), terminée sur `test:migration-integrity` (109 migrations,
  versions uniques), comme attendu.

## Non vérifié (à dire explicitement)

- **Pas de recette navigateur réelle** : aucun clic réel dans
  `ScheduleImportPage.tsx` contre une base locale n'a été rejoué pour
  confirmer que le bandeau d'erreur affiche bien le message précis renvoyé
  par `approve.ts` à l'écran. Le mécanisme de propagation (`apiFetch` →
  `setError(reason.message)`) est vérifié par lecture de code, pas par
  exécution UI. C'est du ressort du LOT 4 du plan.
- **La route HTTP complète avec authentification Supabase n'a pas été
  rejouée** : la recette adverse teste la logique de transaction
  (`findVerifiedPagesWithoutSlots` + garde + mise à jour de statut) tirée
  directement de `approve.ts`, pas le handler Vercel complet avec
  `requireScheduleManager` (JWT, appartenance à l'établissement, MFA). Ce
  choix suit le même niveau de preuve que le LOT 1 de
  `PLAN_DONNEES_REELLES_2026-09-06.md`, qui testait `writeScheduleSlots`
  directement plutôt que la route `slots.ts` complète.

## Statut

LOT 2 terminé au sens du plan : `approve.ts` refuse désormais, avec un motif
lisible, l'approbation d'un import portant au moins une page vérifiée sans
créneau écrit. Prouvé par une recette PostgreSQL locale réelle (pas
seulement des tests statiques) : le refus est réel en base, et se lève
réellement une fois les créneaux manquants écrits. Non prouvé par un clic
navigateur réel ni par la route HTTP authentifiée complète — à couvrir par
le LOT 4 (« Recette réelle de bout en bout »).
