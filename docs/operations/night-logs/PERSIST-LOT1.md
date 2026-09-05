# LOT 1 — Accès serveur et contrats de charge (persistance flash)

Plan : `docs/operations/PLAN_FLASH_PERSISTANCE_2026-09-05.md`, LOT 1.
Portée exacte du lot : le socle et ses tests, **aucune route**.

## Ce qui est prouvé par une commande réellement exécutée

- `node node_modules/typescript/bin/tsc --noEmit` : aucune sortie, aucune erreur.
- `npm run build` : succès (`✓ built in 18.38s`), code 0. Le piège connu de
  CLAUDE.md (« `npm run build` ne tourne pas dans ce shell ») ne s'est **pas**
  reproduit ce soir sur cette machine ; à reconfirmer si un autre shell est
  utilisé plus tard.
- `npm run test:flash-payload-policy` : 16/16 tests verts.
- `npm run test:flash-access` : 8/8 tests verts.
- `npm run test:flash-recette` (chaîne existante + les deux nouveaux scripts) :
  toutes les suites vertes, aucune régression sur `flash-transitions`,
  `flash-version-diff`, `flash-audience-correction`, `flash-expiration`,
  `flash-proposal-page`, `flash-validation-page`, `flash-recette-adverse`,
  `flash-validation-access`.
- `npm run test:preview-security-gate` : code de sortie 0. 116 groupes de
  tests exécutés, 886 assertions individuelles (`ℹ pass`), 0 échec
  (`grep "ℹ fail [1-9]"` ne retourne rien).

## Fichiers créés

- `api/_shared/flash-access.ts` — lit l'appartenance active de l'acteur à
  l'établissement configuré (même motif que `api/_shared/support-agent-access.ts` :
  jointure `institution_memberships` × `institutions`, filtre `status = 'active'`
  et établissement `pilot`/`active`), en tire les `serviceCodes` réellement
  accordés, et appelle `decideFlashValidationAccess`
  (`shared/flash-validation-access.ts`, LOT déjà livré) — aucune règle
  métier n'est réimplémentée. Trois exports :
  - `activeFlashServiceCodes(membership)` — filtre pur, sans accès base.
  - `requireFlashActor(req)` — lecture base, jette `HttpError` (401/403/503).
  - `assertFlashValidationAccess(actor, proposedBy)` — pur, jette `HttpError(403)`
    si la décision refuse.
- `shared/flash-payload-policy.ts` — contrats stricts (`isValidXPayload`)
  pour quatre formes de réponse serveur déjà déterminées par les modules purs
  existants : version flash (`flash-transitions` + `flash-version-diff` +
  `flash-audience-correction` pour les enums), décision de validation
  (miroir de `FlashValidationDecision`), traitement d'audience (miroir de
  `FlashAudienceTreatment`), contrôle d'expiration (miroir de
  `FlashExpirationCheck`). Champs inconnus refusés (`hasExactFields`),
  booléens stricts, aucun `null` accepté à la place d'un booléen. Vérifié par
  test que `reason` est `null` si et seulement si `allowed` est vrai — c'est
  l'invariant déjà garanti par `flash-validation-access.ts`, ce fichier
  vérifie seulement qu'il survit au passage en JSON.
- `scripts/test-flash-access.mjs`, `scripts/test-flash-payload-policy.mjs` —
  tests des deux fichiers ci-dessus.

## Piège rencontré cette nuit, à ne pas repayer

En écrivant `scripts/test-flash-access.mjs`, `npm run test:flash-access` avec
`--experimental-strip-types` échouait à l'import (`ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX`
sur `constructor(public status: number, message: string)` dans
`api/_shared/auth.ts` — une propriété de paramètre TypeScript, que le mode
« strip-only » de Node ne sait pas gérer). **Ce n'est pas un bug introduit ce
soir** : reproduit à l'identique sur un test déjà existant et déjà dans le
lanceur, `scripts/test-support-normalization.mjs`, quand on le relance
directement avec `--experimental-strip-types` au lieu du flag qu'il utilise
réellement dans `package.json`. Le lanceur `test:support-normalization` s'en
sort en utilisant `--experimental-transform-types` (qui transforme au lieu de
seulement retirer les types), pas `--experimental-strip-types`. Correction
appliquée : `test:flash-access` utilise `--experimental-transform-types`.
Tout fichier de test qui importe (même indirectement) `api/_shared/auth.ts`
doit utiliser ce flag, pas `--experimental-strip-types`.

## Scripts npm ajoutés

- `test:flash-access` (`--experimental-transform-types`)
- `test:flash-payload-policy` (`--experimental-strip-types`, suffisant : ce
  fichier ne touche jamais `auth.ts`)
- Les deux sont chaînés dans `test:flash-recette`, comme
  `test:flash-validation-access` l'était déjà. **Non ajoutés** à
  `test:preview-security-gate` : ce lot ne modifie pas la porte de sécurité de
  preview, qui ne connaît pas encore le domaine flash ; c'est un choix
  délibéré, à revoir si un lot ultérieur veut les y inclure.

## Ce qui reste supposé, pas prouvé

- Aucune route n'existe encore : `flash-access.ts` et `flash-payload-policy.ts`
  ne sont appelés par aucun code de production ce soir. Leur correction est
  garantie par leurs tests unitaires seulement, pas par un usage réel bout en
  bout (ça viendra aux LOT 2 et 3).
- `requireFlashActor` (la partie qui touche réellement la base) n'est **pas**
  testée directement : elle ne peut pas l'être sans pile Postgres réelle (le
  lanceur ne simule jamais une base, conformément à la règle commune n°6).
  Seule la composition pure `activeFlashServiceCodes` +
  `assertFlashValidationAccess` est testée. La preuve bout en bout sur
  PostgreSQL réel est explicitement réservée au LOT 7.
- La liste `FLASH_ACTOR_ROLES` (superadmin, administration, agent, proviseur,
  professeur) est une hypothèse raisonnable calquée sur les rôles JWT déjà en
  usage côté support, mais aucun lot n'a encore confirmé quels rôles peuvent
  réellement proposer une information flash (ce sera tranché au LOT 2). Elle
  pourra être resserrée ou élargie sans casser les tests de ce lot, qui ne
  portent que sur `activeFlashServiceCodes` et `assertFlashValidationAccess`.
- Migration : aucune migration n'a été ajoutée ni rejouée dans ce lot (le
  schéma des six tables flash existait déjà avant ce lot). Le blocage Docker
  Desktop mentionné dans `CLAUDE.md` pour d'autres migrations n'a pas été
  retesté ici et reste donc dans l'état où il était.

## Commit

Un commit local sur `codex/lycee-connect-prototype`, aucun push.
