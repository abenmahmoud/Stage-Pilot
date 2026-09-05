# LOT 3 — Attribution et remise du coffre de codes

Plan : `docs/operations/PLAN_COFFRE_CODES_2026-09-05.md`, §LOT 3. Portée
stricte : attribution concurrente sûre, quota d'affichage quotidien,
expiration de la visibilité, signalement défectueux, remplacement humain
tracé. Aucune route HTTP, aucun parcours utilisateur (LOT 4 et 5).

## Écart trouvé en début de lot, corrigé au passage

`shared/code-vault-policy.ts` et `scripts/test-code-vault-policy.mjs` (LOT 1,
`git log` ne montre aucun commit les touchant) ainsi que la ligne
`test:code-vault-policy` de `package.json` étaient encore non commités avant
ce lot, alors que LOT 2 (schéma) est bien commité (`cce215b`) et en dépend
implicitement. Le LOT 3 étend directement `code-vault-policy.ts` : ces
fichiers du LOT 1 sont donc inclus dans le commit de ce lot, pour ne pas
livrer une extension sans la base qu'elle prolonge. Rien d'autre du LOT 1
n'a été modifié.

## Ce qui a été livré

- `supabase/migrations/20260905180000_code_vault_delivery.sql` : ajoute à
  `code_vault_assignments` les colonnes `revealed_at`, `display_count`,
  `display_count_date`, `defective_flagged_at`, `defective_reason`,
  `defective_flagged_by`, `replaced_by_assignment_id`. Aucune de ces colonnes
  ne peut porter une valeur de code. Contraintes : bornes de compteur,
  cohérence du triplet de signalement défectueux (motif + horodatage +
  déclarant, tout ou rien), auto-référence interdite pour le remplacement,
  FK composite vers `(id, institution_id)`. Le déclencheur
  `code_vault_assignment_guard` (LOT 2) est étendu : un signalement
  défectueux et une trace de remplacement, une fois posés, sont **immuables**
  — la garantie tient par la contrainte, pas par la discipline de
  l'appelant, comme le reste du coffre.
- `db/schema.ts` : colonnes Drizzle alignées sur la migration, plus l'index
  `code_vault_assignments_display_window_idx`.
- `shared/code-vault-policy.ts` (LOT 1 étendu) : `VAULT_MAX_DAILY_DISPLAYS`
  (3), `VAULT_DISPLAY_VISIBILITY_SECONDS` (1800), `decideVaultDisplayQuota`,
  `isVaultDisplayStillVisible`, `canAutoReplaceDefectiveVaultCode` (retourne
  structurellement `false`). Toujours aucune base, aucun réseau, aucune
  valeur de code.
- `api/_shared/code-vault-assignment.ts` : module d'attribution injectable
  par `tx` (jamais de connexion propre, comme
  `api/_shared/nominative-persistence.ts`) :
  - `getOrCreateVaultAssignment` — upsert atomique
    (`on conflict ... do update`) qui pose un verrou de ligne même en cas de
    conflit : deux appels concurrents sur le même quadruplet reçoivent le
    même identifiant, jamais deux lignes ;
  - `recordVaultCodeDisplay` — verrouille la ligne (`for update`), refuse si
    défectueux, applique `decideVaultDisplayQuota`, sinon incrémente le
    compteur du jour et pose `revealed_at` ;
  - `flagVaultCodeDefective` — pose le signalement ; le déclencheur SQL
    empêche ensuite toute modification ;
  - `traceManualVaultCodeReplacement` — crée la nouvelle version et pose le
    lien `replaced_by_assignment_id` sur l'ancienne, dans la même
    transaction. N'est appelée par aucune route : réservée à une action
    administrative explicite, hors périmètre du LOT 3.
- `scripts/test-code-vault-delivery-policy.mjs` : tests purs des nouvelles
  fonctions (`test:code-vault-delivery-policy`).
- `scripts/test-local-code-vault-assignment.mjs` +
  `scripts/code-vault-assignment-concurrency-worker.mjs` : recette réelle
  (`recipe:local-code-vault-assignment`), même famille que
  `scripts/test-local-nominative-persistence.mjs` — cible codée en dur
  `127.0.0.1:54322`, refuse de tourner sans `--local-stack-only`, n'hérite
  jamais de `DATABASE_URL`.

## Preuves réellement exécutées

Pile Supabase locale jetable (Docker Desktop disponible aujourd'hui),
jamais `--linked`, jamais `db push`, aucune URL distante :

- `npx supabase start` puis `npx supabase db reset` : **104 migrations**
  rejouées depuis zéro sans erreur, y compris la nouvelle
  (`20260905180000_code_vault_delivery.sql`).
- `npm run recipe:local-code-vault-assignment` — exécuté deux fois de suite,
  **23 assertions** à chaque fois, mêmes résultats :
  1. **Concurrence réelle** : deux processus Node séparés (deux connexions
     Postgres distinctes, synchronisées sur le même instant, comme deux
     invocations serverless concurrentes — pas deux transactions sur une
     seule connexion, qui se seraient juste sérialisées sans rien prouver)
     appellent `getOrCreateVaultAssignment` sur le même quadruplet : les deux
     retournent le même `id`, `count(*) = 1` dans `code_vault_assignments`
     pour cet établissement fictif.
  2. **Quota quotidien** : 1er/2e/3e affichage acceptés
     (`remainingDisplaysToday` 2, 1, 0), 4e refusé (`quota_exceeded`) **sans**
     incrémenter le compteur (`display_count` reste à 3). Un nouveau jour
     (`display_count_date` différent) repart de zéro.
  3. **Fenêtre de visibilité de 30 minutes** vérifiée sur l'horodatage réel
     stocké par la 3e remise : visible à +1 min, invalide à +31 min
     (`isVaultDisplayStillVisible`, module pur, appliqué à une vraie valeur
     `revealed_at` lue en base).
  4. **Code défectueux** : `flagVaultCodeDefective` puis tentative
     d'affichage → `{ outcome: "defective" }`, **aucune** incrémentation du
     compteur. Tentative de modifier `defective_reason` seul (sans toucher
     `defective_flagged_at`) → rejetée par
     `code_vault_assignment_defect_flag_is_immutable` : le déclencheur
     protège le triplet entier, pas seulement l'horodatage.
  5. **Remplacement humain tracé** : nouvelle version (cantine) créée,
     `replaced_by_assignment_id` de l'ancienne pointe vers la nouvelle ;
     tentative de le changer une deuxième fois → rejetée par
     `code_vault_assignment_replacement_trace_is_immutable`.
  6. **Cohérence du signalement** : poser `defective_reason` sans
     `defective_flagged_at` → rejetée par la contrainte
     `code_vault_assignments_defect_report_consistency`.
  7. Scénario 2–7 exécuté dans une transaction avec points de sauvegarde
     (technique du LOT 2), annulée en bloc à la fin (`rollback`) ; une
     connexion de vérification séparée confirme `count = 0` sur
     l'établissement fictif après coup — aucune trace laissée.
- Vérifications directes post-recette (`docker exec ... psql`) :
  - `role_table_grants` / `has_table_privilege` : `anon` et `authenticated`
    toujours à `false` en lecture et écriture sur `code_vault_assignments`
    (le LOT 3 n'a ouvert aucun privilège) ;
  - `pg_class` : `relrowsecurity`/`relforcerowsecurity` toujours vrais ;
  - `information_schema.columns` passé au crible du motif
    `value|plain|clair|code_value|secret` sur `code_vault_assignments` :
    **0 résultat** ;
  - le déclencheur d'insertion du LOT 2
    (`code_vault_assignment_must_start_disponible`) refuse toujours une
    création directe hors `disponible`.
- `node node_modules/typescript/bin/tsc --noEmit` : aucune erreur.
- `npx vite build` : succès (Windows).
- `npm run test:code-vault-policy` (LOT 1, désormais commité) : 16/16.
- `npm run test:code-vault-delivery-policy` (LOT 3, pur) : 5/5.
- `npm run test:preview-security-gate` : code de sortie `0`, se terminant sur
  `test:migration-integrity` → `104` migrations, `104` versions uniques.
- `npm run test:spec-integrity` : `5` specs, `635` tâches recensées, aucune
  anomalie de structure.

La pile locale a été arrêtée (`npx supabase stop`) après vérification.
Aucun fichier temporaire créé pendant ce lot (les scripts de recette sont
committés, réutilisables pour LOT 5/6, contrairement au LOT 2 qui avait
utilisé des fichiers SQL jetables).

## Ce qui reste supposé, pas prouvé

- **Aucune route API n'utilise encore ce module.** `api/_shared/code-vault-
  assignment.ts` n'est appelé par aucun handler Vercel : l'intégration dans
  un parcours réel (vérification d'identité, autorisation LOT 1, affichage
  dans le composant sécurisé) reste le LOT 4 (composant) et LOT 5
  (parcours). En particulier, « une nouvelle vérification d'identité est
  nécessaire après expiration » n'est câblée nulle part encore : ce lot
  prouve seulement que `revealed_at` + `isVaultDisplayStillVisible` calcule
  correctement l'expiration ; la route qui refusera de re-livrer sans
  nouvelle preuve d'identité n'existe pas encore.
- **`traceManualVaultCodeReplacement` n'a aucun appelant.** Aucune action
  administrative n'existe encore pour déclencher un remplacement humain ; la
  fonction est prête et recettée isolément, pas intégrée à une interface.
- **Le journal d'accès (`code_vault_access_events`, LOT 2) n'est pas encore
  alimenté par ce module.** Ni `recordVaultCodeDisplay` ni
  `flagVaultCodeDefective` n'y écrivent de ligne : la décision d'autorisation
  (LOT 1, `decideVaultAccess`) et la remise (LOT 3) sont encore deux briques
  non reliées. À faire au moment où une route réelle les assemblera (LOT 5),
  pour ne pas inventer par avance la forme exacte de cette liaison.
- **Recette adverse complète avec personnes inventées, RLS bout en bout,
  balayage anti-fuite de valeur sur un scénario complet** : reportée au
  LOT 6, comme prévu par le plan. Ce lot vérifie les invariants du LOT 3
  isolément, pas l'assemblage complet des LOT 1 à 5.

## Périmètre respecté

Aucun drapeau, aucun envoi, aucune donnée réelle, aucune valeur de code
manipulée (identifiants et motifs de test entièrement fictifs). Aucune
lecture de `~/Documents/LyceeGest-DONNEES-PRIVEES`. Aucun `git push`. Un seul
commit local pour ce lot, limité aux fichiers du LOT 1 (rattrapage) et du
LOT 3. `package.json` n'a reçu que deux lignes de script
(`test:code-vault-policy`, déjà en attente ; `test:code-vault-delivery-
policy` ; `recipe:local-code-vault-assignment`) — aucune autre entrée
touchée.
