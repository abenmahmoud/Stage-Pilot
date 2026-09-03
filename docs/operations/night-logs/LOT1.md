# LOT 1 — Rejeu des 94 migrations sur PostgreSQL jetable

Date : 2026-09-03 (nuit), branche `codex/lycee-connect-prototype`, HEAD `9b182a2`.

## Résultat

**PROUVÉ** : les 94 migrations s'appliquent sans erreur sur une pile PostgreSQL
locale jetable (Supabase CLI `2.116.0`, conteneurs Docker). Aucune donnée
réelle utilisée (jeu synthétique généré par le script de recette).

## Étapes exécutées

1. `docker info` → daemon Docker Desktop `29.3.1` répond (WSL2, backend
   `docker-desktop`). Pas d'erreur de connexion.

2. `npm run test:local-production-shape-migration-safety` → sortie :
   ```
   {"explicitConfirmation":true,"localOnlyCommands":true,"remoteCredentialsRemoved":true,
    "pinnedCli":true,"syntheticFixtureOnly":true,"productionReferencesAbsent":true}
   ```
   Tous les garde-fous à `true`. Aucune URL distante, aucun identifiant réel
   détecté dans le script de recette.

3. `npx --yes supabase@2.116.0 start` → pile locale jetable démarrée avec
   succès (exit code 0). Terminé à 03:46:54.
   - `DB_URL` : `postgresql://postgres:postgres@127.0.0.1:54322/postgres`
   - `API_URL` : `http://127.0.0.1:54321`
   - Clés (`ANON_KEY`, `SERVICE_ROLE_KEY`, `PUBLISHABLE_KEY`, `SECRET_KEY`) :
     valeurs par défaut publiques du CLI Supabase pour le développement local
     (documentées dans le dépôt officiel `supabase/cli`), pas des secrets de
     production.
   - Observation mineure : le conteneur `supabase_vector_lyceegest-prototype`
     (collecte de logs) redémarrait en boucle au moment du contrôle
     (`docker ps`) ; n'affecte pas la base Postgres ni le résultat des
     migrations. **SUPPOSÉ non bloquant** — non vérifié plus en profondeur
     dans ce lot, à surveiller au LOT 2.

4. `npm run recipe:local-production-shape-migration -- --local-container-only`
   → exit code 0, terminé à 03:49:04 (~2 min 10 s après la fin du démarrage
   de la pile).
   - Réinitialisation de la base à la version `20260518073508` (schéma
     initial + RLS/triggers + code accès professeurs), puis rejeu séquentiel
     des migrations suivantes une par une, dans l'ordre chronologique, sans
     interruption ni erreur.
   - Sortie finale :
     ```
     {"applied":[...94 chemins de fichiers .sql...],"message":"Migrations applied"}
     ...
     {"target":"local_synthetic_production_shape","cliVersion":"2.116.0",
      "migrations":94,"classes":44,"staff":106,"students":1159,
      "placements":1159,"realData":false}
     ```
   - Décompte : 3 migrations du schéma initial (`001_initial_schema`,
     `002_rls_and_triggers`, `add_code_acces_to_professeurs`) + 91 migrations
     listées dans `"applied"` = **94 migrations**, conforme au plan.
   - `realData:false` confirmé : jeu de données 100 % synthétique (44
     classes, 106 personnels, 1159 élèves, 1159 affectations fictives).

## Ce qui est PROUVÉ

- Les 94 migrations s'appliquent sans erreur SQL sur PostgreSQL réel (pas
  SQLite ni simulateur).
- Le script de recette applique exclusivement des données synthétiques
  (`realData:false`).
- Le garde-fou de sécurité (`test:local-production-shape-migration-safety`)
  confirme l'absence de commande distante ou d'identifiant réel dans le
  chemin d'exécution.
- Durée du rejeu complet (94 migrations) : environ 2 minutes 10 secondes sur
  cette machine.

## Ce qui est SUPPOSÉ (non vérifié dans ce lot)

- Que le redémarrage en boucle de `supabase_vector` n'a pas d'effet sur
  l'intégrité des données répliquées — plausible car ce conteneur ne
  participe pas au chemin d'écriture Postgres, mais non contrôlé
  explicitement ici.
- Le contenu détaillé de `20260902210908_create_identity_device_access.sql`
  (contraintes, RLS, triggers) n'a pas été vérifié dans ce lot : c'est
  l'objet du LOT 2, non exécuté (hors périmètre demandé pour cette session).

## État de la pile en sortie de lot

Pile Supabase locale jetable laissée allumée (conforme à la consigne du plan
« Laisse la pile allumée pour le LOT 2 ») :
- Postgres : `127.0.0.1:54322`
- API : `127.0.0.1:54321`
- Studio : `127.0.0.1:54323`

Aucune donnée réelle, aucun email, aucun drapeau activé, aucune action
distante au cours de ce lot.
