# LOT 6 — Recette (2026-09-05)

Périmètre strict : `docs/operations/PLAN_FLASH_PUBLIC_2026-09-05.md`, LOT 6
uniquement. Personnes, établissements et comptes entièrement fictifs. Aucun
drapeau ouvert, aucun envoi réel, aucune donnée réelle, aucune commande
`--linked`/`db push`/URL distante. `CLAUDE.md` appliqué intégralement.

## Pile locale et rejeu des migrations

- Docker Desktop était arrêté au début de cette session (`docker info` en
  échec, `dockerDesktopLinuxEngine` introuvable — même constat que
  `PUBLIC-LOT5.md`). Démarré réellement pendant cette session
  (`Docker Desktop.exe`, attente active jusqu'à ce que `docker info`
  réponde) ; les conteneurs `supabase_*_lyceegest-prototype` d'une session
  antérieure sont remontés automatiquement à ce démarrage.
- `npx supabase db reset` a rejoué les **102 migrations depuis zéro** sur ce
  Postgres jetable local (`127.0.0.1:54322`), sans erreur, y compris les
  migrations flash les plus récentes
  (`20260905150000_add_flash_notification_dispatch_simulation.sql`,
  `20260905160000_add_flash_communication_bridge_source_type.sql`).
  `npm run test:preview-security-gate` → `test:migration-integrity` confirme
  ensuite `102` migrations, `102` versions uniques.

## Ce qui a été fait

- `scripts/test-local-flash-public-recette.mjs` (nouveau) : recette
  PostgreSQL réelle, appelle les VRAIS handlers HTTP
  (`api/flash/proposals/index.ts`, `.../decision.ts`, `.../publication.ts`,
  `.../correction.ts`, `api/content/flash/public.ts`,
  `api/flash/validation/screen-access.ts`) avec un `req`/`res` minimal et des
  jetons réellement émis par le GoTrue local (`admin.createUser` +
  `signInWithPassword`), jamais un JWT fabriqué à la main. Aucune règle
  métier réimplémentée : les modules purs déjà écrits et testés
  (`flash-visibility.ts`, `flash-transitions.ts`, `flash-dispatch-plan.ts`,
  `flash-validation-access.ts`) restent ceux importés par les routes
  elles-mêmes.
- `scripts/test-flash-public-browser-recette.mjs` (nouveau) : recette
  navigateur réelle (Chromium local via Playwright), même famille que
  `scripts/test-flash-browser-recette.mjs` (LOT 8 du plan de persistance)
  mais pour la page publique (`/`), anonyme — aucune session/MFA nécessaire.
  Publie une flash publique fictive réelle via les vrais handlers avant
  d'ouvrir le navigateur, sert `GET /api/content/flash/public` par un petit
  serveur HTTP local qui invoque directement le vrai handler, capture les
  trois largeurs demandées par le plan (320, 390, 1440 px) dans
  `.vercel/flash-recette/public-{largeur}.png`.
- `package.json` : deux nouvelles entrées `recipe:local-flash-public` et
  `recipe:local-flash-public-browser`, même convention de nommage que les
  recettes locales déjà en place (`recipe:local-flash-publication`,
  `recipe:local-flash-publication-browser`). Ni l'une ni l'autre n'entre dans
  un agrégat `test:*` lancé en CI : elles exigent la pile Supabase locale et
  ne doivent jamais tourner ailleurs.

## Résultat, scénario par scénario (les 7 demandés par le plan)

Commande : `npm run recipe:local-flash-public` (23 assertions, toutes
passées).

1. **Publier une flash publique → apparaît sur la route publique.** Prouvé
   par la vraie route anonyme `GET /api/content/flash/public` : une version
   publiée avec l'audience `public:site` apparaît, avec le bon titre.
2. **Publier une flash ciblée → absente pour un anonyme, présente pour un
   membre.** Le volet anonyme est prouvé par la même vraie route (absente,
   pendant que la flash publique du scénario 1 reste visible à côté). Le
   volet « présente pour un membre » **n'a pu être prouvé qu'au niveau
   module** (`shared/flash-visibility.ts`), avec l'audience réellement lue
   en base pour cette version (jamais fabriquée) : **aucune route
   authentifiée ne sert encore ce fil à une personne identifiée** — seule la
   route anonyme du LOT 2 existe. `PUBLIC-LOT2.md` avait déjà noté ce manque
   ("le rapprochement entre viewerGroupRefs... n'existe pas encore, c'est un
   travail de LOT 2 ou d'un module dédié"), jamais comblé depuis. Ce n'est
   donc pas une preuve HTTP bout-en-bout pour ce second volet.
3. **Attendre l'expiration → elle disparaît, sans intervention.** Prouvé
   avec un délai réel (publication avec échéance à 4 s, attente réelle de
   4,5 s, pas de mutation manuelle ni de cron appelé entre-temps) : visible
   juste après publication, absente de la route publique une fois
   l'échéance dépassée. Vérifié en base que le statut reste `publiee` — seul
   le filtre `expires_at > now()` de la route l'exclut, exactement comme
   documenté dans `api/content/flash/public.ts`.
4. **Corriger une publiée → la route publique sert la version corrigée.**
   **Ce scénario échoue par rapport à l'attendu littéral du plan**, prouvé
   par la vraie route de correction puis la vraie route publique : corriger
   une version `publiee` la fait passer à `modifiee` (`flash-transitions.ts`
   n'autorise que `publiee -> modifiee`, transition terminale). Or
   `api/content/flash/public.ts` ne sert que `status = 'publiee'`. Résultat
   réellement observé : **la flash disparaît purement et simplement de la
   route publique après correction**, elle ne réapparaît jamais avec son
   contenu corrigé. Le même filtre existe côté admin
   (`api/flash/validation/published.ts`), donc ce n'est pas un défaut de la
   route publique elle-même : c'est qu'**aucune route ne fait jamais
   repasser une version `modifiee` vers `publiee`**. Voir « Ce qui reste
   supposé » ci-dessous.
5. **Publier une importante → lignes d'envoi `simulated`, aucune requête
   vers un fournisseur.** Prouvé : toutes les lignes
   `flash_notification_dispatches` de la version sont à l'état `simulated`
   (aucune `sent`), et l'événement `flash_info.published` en base confirme
   `communicationBridgeEnqueued = false`,
   `communicationBridgeReason = 'module_disabled'` — la file durable du
   centre de communication (spec 005) reste inerte, aucune requête ne peut
   être partie vers un fournisseur.
6. **Rejouer la publication → aucune ligne d'envoi en double.** Prouvé :
   rejouer `POST .../publication` répond `200`/`alreadyPublished=true` sans
   réexécuter l'écriture des lignes d'envoi (la route sort tôt sur le statut
   déjà `publiee`) ; nombre de lignes `flash_notification_dispatches`
   identique avant/après.
7. **Un compte sans le service → écran refusé.** Prouvé par la vraie route
   `GET /api/flash/validation/screen-access` (T071E) : un compte
   `administration` sans le service `referent_numerique`/`ddfpt` reçoit
   `{ allowed: false, grantedByService: null }` ; le même compte avec le
   service reçoit `{ allowed: true, grantedByService: "referent_numerique" }`.
   C'est la preuve PostgreSQL réelle que `PUBLIC-LOT5.md` notait manquante
   (« Docker Desktop reste indisponible... aucune pile Supabase locale n'a
   tourné pour fabriquer un tel compte et l'essayer réellement »).

## Recette navigateur (site public)

Commande : `npm run recipe:local-flash-public-browser`. Chromium local
(Playwright), page publique (`/`) uniquement — aucune authentification,
comme le veut la route. Une flash publique fictive réelle publiée avant
l'ouverture du navigateur, servie par le vrai handler
`api/content/flash/public.ts` derrière un petit serveur HTTP local.

| Largeur | Débordement horizontal | Erreurs console | Bandeau affiché |
|---|---|---|---|
| 320 px | 0 | aucune | oui |
| 390 px | 0 | aucune | oui |
| 1440 px | 0 | aucune | oui |

Captures : `.vercel/flash-recette/public-320.png`,
`.vercel/flash-recette/public-390.png`,
`.vercel/flash-recette/public-1440.png` (dossier déjà utilisé par les LOT 4
et LOT 8 du plan de persistance flash, fichiers distincts, aucune
collision). `.vercel/` n'est pas suivi par git.

## Non-régression

- `npm run build` (`tsc --noEmit` puis `vite build`) → les deux réussis dans
  ce shell aujourd'hui.
- `npm run test:preview-security-gate` → code de sortie `0`, sortie complète
  relue (`grep` sur `fail [1-9]`/`not ok`/`AssertionError` : aucune
  occurrence).
- `npm run test:flash-recette` → intégralement vert, aucune régression sur
  les scripts déjà en place.
- `npm run test:spec-integrity` → vert, `634` tâches, `5` specs, aucun
  changement de compte (ce lot ne coche aucune tâche : la clôture de
  `tasks.md` revient au LOT 7 de ce plan, pas à celui-ci).

## Ce qui reste supposé, pas prouvé

- **Le scénario 4 du plan (« corriger une publiée : la route publique sert
  la version corrigée ») ne se produit pas dans l'implémentation actuelle.**
  C'est la découverte principale de ce lot, pas une preuve manquante : la
  transition `publiee -> modifiee` est terminale et aucune route ne fait
  jamais repasser une version `modifiee` vers `publiee`. Concrètement, sur
  le circuit actuel, corriger une information flash déjà publique la
  **retire** du site public au lieu de la corriger dessus. Ce point est
  cousin du trou déjà documenté dans `CLAUDE.md` pour le domaine
  « informations flash — persistance » (aucune route `validee -> publiee`)
  — ici c'est un cran plus loin dans le même circuit (`publiee -> modifiee`
  sans retour). **À trancher avec Adel avant tout nouveau lot qui toucherait
  la correction post-publication** : soit une nouvelle transition légale
  (`modifiee -> publiee`, geste humain distinct comme l'a été T071F pour
  `validee -> publiee`), soit une redéfinition du sens de « corriger » sur
  ce domaine.
- **Le volet « présente pour un membre » du scénario 2 n'est pas une preuve
  HTTP bout-en-bout.** Prouvé uniquement au niveau module
  (`shared/flash-visibility.ts`) avec une audience réellement lue en base,
  faute de toute route authentifiée servant le fil flash à une personne
  identifiée. Si un tel écran est construit un jour, sa recette devra
  reprendre ce scénario avec une vraie requête HTTP authentifiée.
- **Preuve locale, pas recette distante** (rappel explicite du plan) : tout
  ce qui précède tourne sur `127.0.0.1:54322`/`54321`, jamais sur un projet
  Supabase distant, jamais sur `xijocumlwivhbmffrnlj` (le projet lié visible
  dans `npx supabase status`, non touché).
- **La pile Supabase locale est restée démarrée** à la fin de cette session
  (conteneurs `supabase_*_lyceegest-prototype`), avec uniquement les
  fixtures fictives de ce lot et des lots précédents. Arrêt :
  `npx supabase stop` (ou `db reset` pour repartir propre avant le prochain
  lot).
- **Nettoyage partiel, volontaire, même limite que les lots précédents** :
  `flash_info_events` est append-only par trigger et les FK `RESTRICT` sur
  `flash_correction_decisions`/`flash_info_versions` interdisent la
  suppression des comptes une fois qu'une décision existe. Comptes
  `auth.users` fictifs supprimés quand possible en fin de script ;
  établissement et informations flash fictifs laissés en place, purgés
  seulement par un futur `supabase db reset`/`stop`.

## Portée strictement respectée

Rien d'autre que le LOT 6 n'a été touché : aucune modification de route ou
de module métier flash, aucune case cochée dans
`specs/002-agent-etablissement-adaptatif/tasks.md` (la clôture, y compris la
décision de cocher ou non T071E selon la découverte du scénario 4, revient
au LOT 7 de ce plan). Aucun drapeau ouvert, aucun envoi réel, aucune donnée
réelle, aucun `git push`.

## Fichiers ajoutés

- `scripts/test-local-flash-public-recette.mjs`
- `scripts/test-flash-public-browser-recette.mjs`

## Fichiers modifiés

- `package.json` (deux entrées `recipe:local-flash-public*`)
