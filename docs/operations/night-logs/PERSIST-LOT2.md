# LOT 2 — Proposer (persistance flash)

Plan : `docs/operations/PLAN_FLASH_PERSISTANCE_2026-09-05.md`, LOT 2.
Portée exacte du lot : les deux routes de proposition, aucune validation ni
correction (LOT 3 et suivants).

## Ce qui est prouvé par une commande réellement exécutée

- `node node_modules/typescript/bin/tsc --noEmit` : aucune sortie, aucune erreur.
- `npm run build` : succès (`✓ built in 9.22s`), code 0.
- `npm run test:flash-proposal-input` (nouveau) : 17/17 tests verts.
- `npm run test:flash-recette` (chaîne existante + le nouveau script) : toutes
  les suites vertes, aucune régression sur `flash-transitions`,
  `flash-version-diff`, `flash-audience-correction`, `flash-expiration`,
  `flash-proposal-page`, `flash-validation-page`, `flash-recette-adverse`,
  `flash-validation-access`, `flash-access`, `flash-payload-policy`,
  `flash-proposal-input`.
- `npm run test:migration-integrity` : 98 migrations, 98 versions uniques,
  aucune anomalie de nommage.
- `npm run test:spec-integrity` : inchangé (627 tâches, 5 specs), aucune
  régression.
- `npm run test:preview-security-gate` : code de sortie 0. `grep "ℹ fail
  [1-9]"` sur la sortie complète ne retourne rien.
- **Docker était disponible ce soir** (`docker info` répond), contrairement au
  blocage noté dans `CLAUDE.md` le 3 septembre. `npx supabase db reset` a donc
  pu rejouer les 98 migrations sur la pile Supabase locale jetable
  (`postgresql://postgres:postgres@127.0.0.1:54322/postgres`), y compris la
  nouvelle migration de ce lot, sans aucune erreur.
- Sur cette même pile locale jetable, avec un établissement et un acteur
  fictifs créés à la main (aucune donnée réelle) :
  - une première proposition (`flash_infos` + `flash_info_versions` version 1,
    statut `proposee`) s'insère sans erreur ;
  - la même clé d'idempotence, dans le même établissement, ne crée **aucune**
    seconde ligne (`INSERT 0 0`, `flash_infos_count` reste à 1) — vérifié par
    `ON CONFLICT (institution_id, idempotency_key_hash) DO NOTHING`, exactement
    la clause utilisée par la route ;
  - un couple canal/importance hors du graphe autorisé (`normale` + `push`)
    est rejeté par la contrainte CHECK existante avec le code SQLSTATE
    `23514`, confirmé par `\set VERBOSITY verbose` — c'est exactement le code
    que `isCheckViolation` intercepte dans la route pour renvoyer un 400
    propre au lieu d'une erreur Postgres brute ;
  - un scénario complet (proposition + audience à deux groupes + événement
    `flash_info.proposed`) s'insère et se relit correctement par la même
    jointure que `GET /api/flash/proposals/mine` (`flash_info_versions.version
    = flash_infos.current_version`).
  Cette preuve n'est **pas** la recette complète du LOT 7 (elle ne couvre ni
  la concurrence, ni RLS, ni le cas des deux enfants d'un même parent) : c'est
  une vérification bornée au périmètre de ce lot, exécutée parce que Docker
  s'est trouvé disponible ce soir.

## Fichiers créés

- `supabase/migrations/20260905110000_add_flash_proposal_idempotency.sql` —
  ajoute `flash_infos.idempotency_key_hash` (contrainte CHECK sha256 hex,
  index unique `(institution_id, idempotency_key_hash)`), même motif que
  `support_requests.idempotency_key_hash`. Le socle du LOT 1 ne prévoyait pas
  l'idempotence, qui est un besoin de route et non du socle : ajout jugé dans
  le périmètre de ce lot plutôt qu'une réécriture du LOT 1.
- `db/schema.ts` — miroir Drizzle de la colonne et de l'index ci-dessus sur
  `flashInfos`.
- `shared/flash-proposal-input.ts` — validation pure de l'entrée d'une
  proposition (titre, texte, importance, canaux, audience, expiration).
  Réutilise `FLASH_IMPORTANCE_LEVELS` (flash-version-diff) et
  `FLASH_NOTIFICATION_CHANNELS` / `parseFlashGroupRef`
  (flash-audience-correction) plutôt que de les redéfinir. La seule logique
  ajoutée ici — la combinaison canaux valides par importance — n'existait dans
  aucun module pur : elle reprend exactement la contrainte CHECK SQL de
  `flash_info_versions.channels`, revérifiée en base par la même contrainte
  (double filet, pas une redéfinition divergente).
- `api/_shared/flash-idempotency.ts` — `flashIdempotencyKey` /
  `flashIdempotencyHash`, même motif que `idempotencyKey`/`sha256` dans
  `api/_shared/support.ts`, dupliqué plutôt qu'importé pour ne pas coupler le
  domaine flash au domaine support.
- `api/_shared/flash-response.ts` — `toFlashVersionPayload`, construit la
  charge de réponse et la fait passer par
  `isValidFlashInfoVersionPayload` (LOT 1) avant de répondre. Partagé par les
  deux routes.
- `api/flash/proposals/index.ts` — `POST /api/flash/proposals`. Auteur pris de
  `requireFlashActor(req)` (session), jamais du corps. Idempotence par
  `Idempotency-Key` (en-tête, jamais le corps). Transaction unique : ligne
  `flash_infos`, version 1, lignes d'audience, événement
  `flash_info.proposed`. Un `INSERT ... ON CONFLICT DO NOTHING` suivi d'une
  relecture gère le double envoi, même motif que
  `api/support/requests/index.ts`. Une violation de contrainte CHECK
  (SQLSTATE `23514`) est traduite en 400 lisible plutôt que remontée brute.
- `api/flash/proposals/mine.ts` — `GET /api/flash/proposals/mine`. Liste les
  informations flash dont `created_by` est l'acteur connecté, avec l'état de
  leur version courante (`flash_info_versions.version =
  flash_infos.current_version`). Limite bornée (200) avec 409 explicite au
  lieu d'une liste tronquée silencieuse, même motif que
  `SUPPORT_PUBLIC_LIST_LIMITS`.
- `scripts/test-flash-proposal-input.mjs` — 17 tests de
  `shared/flash-proposal-input.ts` (bornes de titre/texte, canaux valides par
  importance, canaux dupliqués, audience vide ou dupliquée, expiration
  obligatoire et future, champ inconnu refusé, corps non-objet refusé).

## Décisions prises dans ce lot

- **Qui peut proposer** : toute personne acceptée par `requireFlashActor`
  (mêmes rôles que le LOT 1 : superadmin, administration, agent, proviseur,
  professeur), sans restriction de service supplémentaire à la proposition —
  seule la validation est réservée au référent numérique ou à la DDFPT (§13,
  `shared/flash-validation-access.ts`). Ce point était explicitement laissé
  ouvert par le compte rendu du LOT 1 ; il est tranché ici.
- **Audience obligatoire dès la proposition** : `groupRefs` non vide est exigé
  à la création, pas seulement à la validation, pour que `flash_info_audiences`
  existe dès la version 1 (nécessaire aux calculs du LOT 4).
- **Contacts SMS** non stockés à ce stade : `flash_notification_dispatches`
  (table de trace de diffusion réelle, `contact_ref` pour le SMS) n'a de sens
  qu'au moment de la diffusion, hors périmètre de ce lot (aucune notification
  n'est envoyée avant validation, §13/T071C). L'écran `FlashProposalPage.tsx`
  collecte déjà des contacts SMS fictifs en LOT 6 ; ce lot ne les persiste
  pas encore.

## Ce qui reste supposé, pas prouvé

- Aucun test de bout en bout via une vraie requête HTTP `POST
  /api/flash/proposals` (serveur Vercel dev ou équivalent) : la preuve
  ci-dessus est au niveau SQL direct, pas au niveau de la route Node.
  `requireFlashActor` reste non testé directement pour la même raison qu'au
  LOT 1 (pas de JWT Supabase réel émis ce soir).
- La politique exacte de qui peut proposer (ci-dessus) est une décision prise
  ce soir, pas confirmée par Adel.
- Concurrence, RLS multi-établissement, et le cas des deux enfants d'un même
  parent restent hors preuve de ce lot : explicitement réservés au LOT 7.
- `test:preview-security-gate` ne connaît toujours pas le domaine flash (choix
  du LOT 1, non révisé ici).

## Commit

Un commit local sur `codex/lycee-connect-prototype`, aucun push.
