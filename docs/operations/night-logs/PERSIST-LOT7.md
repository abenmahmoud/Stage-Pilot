# LOT 7 — Recette sur PostgreSQL réel jetable (2026-09-05)

Périmètre strict : `docs/operations/PLAN_FLASH_PERSISTANCE_2026-09-05.md`, LOT 7
uniquement. Personnes, établissements et contacts entièrement fictifs. Aucun
drapeau ouvert, aucun envoi réel, aucune donnée réelle, aucune commande
`--linked`/`db push`/URL distante.

## Ce qui est prouvé par une commande réellement exécutée

### Pile locale et rejeu des migrations

- `docker info` : Docker Desktop tournait réellement pendant cette session
  (contrairement au blocage noté le 3 septembre). `npx supabase start` a
  démarré la pile locale (`127.0.0.1:54321` API, `127.0.0.1:54322` Postgres).
- `npx supabase db reset` a **rejoué les 98 migrations depuis zéro** sur ce
  Postgres jetable, sans erreur, y compris les deux migrations flash
  (`20260905013000_create_flash_info_foundation.sql`,
  `20260905110000_add_flash_proposal_idempotency.sql`). C'est la preuve que
  CLAUDE.md demandait ("les 94 migrations n'ont pas encore été rejouées sur un
  PostgreSQL réel") — le blocage Docker Desktop du 3 septembre n'existe plus
  aujourd'hui, sur cette machine, à cet instant. Le nombre de migrations est
  passé à 98 depuis la note du 3 septembre (lots flash 2 à 6 déjà mergés).
- Conteneurs vérifiés sains pendant toute la recette : `supabase_db`,
  `supabase_auth` (GoTrue), `supabase_kong`, `supabase_rest`.

### Script de recette

Nouveau fichier `scripts/test-local-flash-persistence.mjs` (+ worker
`scripts/flash-recette-decision-worker.mjs` pour le scénario de concurrence),
même famille que `scripts/test-local-nominative-persistence.mjs` : cible
codée en dur `127.0.0.1:54322`, refuse de tourner sans le flag
`--local-stack-only`, n'hérite jamais de `DATABASE_URL`.

Contrairement au module nominatif, la logique flash (LOT 2 à 4) est écrite
directement dans les routes (`api/flash/proposals/**`), pas extraite dans un
module de persistance injectable par `tx`. Le script appelle donc **les
handlers HTTP réels** (`proposals/index.ts`, `proposals/[id]/decision.ts`,
`proposals/[id]/correction.ts`) avec un `req`/`res` minimal et un **jeton
d'accès réellement émis par le GoTrue local** (compte créé via
`supabase-js admin.createUser`, connexion via `signInWithPassword`) — jamais
un JWT fabriqué à la main. Aucune règle métier n'est réimplémentée : les
modules purs (`flash-transitions`, `flash-audience-correction`,
`flash-version-diff`, `flash-validation-access`, `flash-decision-input`,
`flash-proposal-input`) restent ceux importés par les routes elles-mêmes.

Commande exécutée deux fois de suite (reproductible, 38 assertions à chaque
fois) :

```
node --import ./scripts/ts-test-resolver.mjs --experimental-transform-types \
  scripts/test-local-flash-persistence.mjs --local-stack-only
```

Note technique : `--experimental-strip-types` (utilisé par la plupart des
`test:flash-*`) refuse la syntaxe `constructor(public status: number, ...)`
de `api/_shared/auth.ts` (propriété de paramètre TypeScript). Il a fallu
`--experimental-transform-types`, comme le fait déjà
`test:flash-access` dans `package.json`.

### Résultat, scénario par scénario (les 7 demandés par le plan)

1. **Proposition → validation → correction, bout en bout** : `POST
   /api/flash/proposals` (201, `proposee`) → `POST .../decision` par un compte
   avec le service `referent_numerique` (200, `validee`,
   `selfValidated=false`) → **publication `validee → publiee` avancée par SQL
   direct** (aucune route ne fait cette transition : LOT 3 s'arrête
   explicitement à `validee`, voir le commentaire de `decision.ts` — trou déjà
   documenté, pas un contournement de règle puisque la transition est légale
   dans le même graphe que l'app utiliserait) → `POST .../correction` réel
   (200, `modifiee`, `gapKind=decisif`, canaux éligibles `[email, push]`
   recalculés depuis la trace `flash_notification_dispatches`, pas depuis
   l'importance déclarée) → ligne `flash_correction_decisions` vérifiée
   `confirmee` avec le bon `decided_by`.
2. **Deux enfants d'un même parent dans deux groupes : aucune livraison
   perdue.** Aucune route de ce plan n'écrit encore dans
   `flash_notification_dispatches` (règle commune : aucun envoi). Preuve faite
   **au niveau schéma** : deux informations flash distinctes, même
   `contact_ref` fictif (le "parent"), deux `version_id` différents → les deux
   lignes SMS coexistent (`count = 2`, `2` `version_id` distincts). Il n'existe
   aucune contrainte d'unicité sur `contact_ref` seul qui pourrait reproduire
   le bug du module nominatif (clé d'idempotence de groupe collisionnant sur
   un contact partagé, `specs/project-memory.md`).
3. **Validation concurrente : une seule version gagne.** Deux **processus
   Node séparés** (deux connexions Postgres distinctes, pas deux transactions
   sur la même connexion — ça aurait juste sérialisé sans rien prouver),
   synchronisés sur le même instant, décident la même proposition. Résultat
   observé : exactement une réponse `200` et une `409` (« Transition
   refusée : not_a_transition », le verrou `for update` de `decision.ts` a
   fait attendre la seconde jusqu'à ce que la première ait commité), une seule
   ligne de version, `validated_by` = l'un des deux comptes seulement.
4. **Rejeu d'une même requête : aucun doublon.** Même `Idempotency-Key`, même
   auteur, même corps : 1er appel `201`/`duplicate=false`, 2e appel
   `200`/`duplicate=true`, même `version.id`, `count(*) = 1` dans
   `flash_infos`.
5. **RLS : un membre d'un autre établissement ne voit rien.** Compte actif
   uniquement dans l'établissement B fictif, appelant la route configurée
   (`SUPPORT_INSTITUTION_SLUG`) pour l'établissement A fictif : `403`
   « Aucune appartenance active à cet établissement », **avant** toute lecture
   ou écriture d'information flash (`requireFlashActor`) ; `0` ligne créée par
   ce compte.
6. **`anon` et `authenticated` n'ont aucun privilège direct.** Requête directe
   sur `information_schema.role_table_grants` : `0` ligne pour `anon`/
   `authenticated` sur les 6 tables flash. Requête directe sur `pg_class` :
   `relrowsecurity` et `relforcerowsecurity` tous les deux vrais sur les 6
   tables. (Complément d'analyse : ces deux tables n'ont **aucune policy** ;
   la connexion applicative utilise le rôle `postgres` — superutilisateur qui
   contourne RLS de toute façon. C'est le retrait de privilège, pas RLS, qui
   protège réellement `anon`/`authenticated` ici ; RLS est une deuxième
   ceinture, pas la première.)
7. **Flash urgente notifiée puis ramenée à « normale » : la correction reste
   due.** Version `urgente`, 3 dispatches réels enregistrés `push`/`email`/
   `sms` à `status='sent'`, corrigée avec `importance='normale'` et
   `channels=[]` → `audienceTreatment.eligibleChannels` = `[email, push,
   sms]`, `correctionPossible=true`. Reproduit exactement le cas du 5
   septembre 2026 documenté dans le module et dans le plan.

### Non-régression

- `npm run test:flash-recette` : 100 % vert (tous les sous-tests unitaires
  LOT 1 à 6, y compris `test:migration-integrity` → `98` migrations, `98`
  versions uniques).
- `npm run test:preview-security-gate` : exit `0`.
- `npm run build` : `tsc --noEmit` puis `vite build` **ont tous les deux
  réussi** dans ce shell aujourd'hui (contrairement à la note connue "`vite
  build` ne tourne pas dans ce shell" du 3 septembre — apparemment résolu ou
  spécifique à l'état précédent ; à confirmer si ça se reproduit).

## Ce qui reste supposé, pas prouvé

- **La publication (`validee → publiee`) n'a aucune route.** Le scénario 1
  l'a avancée par `UPDATE` SQL direct pour pouvoir recetter LOT 4. Tant
  qu'aucune route ne fait cette transition, une flash validée dans la vraie
  application **ne peut jamais atteindre `publiee`**, donc **la correction
  (LOT 4) est actuellement inatteignable en usage réel**, malgré une route
  fonctionnelle et testée. C'est un trou de couverture fonctionnelle du plan
  lui-même (LOT 3 → LOT 4), pas un bug de LOT 7.
- **Le scénario "deux enfants, un parent, deux groupes" est une preuve de
  schéma, pas une preuve de comportement d'envoi.** Il n'existe encore aucune
  route qui écrit réellement dans `flash_notification_dispatches` à partir
  d'une audience de groupes. La garantie "aucune livraison perdue" ne porte
  donc que sur l'absence de contrainte bloquante, pas sur un algorithme de
  résolution groupe → contacts qui reste à écrire.
- **Découverte non prévue par le plan : les fixtures de cette recette ne
  peuvent pas être supprimées.** `flash_info_events` est append-only par
  trigger (`flash_events_append_only`), et
  `flash_correction_decisions.decided_by`/`requested_by` référencent
  `auth.users(id)` en `ON DELETE RESTRICT`. Une fois une information flash
  proposée puis décidée, ni elle, ni son établissement, ni les comptes qui
  l'ont décidée, ne peuvent plus être supprimés par un script applicatif — y
  compris par ce script de recette. Sur cette pile locale jetable ce n'est pas
  grave : `docker exec ... psql` confirme `8` établissements fictifs et `16`
  informations flash fictives laissées après les 4 exécutions de ce lot
  (aucune n'est réelle), et tout disparaît au prochain `npx supabase db
  reset` ou `npx supabase stop`. **Sur un environnement partagé, le même
  comportement rendrait irréversible toute recette qui va jusqu'à la
  décision** — à signaler avant toute recette équivalente hors pile locale.
- **La pile Supabase locale est restée démarrée** à la fin de cette session
  (conteneurs `supabase_*_lyceegest-prototype`). Elle contient uniquement les
  fixtures fictives ci-dessus. Arrêt : `npx supabase stop` (ou `db reset` pour
  repartir propre avant le prochain lot).
- **Preuve locale, pas recette distante** (rappel explicite demandé par le
  plan) : tout ce qui précède tourne sur `127.0.0.1:54322`/`54321`, jamais sur
  un projet Supabase distant, jamais sur `xijocumlwivhbmffrnlj` (le projet lié
  visible dans `npx supabase status`, non touché).

## Fichiers ajoutés

- `scripts/test-local-flash-persistence.mjs`
- `scripts/flash-recette-decision-worker.mjs`

Aucun fichier de LOT 1 à 6 modifié. `src/pages/prototype/lycee-connect.css`
non touché.
