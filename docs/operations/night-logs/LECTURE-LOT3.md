# LECTURE — LOT 3 : brancher les trois parcours à code

Date : 6 septembre 2026. Plan : `docs/operations/PLAN_LECTURE_COFFRE_2026-09-06.md`,
section « LOT 3 — Brancher les trois parcours à code ». Commit :
`3e1a583` (« feat(coffre): LOT 3 lecture - brancher ent-inactif, cantine et
koxo sur le point de lecture »).

## Contexte reçu au démarrage de cette session

Une session LOT 3 précédente avait disparu sans committer ni écrire de
compte rendu (documenté sans le masquer par la session LOT 5,
`docs/operations/night-logs/LECTURE-LOT5.md`). Elle avait laissé, non
committées dans l'arbre de travail, des modifications sur exactement les
fichiers attendus du LOT 3. Cette session a repris ces modifications déjà
présentes sur le disque, les a vérifiées ligne à ligne avant de les committer
sous son propre nom, et a rejoué elle-même toutes les preuves — aucune preuve
de la session LOT 5 n'a été réutilisée telle quelle, conformément à la règle
du plan : une preuve locale non committée dans la session du lot n'est pas
une clôture de lot.

## Ce qui a été vérifié avant de committer

Relecture complète des diffs des neuf fichiers, pas seulement de leur
existence :

- `api/_shared/code-vault-ent-inactif-route.ts` et
  `api/_shared/code-vault-service-delivery-route.ts` (cantine + koxo) :
  chaînent `resolveVaultCodeReveal` (`api/_shared/code-vault-read.ts`, LOT 1/2
  du plan) uniquement dans la branche `displayOutcome.outcome === "displayed"`.
  Vérifié en lisant le corps complet des deux fonctions : tous les autres
  chemins (`denied`, `step` par expiration de fenêtre, `quota_exceeded`)
  renvoient **avant** cette branche — `resolveVaultCodeReveal` est donc
  structurellement inatteignable pour un refus.
- `shared/code-vault-ent-inactif-screen.ts` : transporte `value`/`reason` de
  la route vers l'état `revealed` sans recalculer de règle.
- `src/pages/coffre/CoffreEntInactifPage.tsx` : `screen.value !== null` monte
  réellement `CodeVaultSecureDisplay` avec la valeur ; sinon affiche le motif
  exact (`reveal_disabled` ou `not_displayed`) au lieu d'un message générique
  masquant la cause.
- `api/vault/ent-inactif.ts`, `api/vault/cantine.ts`, `api/vault/koxo.ts`
  (non modifiés par ce lot, relus pour confirmer le branchement de bout en
  bout) : ne passent jamais d'`env` à la route, donc `resolveVaultCodeReveal`
  lit `process.env` en production — le paramètre `env` des types de route
  n'existe que pour les recettes locales.
- Seule `CoffreEntInactifPage.tsx` existe dans `src/pages/coffre/` : cantine
  et koxo n'ont pas de page dédiée dans ce dépôt (portée d'un autre plan de
  branchement, pas de ce lot) — la valeur déchiffrée pour ces deux parcours
  est donc vérifiée jusqu'à la réponse de la route, pas jusqu'à un composant
  monté, ce qui correspond à l'état réel du dépôt et pas à un manque introduit
  ici.

## Preuves rejouées dans cette session, sur PostgreSQL réel local jetable

Docker Desktop n'était pas démarré à l'ouverture de cette session ; il a été
lancé puis attendu jusqu'à disponibilité, puis `npx supabase start` a monté
la pile locale (`127.0.0.1:54322`).

- `node node_modules/typescript/bin/tsc --noEmit` → aucune erreur.
- `npm run test:code-vault-ent-inactif-route` → 6 tests, tous verts.
- `npm run test:code-vault-service-delivery-route` → 14 tests (cantine +
  koxo), tous verts.
- `npm run test:code-vault-ent-inactif-screen` → 10 tests, tous verts.
- `npm run test:code-vault-ent-inactif-page` → 6 tests, tous verts.
- `npm run recipe:local-code-vault-ent-inactif-route` (PostgreSQL réel,
  `127.0.0.1:54322`) →
  `{"target":"127.0.0.1:54322","assertions":30,"rollbackVerified":true,"realData":false}`.
- `npm run recipe:local-code-vault-service-delivery-route` (cantine et koxo,
  même pile) →
  `{"target":"127.0.0.1:54322","assertions":44,"rollbackVerified":true,"realData":false}`.
- `npm run recipe:local-code-vault-branchement-adversarial` (non-régression
  sur la nouvelle forme de réponse `value`/`reason`) →
  `{"target":"127.0.0.1:54322","assertions":34,"rollbackVerified":true,"realData":false}`.

Toutes les transactions de recette confirment `rollbackVerified: true` et
`realData: false` : aucune ligne fictive ne reste en base après exécution.

## Chemin de refus — vérifié explicitement, comme l'exige le plan

Preuves présentes dans `scripts/test-local-code-vault-ent-inactif-route.mjs`
et `scripts/test-local-code-vault-service-delivery-route.mjs`, rejouées
ci-dessus :

- **Quota dépassé** : le quatrième affichage bascule sur `form_fallback`
  avant tout appel à `resolveVaultCodeReveal` (scénario déjà existant,
  non modifié par ce lot, revérifié par la relecture du code).
- **Fenêtre de 30 minutes expirée** : une remise déjà expirée renvoie
  `{ outcome: "step", action: { kind: "send_proof", ... } }` — jamais
  `displayed`, donc jamais de tentative de déchiffrement.
- **Rôle insuffisant** : `self_only` (`refusal_returns_reason`, ligne 108 du
  script ENT inactif) refuse avant la création de toute attribution.
- **Autre établissement** : nouveau scénario de ce lot,
  `institution_mismatch`, ajouté aux deux scripts de recette (ENT inactif et
  cantine) — aucune attribution, aucun événement `consult`, donc
  `resolveVaultCodeReveal` jamais atteint.
- **Code défectueux** : reste structurellement inatteignable dans ce dépôt —
  aucune route n'appelle `flagVaultCodeDefective` (état documenté avant ce
  lot par le plan de branchement, LOT 3, et non modifié ici). Ce n'est pas un
  manque introduit par ce lot ; c'est un constat repris tel quel.

Dans les cinq cas, `resolveVaultCodeReveal` — donc toute lecture de
`code_vault_private_rows` — n'est atteignable que par la branche
`outcome === "displayed"`, structurellement, pas par une vérification
ajoutée après coup.

## Ce que ce lot ne couvre pas

- Le drapeau `CODE_VAULT_REVEAL_ENABLED` reste fermé partout
  (`.env.local.example` à `false`) : aucune route de production ne peut
  déchiffrer quoi que ce soit tant qu'il n'est pas ouvert explicitement,
  ailleurs, par une décision séparée.
- Aucune page dédiée cantine/koxo n'existe dans ce dépôt : le branchement
  jusqu'à `CodeVaultSecureDisplay` n'est prouvé que pour ENT inactif.
- La recette adverse avec marqueur traqué partout (LOT 4 du plan de lecture)
  n'a pas tourné dans cette session : hors périmètre de ce lot.
- Les vérifications finales du plan (`tsc`, `vite build`,
  `test:preview-security-gate`, `test:spec-integrity`) sont réservées au
  LOT 5 (clôture) et n'ont pas toutes été rejouées ici — seul `tsc --noEmit`
  l'a été, pour confirmer que ce lot ne casse rien au typage.

## Périmètre respecté

Branche `codex/lycee-connect-prototype`, aucun `git push`, aucun drapeau
activé, aucune donnée réelle, aucun envoi, aucun déploiement, aucune lecture
de `~/Documents/LyceeGest-DONNEES-PRIVEES`. Aucun agent en arrière-plan :
relecture, exécution des recettes réelles et rédaction ont eu lieu dans
cette session. Commit `3e1a583` ne porte que les neuf fichiers explicitement
listés ci-dessus ; `docs/operations/PLAN_CONNAISSANCE_OB1_2026-09-05.md` et
`nuit.ps1`, modifiés par ailleurs dans l'arbre de travail mais hors périmètre
de ce lot, n'ont pas été touchés ni committés par cette session.
