# LOT 2 — Schéma chiffré du coffre de codes

Plan : `docs/operations/PLAN_COFFRE_CODES_2026-09-05.md`, §LOT 2. Portée
stricte : migration + schéma Drizzle, aucune route, aucun parcours (LOT 3+).

## Ce qui a été livré

- `supabase/migrations/20260905170000_create_code_vault.sql` : trois tables
  neuves, séparées du registre de connaissances
  (`identity_directory_*`, `knowledge_document_*`) :
  - `code_vault_assignments` — identité de l'attribution (établissement,
    personne, service, année scolaire, version, statut). Ne porte jamais la
    valeur du code.
  - `code_vault_private_rows` — valeur chiffrée au repos (AES-256-GCM :
    `iv`, `auth_tag`, `ciphertext`, `key_version`), sur le motif exact de
    `identity_directory_private_rows`. Ciphertext borné à 512 caractères
    (un code d'accès, jamais un document).
  - `code_vault_access_events` — journal d'accès append-only : fait consulté,
    profil de l'acteur, motif de refus le cas échéant. Aucune colonne de
    valeur.
- `db/schema.ts` : `codeVaultAssignments`, `codeVaultPrivateRows`,
  `codeVaultAccessEvents`, alignés sur la migration.
- Institution partout (`institution_id` sur les trois tables, FK composite
  vers `code_vault_assignments(id, institution_id)` pour les deux tables
  filles).
- RLS activée et forcée sur les trois tables ; tout privilège révoqué à
  `public`, `anon`, `authenticated` ; seul `service_role` a des droits
  (aucune politique RLS n'est nécessaire tant qu'aucun rôle client n'a de
  privilège de base — même motif que `flash_infos` et
  `identity_directory_private_rows`).
- Contrainte d'unicité sur le quadruplet (établissement, personne, service,
  année scolaire, version), correspondant exactement à `vaultAssignmentKey`
  de `shared/code-vault-policy.ts` (LOT 1).
- Déclencheurs : progression de statut limitée aux transitions légales du
  LOT 1 (`disponible -> reserve -> remis -> utilise`), identité de
  l'attribution immuable, ligne de valeur chiffrée à portée immuable, journal
  d'accès append-only, cohérence `access_denied` ⇔ motif de refus renseigné.

## Preuves réellement exécutées

Pile Supabase locale jetable (Docker), jamais `--linked`, jamais `db push`,
aucune URL distante :

- `npx supabase db reset` — les 103 migrations, y compris la nouvelle,
  s'appliquent sans erreur sur une base locale fraîche.
- Requêtes `information_schema` / `pg_class` exécutées dans le conteneur
  `supabase_db_lyceegest-prototype` :
  - `relrowsecurity` et `relforcerowsecurity` à `t` sur les trois tables ;
  - `role_table_grants` : seul `service_role` apparaît, aucune ligne pour
    `anon`, `authenticated` ou `public` ;
  - `information_schema.columns` passé au crible d'un motif
    `value|plain|clair|code_value|secret` sur les trois tables : **0
    résultat**. Aucune colonne ne peut recevoir une valeur en clair par
    erreur — vérifié par une requête, pas supposé.
- Scénarios fonctionnels exécutés dans une transaction avec points de
  sauvegarde (annulés en fin de script, base non polluée) :
  - insertion normale d'une attribution puis tentative d'un doublon du
    quadruplet → `duplicate key value violates unique constraint` ;
  - `disponible -> utilise` directement → `invalid_code_vault_assignment_transition` ;
  - `disponible -> reserve` → accepté ;
  - modification de `person_ref` sur une ligne existante →
    `code_vault_assignment_identity_is_immutable` ;
  - insertion d'une valeur chiffrée conforme → acceptée ;
  - insertion d'un `ciphertext` de plus de 512 caractères → rejetée par la
    contrainte `check` ;
  - insertion d'un événement `access_denied` avec motif → accepté ;
    insertion d'un `access_denied` sans motif → rejetée ;
  - tentative de modification d'un événement déjà inséré →
    `code_vault_access_events_are_append_only`.
- `node node_modules/typescript/bin/tsc --noEmit` : aucune erreur sur
  `db/schema.ts`.
- `npm run build` : succès (Windows, `vite build`).
- `npm run test:preview-security-gate` : succès, code de sortie 0, se
  terminant sur `test:migration-integrity` qui recense les 103 migrations et
  la nouvelle version sans doublon.

La pile locale a été arrêtée (`npx supabase stop`) après vérification ; les
fichiers SQL de vérification temporaires ont été supprimés, non commités.

## Ce qui reste supposé, pas prouvé

- Aucune route applicative, aucun code TypeScript de service n'utilise
  encore ces tables : l'attribution, le chiffrement applicatif réel et la
  remise sont hors périmètre du LOT 2 (LOT 3).
- Le chiffrement lui-même (dérivation de clé, rotation) n'est pas exercé
  ici : seule la forme de la colonne (`iv`/`auth_tag`/`ciphertext`, bornes de
  longueur) est vérifiée. La preuve porte sur le schéma, pas sur un module
  de chiffrement applicatif qui n'existe pas encore.
- Aucune politique RLS positive n'a été écrite car aucun rôle client n'a de
  privilège sur ces tables ; si un accès direct `authenticated` devait un
  jour être envisagé (non prévu par le plan), des politiques explicites
  resteraient à écrire et à tester séparément.
- Recette PostgreSQL réelle "adverse" avec personnes inventées : reportée au
  LOT 6, comme prévu par le plan.

## Périmètre respecté

Aucun drapeau, aucun envoi, aucune donnée réelle, aucune valeur de code
manipulée (les tests utilisent des chaînes base64 factices, jamais une
valeur de service réel). Aucune lecture de
`~/Documents/LyceeGest-DONNEES-PRIVEES`. Aucun `git push`. Un seul commit
local pour ce lot, limité aux fichiers du LOT 2.
