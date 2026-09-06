# LECTURE — LOT 1 : le point de lecture unique

Date : 6 septembre 2026. Plan : `docs/operations/PLAN_LECTURE_COFFRE_2026-09-06.md`,
section « LOT 1 — Le point de lecture unique ».

## Ce qui a été fait

- **`api/_shared/code-vault-read.ts`** (nouveau) : `readVaultCodeValue(tx, params)`,
  seule fonction du dépôt applicatif (`api/`, `shared/`, `workers/`) qui contient
  un `select ... from public.code_vault_private_rows`, et le seul appelant de
  `decryptVaultCodeValue` sur une ligne réelle de la table. Symétrique de
  `api/_shared/code-vault-write.ts` (LOT 1 du plan de branchement du 5 septembre).
  - Reçoit `params.displayOutcome`, typé `VaultDisplayOutcome`
    (`api/_shared/code-vault-assignment.ts`) — le résultat déjà rendu par
    `recordVaultCodeDisplay`, pas un booléen fourni par l'appelant. Si
    `displayOutcome.outcome !== "displayed"`, la fonction renvoie `null`
    **avant** toute interrogation de la table : un appelant qui n'est pas
    passé par une remise accordée ne peut donc obtenir aucune valeur, quel que
    soit ce qu'il prétend.
  - Prend `tx` en paramètre (jamais sa propre connexion), sur le même contrat
    `VaultTx` que le reste du coffre.
  - Ne journalise rien, ne construit aucun message contenant la valeur
    déchiffrée. Toute erreur Postgres levée pendant le `select` est
    interceptée et relancée via une nouvelle classe `SanitizedPgReadError`
    (ajoutée à `shared/code-vault-pg-error.ts`, réutilise `sanitizePgError` —
    seuls `message` et `constraint_name` sont conservés, jamais `detail`,
    jamais de `cause`), sur le même principe que `SanitizedPgWriteError` côté
    écriture.
  - Dérive la clé de déchiffrement via `codeVaultCryptoConfig(env)`
    (`shared/code-vault-crypto.ts`), exactement comme `writeVaultCodeValue` —
    aucune clé n'est fournie ou devinée par l'appelant.

- **`shared/code-vault-pg-error.ts`** (modifié) : ajout de la classe
  `SanitizedPgReadError`, jumelle de `SanitizedPgWriteError`, pour que le
  point de lecture propage ses erreurs par le même module que le point
  d'écriture, comme l'exige le plan.

- **`scripts/test-code-vault-read-point.mjs`** (nouveau), enregistré comme
  `npm run test:code-vault-read-point` dans `package.json` : test pur, aucune
  base, aucun réseau, 7 cas :
  1. Une remise refusée par quota n'interroge jamais `tx.execute` et renvoie
     `null` (assertion sur le nombre d'appels, pas seulement sur le résultat).
  2. Idem pour un code signalé défectueux.
  3. Une remise accordée sans ligne trouvée renvoie `null`.
  4. Un chiffré réel (produit par `encryptVaultCodeValue`) est relu et
     déchiffré à la valeur d'origine exacte.
  5. Un chiffré rejoué sous une autre attribution échoue au déchiffrement
     (AAD) plutôt que de révéler une valeur qui n'est pas la sienne.
  6. Une erreur Postgres brute (avec un `detail` contenant la valeur en clair,
     scénario construit exprès) ressort sanitisée : `SanitizedPgReadError`,
     `constraintName` préservé, mais ni `detail` ni `cause` sur l'objet, et la
     valeur en clair n'apparaît nulle part dans le message ou la
     sérialisation JSON de l'erreur.
  7. **Garantie structurelle** : parcourt tout `api/`, `shared/`, `workers/`
     et vérifie qu'aucun fichier autre que `api/_shared/code-vault-read.ts` ne
     contient le littéral `from public.code_vault_private_rows` — exactement
     le même principe que `scripts/test-code-vault-write-point.mjs` pour
     `insert into public.code_vault_private_rows`. Ce test échouerait si un
     second lecteur apparaissait ailleurs dans le dépôt.

## Ce qui n'a pas été fait (hors périmètre de ce lot, volontairement)

- Aucune route ne branche `readVaultCodeValue` (`ent-inactif`, `cantine`,
  `koxo`) : c'est le LOT 3 du plan, pas celui-ci.
- Aucun drapeau `CODE_VAULT_REVEAL_ENABLED` n'existe encore : c'est le LOT 2.
- Aucune recette PostgreSQL réelle n'a tourné sur ce lot — le plan ne
  l'exige qu'au LOT 3 (« Recette PostgreSQL locale reelle sur les trois »).
  Ce lot est un module pur, sans connexion, testé uniquement en mémoire :
  **non vérifié contre une vraie base**.
- Le module ne cache la valeur nulle part et ne l'écrit dans aucun journal,
  mais aucune recette adverse de bout en bout (marqueur traqué partout,
  navigateur réel) n'a encore été faite : c'est le LOT 4.

## Preuves exécutées dans cette session

- `npm run test:code-vault-read-point` → 7/7.
- `npm run test:code-vault-write-point` → 7/7 (non-régression).
- `npm run test:code-vault-pg-error` → 5/5 (non-régression).
- `node node_modules/typescript/bin/tsc --noEmit` → aucune erreur.
- `npx vite build` → succès (`✓ built in 18.46s`).
- `npm run test:preview-security-gate` → succès, code de sortie 0, aucun
  échec dans la sortie complète.
- `npm run test:spec-integrity` → succès (5 specs, 635 tâches, aucune
  anomalie signalée).

Toutes ces preuves sont locales, dans cette session, sur pile jetable ou sans
base du tout selon le test. Aucune n'est une recette PostgreSQL réelle : ce
point reste à faire au LOT 3.

## Périmètre respecté

Branche `codex/lycee-connect-prototype`, aucun `git push`, aucun drapeau
activé, aucune donnée réelle, aucun envoi, aucun déploiement. Commit local
uniquement, avec chemins explicites (ce fichier, le module de lecture,
l'ajout à `code-vault-pg-error.ts`, le nouveau test, et l'entrée
`package.json`) — les autres fichiers modifiés ou non suivis présents dans
l'arbre de travail (plans d'autres lots, scripts `nuit*.ps1`, fichiers de
verrou `.nuit-*.lock`) appartiennent à d'autres sessions et n'ont pas été
touchés ni committés ici.
