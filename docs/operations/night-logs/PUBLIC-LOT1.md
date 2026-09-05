# LOT 1 — Règle de visibilité, pure et testée

5 septembre 2026. Plan : `docs/operations/PLAN_FLASH_PUBLIC_2026-09-05.md`.
Session unique, LOT 1 seulement.

## Ce qui a été fait

- `shared/flash-visibility.ts` : module pur, sans base ni réseau.
  - `checkFlashVersionVisibility` / `isFlashVersionVisible` : une version n'est
    visible que si (1) `status === "publiee"`, (2) `now < expiresAt` (expiré
    à la seconde près, borne stricte), (3) l'audience autorise le visiteur.
  - `selectVisibleFlashVersions` : filtre une liste de versions (tous états)
    pour un visiteur donné — sert à prouver qu'une version corrigée
    (`modifiee`) ne réapparaît jamais une fois remplacée par la nouvelle
    version `publiee`.
  - `FLASH_PUBLIC_AUDIENCE_GROUP_REF = "public:site"` : seule valeur de
    `group_ref` qui ouvre l'affichage à un visiteur anonyme.
- `scripts/test-flash-visibility.mjs` : 11 tests (`node:test`), couvrant
  exactement les six scénarios demandés par le plan, plus les entrées
  invalides (statut inconnu, dates invalides, audience vide, group_ref
  invalide) :
  1. publiée et non expirée → visible pour un anonyme.
  2. publiée et expirée à la seconde (`now === expiresAt`) → non visible ;
     vérifié aussi une seconde avant (visible) et une seconde après (non
     visible).
  3. validée mais jamais publiée → non visible.
  4. audience ciblée (`classe:2nde4`) vue par un anonyme → non visible.
  5. la même audience vue par un membre identifié du groupe → visible (et,
     en plus, une personne identifiée hors du groupe ciblé ne voit pas non
     plus).
  6. version corrigée (`publiee`) et version d'origine (`modifiee`) : seule
     la version courante est retenue par `selectVisibleFlashVersions`,
     l'ancienne reste non visible même si son audience et son expiration
     restent par ailleurs valides.
- `package.json` : nouveau script `test:flash-visibility`, ajouté à
  l'agrégat `test:flash`.

## Preuves réellement exécutées

- `npm run test:flash-visibility` → 11/11 tests passés.
- `npm run test:preview-security-gate` → intégralement vert (aucun `fail`
  différent de 0 dans la sortie complète).
- `npm run build` (`tsc --noEmit && vite build`) → succès, build produit dans
  `dist/`.

Aucune de ces preuves n'est une recette PostgreSQL réelle ni une recette
navigateur : ce sont des exécutions locales de tests purs et de compilation,
rien de plus, conformément à CLAUDE.md.

## Ce qui reste supposé, pas prouvé

- **`FLASH_PUBLIC_AUDIENCE_GROUP_REF = "public:site"` est une décision prise
  dans ce lot, pas une convention déjà actée ailleurs.** Rien dans la
  fondation flash (migration `20260905013000_create_flash_info_foundation.sql`)
  ni dans `shared/flash-audience-correction.ts` ne réserve de valeur
  particulière à `group_ref` pour désigner le public. Le LOT 2 (route
  publique) devra soit confirmer ce choix avec Adel, soit l'ajuster — et
  adapter les groupes réellement utilisés côté proposition
  (`FlashProposalPage`) en conséquence.
- Le rapprochement entre `viewerGroupRefs` (les appartenances d'une personne
  identifiée) et une source réelle (fiche élève/professeur, classe, etc.)
  n'existe pas encore : ce module reçoit ces groupes déjà résolus, il ne les
  calcule pas. C'est un travail de LOT 2 ou d'un module dédié, pas de celui-ci.
- La note du plan « horloge serveur Europe/Paris » n'entraîne aucune logique
  de fuseau horaire dans ce module : comme `flash-expiration.ts` déjà en
  place, la comparaison se fait sur deux instants (`Date`) absolus. La
  résolution du fuseau reste, par hypothèse, à la charge de qui produit `now`
  (cron, route), pas de ce module pur.
- Aucune ligne de base, aucune migration, aucun appel réseau : conforme au
  périmètre du LOT 1 (« sans base ni réseau »). Le LOT 2 reste entièrement à
  faire.

## Portée strictement respectée

Rien d'autre que le LOT 1 n'a été touché : aucune route, aucun composant,
aucune migration. Aucun drapeau ouvert, aucun envoi, aucune donnée réelle.
