# LOT 1 — Le point d'écriture unique du chiffré

Plan : `docs/operations/PLAN_BRANCHEMENT_COFFRE_2026-09-06.md`, §LOT 1.
Portée stricte : le module de chiffrement applicatif, le point d'écriture
unique, et la preuve — structurelle et réelle — qu'aucun autre point d'écriture
n'existe. Aucune route, aucun parcours (LOT 3+).

## Ce qui a été livré

- `shared/code-vault-crypto.ts` — module pur (aucune connexion, aucune
  écriture) : AES-256-GCM sur le motif exact de
  `shared/identity-directory-lookup-crypto.mjs`, IV aléatoire à chaque
  écriture, AAD liant le chiffré à son établissement, son attribution et sa
  version de clé. Valide en entrée une valeur en clair de 4 à 128 caractères
  imprimables ; rejette toute version de clé absente de l'environnement.
  Le commentaire d'en-tête dit explicitement ce que la base ne peut pas
  garantir ici, comme demandé par le plan.
- `api/_shared/code-vault-write.ts` — **le seul endroit du dépôt** où
  `insert into public.code_vault_private_rows` doit apparaître :
  `writeVaultCodeValue(tx, { assignmentId, institutionId, value })` chiffre
  puis écrit, dans la transaction de l'appelant, sans jamais renvoyer ni
  journaliser la valeur reçue. N'implémente aucun `on conflict` : une
  deuxième écriture sur la même attribution est un bug d'appelant, pas un cas
  normal, et doit rester visible comme un rejet, pas être absorbée en
  silence.
- `scripts/test-code-vault-write-point.mjs` (`npm run
  test:code-vault-write-point`, sans base) : sept tests —
  - conformité de l'envelope aux bornes exactes de la contrainte `check` de
    `supabase/migrations/20260905170000_create_code_vault.sql` (`iv` 16-24,
    `auth_tag` 20-32, `ciphertext` 16-512, alphabet base64) ;
  - round-trip chiffrement/déchiffrement ;
  - un chiffré rejoué sous un autre établissement ou une autre attribution
    échoue au déchiffrement (AAD) ;
  - un chiffré altéré (`iv`, `auth_tag` ou `ciphertext`, dernier octet
    inversé) échoue au déchiffrement ;
  - une valeur en clair hors bornes (vide, trop longue, caractère de
    contrôle, type non-chaîne) est rejetée avant tout chiffrement ;
  - une version de clé absente de l'environnement est rejetée ;
  - **balayage structurel du dépôt** (`api/`, `shared/`, `workers/`) :
    exactement un fichier contient le littéral
    `insert into public.code_vault_private_rows`, et c'est
    `api/_shared/code-vault-write.ts`. C'est le test exigé par le plan
    (« un test qui échoue si une seconde écriture apparaît ailleurs dans le
    dépôt »).
- `scripts/test-local-code-vault-write-point.mjs` (`npm run
  recipe:local-code-vault-write-point --local-stack-only`) : preuve sur
  PostgreSQL local jetable, établissement et attribution fictifs, transaction
  annulée en fin de script (savepoints pour le rejet volontaire, comme
  LOT 2/LOT 6) :
  - `writeVaultCodeValue` écrit réellement une ligne dans
    `code_vault_private_rows` ;
  - le `ciphertext` stocké ne contient jamais la valeur en clair ;
  - le déchiffrement de la ligne stockée retrouve exactement la valeur
    écrite ;
  - une deuxième écriture sur la **même** attribution est rejetée par la
    contrainte d'unicité réelle de la table
    (`duplicate key value violates unique constraint`), pas par une
    hypothèse sur le comportement du module — toujours une seule ligne
    ensuite ;
  - balayage anti-fuite sur toute la sortie capturée du script : la valeur
    fictive n'apparaît nulle part ;
  - après annulation, aucune trace de l'établissement fictif.
- `package.json` : deux entrées ajoutées, `test:code-vault-write-point` et
  `recipe:local-code-vault-write-point`, au même endroit et sous le même
  nommage que les entrées `code-vault-*` existantes.

## Portée délibérément non couverte par ce lot

- Aucune route n'appelle `writeVaultCodeValue` : c'est exactement la garantie
  demandée par le plan (« tant que ce lot n'est pas passé, aucune route ne
  doit écrire »). Le brancher à une route est le LOT 3.
- Le balayage structurel ne couvre que `api/`, `shared/`, `workers/` — pas
  `scripts/`. Les scripts de recette existants
  (`test-local-code-vault-adversarial.mjs`, scénario 8/9) insèrent
  directement dans `code_vault_private_rows` pour prouver le comportement du
  **schéma** (LOT 2, avant que ce module n'existe) ; ce ne sont pas des
  points d'écriture applicatifs. Le plan parle explicitement de routes
  (« aucune route ne doit écrire ») : le périmètre du balayage correspond à
  ça, pas à l'ensemble du dépôt. C'est un choix de portée, écrit ici pour
  qu'il ne soit pas pris plus tard pour un oubli.
- La rotation de clé (dérivation par version, désactivation d'une ancienne
  version) n'est pas implémentée : `codeVaultCryptoConfig` ne lit que la
  version active. Le motif est le même que
  `shared/identity-directory-lookup-crypto.mjs`, qui sépare déjà
  `identityVaultConfig` (écriture) de `identityVaultKeyForVersion` (lecture
  d'une version arbitraire pour la rotation) — si ce besoin apparaît un jour
  pour le coffre de codes, il suivra le même découpage, mais rien ne le
  demande dans ce lot.
- LOT 2 (ne jamais journaliser une erreur PostgreSQL entière) n'est pas fait :
  `writeVaultCodeValue` laisse l'erreur Postgres remonter telle quelle à
  l'appelant. C'est le lot suivant, explicitement.

## Preuves réellement exécutées

- `npm run test:code-vault-write-point` — 7/7, sans base.
- `node node_modules/typescript/bin/tsc --noEmit` — aucune erreur.
- `npx vite build` — succès (Windows).
- `npm run recipe:local-code-vault-write-point -- --local-stack-only` sur la
  pile Supabase locale déjà active (`127.0.0.1:54322`, jamais `--linked`,
  jamais `db push`, jamais d'URL distante) — 7/7 assertions, transaction
  annulée, aucune trace laissée.
- `npm run test:preview-security-gate` — code de sortie 0, jusqu'à
  `test:migration-integrity` (108 migrations, aucun doublon).
- `npm run test:spec-integrity` — 5 specs, 635 tâches recensées.
- Non-régression : `npm run test:code-vault-policy`,
  `npm run test:code-vault-delivery-policy`, `npm run test:code-vault-journeys`
  rejoués, toujours au vert (16, 5, 8 tests).

## Ce qui reste supposé, pas prouvé

- Aucune preuve que `writeVaultCodeValue` se comporte correctement sous appel
  concurrent sur la même attribution (deux processus, comme le scénario 1 du
  LOT 6) : la preuve de ce lot est sur une seule connexion. Le motif
  d'unicité de la table rend un double-écriture concurrente sûre par
  construction (la deuxième transaction attend puis échoue sur la contrainte),
  mais ce n'est pas démontré ici — seulement déduit du schéma du LOT 2.
- Aucune valeur de service réel n'a été manipulée ; toutes les valeurs sont
  des marqueurs fictifs (`Koxo2026Eleve123`, `LOT1-FICTIF-<uuid>`).

## Périmètre respecté

Aucun import de personne réelle, aucun email envoyé, aucun drapeau activé.
Aucune mutation Vercel, Supabase distant, VPS, DNS. Migrations et recette sur
pile Supabase locale jetable uniquement. Aucune lecture de
`~/Documents/LyceeGest-DONNEES-PRIVEES`. Aucun `git push`. Travail entièrement
fait dans cette session, aucune délégation à un agent en arrière-plan. Commit
local unique pour ce lot, avec chemins explicites, limité aux fichiers du
LOT 1 (`api/_shared/code-vault-write.ts`, `shared/code-vault-crypto.ts`,
`scripts/test-code-vault-write-point.mjs`,
`scripts/test-local-code-vault-write-point.mjs`, `package.json`, ce compte
rendu). Les fichiers non liés à ce lot déjà présents dans l'arbre de travail
(`docs/operations/PLAN_CONNAISSANCE_OB1_2026-09-05.md`, `nuit.ps1`,
`.nuit-coffre.lock`, `nuit-coffre.ps1`, et le plan
`PLAN_BRANCHEMENT_COFFRE_2026-09-06.md` lui-même) n'ont pas été touchés et ne
sont pas inclus dans ce commit.
