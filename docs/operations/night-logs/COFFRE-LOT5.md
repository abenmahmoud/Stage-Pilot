# LOT 5 — Les quatre parcours, en données fictives

Plan : `docs/operations/PLAN_COFFRE_CODES_2026-09-05.md`, §LOT 5. Portée
stricte : orchestrer la séquence de chacun des cinq parcours (ENT inactif,
ENT actif, cantine, Koxo, messagerie académique) sous forme d'un contrat pur,
sans base ni réseau — dans la continuité du LOT 1 (contrat), pas une
réimplémentation des LOT 2 (schéma), LOT 3 (attribution/remise réelle) ou
LOT 4 (composant sécurisé), que ce lot compose sans y toucher.

## Ce qui a été livré

- `shared/code-vault-journeys.ts` : module pur.
  - `CODE_VAULT_JOURNEY_TYPES` : les cinq parcours du plan.
  - `VAULT_PROOF_CHANNELS` : `email` et `phone`, jamais une coordonnée saisie
    par le demandeur — la preuve part toujours d'une coordonnée déjà au
    dossier, sur le même principe que `api/identity/device/request.ts`
    (réutilisé par référence dans les commentaires, pas réimplémenté).
  - `canVaultJourneyAgentModifyContact()` : retourne structurellement `false`,
    sans branche, pour que l'agent ne puisse jamais modifier une coordonnée
    — seulement constater qu'elle est incorrecte et escalader. Même méthode
    que `canAutoReplaceDefectiveVaultCode` du LOT 3.
  - **ENT inactif** (`decideEntInactifJourneyStep`) : preuve → composant
    sécurisé (`reveal_in_secure_display`, service `ent`, LOT 4) → invitation
    à réinitialiser le mot de passe.
  - **ENT actif** (`decideEntActifJourneyStep`) : guide la réinitialisation ;
    échec ou coordonnée incorrecte ouvrent tous les deux un `open_referral`
    vers `referent_numerique` (motif distinct dans `reasonCode`), jamais une
    modification directe.
  - **Cantine** (`decideCantineJourneyStep`) : preuve → numéro annuel de badge
    dans le composant sécurisé (service `cantine`) ; échec de recherche →
    `open_referral` vers `intendance`.
  - **Koxo** (`decideKoxoJourneyStep`) : preuve → code fixe dans le composant
    sécurisé (service `koxo`) ; échec de recherche → `open_referral` vers
    `referent_numerique`.
  - **Messagerie académique** (`decideMessagerieAcademiqueJourneyStep`) :
    seul l'email est vérifiable — si ce n'est pas le cas, `form_fallback`
    immédiat ; sinon preuve puis `confirm_academic_email_only` (aucun code à
    remettre ici, contrairement aux trois autres services).
  - `ModelVisibleMessagerieAcademiqueFact` +
    `buildModelVisibleMessagerieAcademiqueFact` : même garantie structurelle
    que `ModelVisibleVaultFact` (LOT 1) — construit par une liste explicite
    de champs, aucun champ ne peut porter l'identifiant académique unique,
    qui reste interne et chiffré.
  - Services d'escalade (`referent_numerique`, `intendance`) exprimés via le
    type `SupportService` existant (`shared/support-agent-access.ts`), pas
    une chaîne libre.
- `scripts/test-code-vault-journeys.mjs` + script npm
  `test:code-vault-journeys` : 8 tests `node:test`, un par garantie du plan
  (couverture des cinq parcours, garde de non-modification de coordonnée,
  séquence complète des quatre parcours à code, formulaire enrichi pour la
  messagerie académique, non-fuite de l'identifiant académique).

## Ce qui n'a délibérément pas été fait dans ce lot

- **Aucune route HTTP, aucun appel réseau, aucune écriture en base.** Ce lot
  ne fait que décider la prochaine action d'un parcours à partir d'une phase
  explicite fournie par l'appelant ; il ne va chercher aucune preuve, aucun
  code ni aucune coordonnée lui-même. Brancher ces décisions sur
  `api/identity/device/request.ts`/`verify.ts` (preuve réelle),
  `api/_shared/code-vault-assignment.ts` (remise réelle, LOT 3) et
  `CodeVaultSecureDisplay.tsx` (LOT 4) reste à faire — non prévu par ce lot,
  qui livre le contrat d'orchestration, pas le branchement.
- **Aucun ticket réel n'est créé** par `open_referral` ni `form_fallback` :
  ce sont des décisions pures, pas un appel à la file support existante
  (`support-agent-access.ts`). Le lien avec un vrai ticket de support est un
  travail de branchement, hors périmètre.
- **La remise parent → enfant reste fermée** (T064A) : ce lot ne réévalue
  aucun accès, il réutilise `decideVaultAccess` (LOT 1) tel quel en amont de
  ces parcours, sans le modifier ni le dupliquer.

## Preuves réellement exécutées

- `npm run test:code-vault-journeys` : **8/8** tests passés.
- `node node_modules/typescript/bin/tsc --noEmit` : aucune erreur.
- `npx vite build` : succès (Windows) — `npm run build` ne tourne pas dans ce
  shell (binaires natifs Windows de rollup absents pour la commande npm
  configurée), piège déjà noté dans `CLAUDE.md`.
- `npm run test:preview-security-gate` : code de sortie `0`, jusqu'à
  `test:migration-integrity` → `104` migrations, `104` versions uniques,
  `78` références vérifiées (inchangé : ce lot ne touche aucune migration).

## Ce qui reste supposé, pas prouvé

- Ce module n'a jamais été exercé avec un vrai parcours utilisateur (aucune
  page, aucun formulaire, aucun appel API ne l'importe encore) : les tests
  sont des assertions pures sur les fonctions de décision, pas une recette
  de bout en bout.
- Le comportement réel d'escalade (« ouvrir une demande au référent
  numérique », « vers l'intendance ») n'a été vérifié qu'au niveau du type
  de décision retourné (`SupportService` + `reasonCode`) ; la création
  effective d'un ticket dans la file support n'a pas été exercée.
- Aucune donnée réelle, aucun email envoyé, aucun drapeau activé. Aucune
  lecture de `~/Documents/LyceeGest-DONNEES-PRIVEES`. Aucun `git push` — un
  seul commit local pour ce lot, limité à `shared/code-vault-journeys.ts`,
  son script de test et l'entrée `package.json` correspondante.
