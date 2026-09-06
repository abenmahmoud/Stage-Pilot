# LOT 2 — Ne jamais journaliser une erreur PostgreSQL entière

Plan : `docs/operations/PLAN_BRANCHEMENT_COFFRE_2026-09-06.md`, §LOT 2.
Portée stricte : le helper de sanitisation d'une erreur Postgres, son
application au point d'écriture du LOT 1, et le test adverse qui prouve
qu'un marqueur placé dans `detail` ne fuit nulle part. Aucune route, aucun
parcours (LOT 3+).

## Ce qui a été livré

- `shared/code-vault-pg-error.ts` — module pur (aucune connexion) :
  - `sanitizePgError(error: unknown): SanitizedPgError` ne lit que deux
    champs d'une erreur reçue — `message` et `constraint_name` — et jette le
    reste sans jamais y accéder autrement que pour ces deux lectures. Le
    `message` est tronqué à 300 caractères ; une valeur absente ou du
    mauvais type devient `"pg_error_unknown"`. Le `constraint_name` n'est
    gardé que s'il ressemble à un identifiant Postgres
    (`^[a-zA-Z_][a-zA-Z0-9_]{0,127}$`) — un `constraint_name` fabriqué et
    truffé de texte libre est rejeté, pas juste tronqué.
  - `SanitizedPgWriteError` — une erreur à lancer à la place de l'erreur
    Postgres brute. Ne porte que le message et le nom de contrainte
    sanitisés, jamais de `cause` ni de référence à l'objet d'origine : un
    `console.error` ou un `JSON.stringify` de cette erreur ne peut pas faire
    réapparaître `detail`, même indirectement.
  - Le commentaire d'en-tête documente les noms de champs réels du pilote
    `postgres` utilisé par le dépôt (`node_modules/postgres/src/
    connection.js`, table `errorFields` du protocole) : `message`, `detail`,
    `constraint_name`, etc. — vérifié par lecture directe du paquet, pas
    supposé.
- `api/_shared/code-vault-write.ts` — le point d'écriture unique du LOT 1 :
  l'`insert` est maintenant dans un `try/catch` ; toute erreur levée par
  `tx.execute` est interceptée et remplacée par
  `new SanitizedPgWriteError(sanitizePgError(error))` avant de remonter à
  l'appelant. L'erreur Postgres brute (donc son `detail`) ne quitte jamais
  cette fonction.
- `scripts/test-code-vault-pg-error.mjs` (`npm run test:code-vault-pg-error`,
  sans base) : cinq tests, dont le test adverse exigé par le plan —
  - une erreur fabriquée dans la forme exacte d'une `PostgresError` du
    paquet `postgres`, avec un marqueur secret dans `detail` (imitant un
    vrai `Failing row contains (...)`), sanitisée par `sanitizePgError` ne
    garde que `message` et `constraintName` ; un parcours récursif de
    l'objet résultat (`assertNoMarkerAnywhere`) confirme que le marqueur n'y
    apparaît nulle part ;
  - un `constraint_name` fabriqué pour contenir le marqueur mais ne
    respectant pas la forme d'un identifiant est rejeté (`undefined`), pas
    juste filtré partiellement ;
  - `sanitizePgError` tolère toute entrée qui n'est pas une `PostgresError`
    (`null`, `undefined`, chaîne brute, objet incomplet) sans jeter ;
  - `SanitizedPgWriteError` ne porte aucune trace de l'erreur d'origine :
    pas de `cause`, et le marqueur est absent de `message`, `stack`, et de
    la sérialisation JSON de l'erreur (`JSON.stringify` avec
    `Object.getOwnPropertyNames`, pour couvrir les propriétés
    non-énumérables comme `stack`) ;
  - **test d'intégration** : `writeVaultCodeValue` appelé avec une
    transaction fictive dont `execute` lève l'erreur fabriquée relance bien
    une `SanitizedPgWriteError` (jamais l'objet d'origine — vérifié par
    `assert.notEqual`), dont le message, la pile et la sérialisation JSON ne
    contiennent le marqueur nulle part.
- `package.json` : une entrée ajoutée, `test:code-vault-pg-error`, juste
  après `test:code-vault-write-point`, même nommage.

## Portée délibérément non couverte par ce lot

- Aucune route n'appelle encore `writeVaultCodeValue` : la garantie du LOT 1
  reste intacte (« tant que ce lot n'est pas passé, aucune route ne doit
  écrire »). Brancher une route est le LOT 3.
- Le sanitiseur ne traite que la forme d'erreur du point d'écriture du
  coffre (une erreur Postgres levée par `tx.execute` dans une transaction
  Drizzle/`postgres`). Il n'a pas vocation générique à tout le dépôt : le
  plan scope explicitement ce lot au « point d'écriture du LOT 1ᵉʳ ».
- D'autres champs potentiellement sensibles d'une erreur Postgres
  (`internal_query`, `where`, `hint`, ou `.query`/`.parameters` que le
  pilote `postgres` peut attacher ailleurs à certains objets de requête) ne
  sont pas mentionnés dans un message d'erreur applicatif aujourd'hui — mais
  ils ne sont pas non plus explicitement testés ici, faute de mention dans
  le plan. Seuls `message` et `constraint_name` sont garantis conservés ;
  tout le reste de l'objet d'erreur est structurellement inatteignable par
  ce module (il ne le lit jamais), donc ne peut pas fuir par ce chemin — mais
  aucun test ne couvre un futur point d'écriture qui journaliserait l'erreur
  brute avant d'appeler ce module.

## Preuves réellement exécutées

- `npm run test:code-vault-pg-error` — 5/5, sans base.
- `npm run test:code-vault-write-point` — 7/7 (non-régression LOT 1, y
  compris le balayage structurel du point d'écriture unique).
- `node node_modules/typescript/bin/tsc --noEmit` — aucune erreur.
- `npx vite build` — succès (Windows), avertissement de taille de chunk
  préexistant et sans rapport avec ce lot.
- `npm run test:preview-security-gate` — code de sortie 0, jusqu'à
  `test:migration-integrity` (108 migrations, aucun doublon).
- `npm run test:spec-integrity` — 5 specs, 635 tâches recensées.
- Non-régression : `npm run test:code-vault-policy` (16 tests),
  `npm run test:code-vault-delivery-policy` (5 tests),
  `npm run test:code-vault-journeys` (8 tests) — tous au vert.

## Ce qui reste supposé, pas prouvé

- Aucune preuve sur PostgreSQL réel qu'une vraie violation de la contrainte
  `code_vault_private_rows_ciphertext_check` (ou de l'unicité
  `assignment_id`/`institution_id`) produit un objet d'erreur avec
  exactement les champs supposés ici (`message`, `constraint_name`) : la
  preuve de ce lot repose sur la lecture du code source du paquet `postgres`
  (`errorFields`), pas sur une erreur réellement levée par un serveur
  Postgres local. Une recette locale qui provoque une vraie violation de
  contrainte et vérifie le format réel de l'erreur reçue n'a pas été faite
  dans ce lot — le plan ne l'exige pas explicitement pour le LOT 2 (contrairement au LOT 1, qui a sa propre recette locale), et aucun appelant
  réel n'existe encore pour la déclencher en conditions réelles.
- Aucune vérification que `postgres` (le paquet npm) ne joint jamais
  `detail` à un autre nom de champ selon la version installée : la preuve
  s'appuie sur la version actuellement dans `node_modules` (lue directement
  dans `node_modules/postgres/src/connection.js`), pas sur une spécification
  gelée dans un test qui échouerait si le paquet changeait de forme.

## Périmètre respecté

Aucun import de personne réelle, aucun email envoyé, aucun drapeau activé.
Aucune mutation Vercel, Supabase distant, VPS, DNS. Aucune connexion à une
base, locale ou distante, dans ce lot — tout est testé en mémoire avec des
objets fabriqués. Aucune lecture de
`~/Documents/LyceeGest-DONNEES-PRIVEES`. Aucun `git push`. Travail
entièrement fait dans cette session, aucune délégation à un agent en
arrière-plan. Commit local unique pour ce lot, avec chemins explicites,
limité aux fichiers du LOT 2 (`shared/code-vault-pg-error.ts`,
`api/_shared/code-vault-write.ts`, `scripts/test-code-vault-pg-error.mjs`,
`package.json`, ce compte rendu). Les fichiers non liés à ce lot déjà
présents dans l'arbre de travail (`docs/operations/
PLAN_CONNAISSANCE_OB1_2026-09-05.md`, `nuit.ps1`, `.nuit-coffre.lock`,
`nuit-coffre.ps1`, et le plan `PLAN_BRANCHEMENT_COFFRE_2026-09-06.md`
lui-même) n'ont pas été touchés et ne sont pas inclus dans ce commit.
