# LOT 2 — Route publique et affichage

5 septembre 2026. Plan : `docs/operations/PLAN_FLASH_PUBLIC_2026-09-05.md`.
Session unique, LOT 2 seulement, à la suite du LOT 1 (`shared/flash-visibility.ts`,
compte rendu `PUBLIC-LOT1.md`).

## Décision prise ce lot, à confirmer avec Adel

Le LOT 1 laissait ouverte la question de `FLASH_PUBLIC_AUDIENCE_GROUP_REF =
"public:site"` : une convention inventée dans ce lot, pas actée ailleurs. Ce
LOT 2 la confirme par l'usage — la route publique n'affiche que les versions
dont l'audience contient exactement cette valeur — mais **ce n'est toujours
qu'un choix technique posé ici**, jamais validé par un humain habilité. Si
Adel choisit une autre convention pour désigner l'audience publique, il
faudra changer `FLASH_PUBLIC_AUDIENCE_GROUP_REF` (un seul endroit,
`shared/flash-visibility.ts`) et rien d'autre dans ce lot n'a besoin de
changer.

Autre choix pris ici, pas explicite dans le plan : le champ `id` renvoyé au
public est celui de la **version** (`flash_info_versions.id`), jamais celui
de la proposition (`flash_infos.id`). Le plan interdit d'exposer un
« identifiant de proposition » ; exposer l'id de version permet quand même à
l'écran de garder une clé stable par élément affiché.

## Ce qui a été fait

- `shared/flash-public-feed.ts` : module pur, tri (importance décroissante
  puis date de publication décroissante) et bornage (`FLASH_PUBLIC_FEED_LIMIT
  = 20`) du flux public. Réutilise l'ordre déjà défini par
  `FLASH_IMPORTANCE_LEVELS` (`shared/flash-version-diff.ts`) au lieu d'en
  redéfinir un second. Ne revérifie jamais la visibilité elle-même (LOT 1) :
  il suppose une liste déjà filtrée visible.
- `shared/flash-payload-policy.ts` : nouveau contrat étroit
  `isValidFlashPublicItemPayload` / `FlashPublicItemPayload` — six champs
  seulement (`id`, `title`, `bodyMarkdown`, `importance`, `publishedAt`,
  `expiresAt`), volontairement plus restreint que le contrat interne déjà en
  place (`FLASH_VERSION_PAYLOAD_FIELDS`). Aucun auteur, aucun valideur,
  aucune audience brute, aucun identifiant de proposition.
- `api/_shared/flash-response.ts` : `toPublicFlashItemPayload`, même garde
  que les autres constructeurs de charge du fichier — une route ne peut pas
  répondre un objet qui ne passe pas ce contrat.
- `api/content/flash/public.ts` (`GET`, route anonyme, aucun `requireFlashActor`) :
  - filtre SQL sur `status = 'publiee'` et `expires_at > now()` (borne de
    performance, même esprit que `api/content/public.ts`) ;
  - jointure à plat (jamais de sous-requête corrélée — piège déjà payé) sur
    la seule ligne d'audience publique de la version, ce qui évite une
    seconde requête d'audience ;
  - la décision de visibilité définitive repasse par
    `selectVisibleFlashVersions` (LOT 1), pas réimplémentée ici ;
  - tri et bornage par `selectFlashPublicFeedPage` (ce lot) ;
  - chaque élément repasse par `toPublicFlashItemPayload` avant de partir.
  - **Aucun filtre par établissement** : comme `api/content/public.ts`, ce
    prototype sert un seul établissement (voir `siteContentItems`, sans
    colonne `institution_id`) — choix cohérent avec l'existant, pas une
    régression introduite ici.
- Affichage : `src/components/FlashPublicBulletin.tsx` (bandeau sobre,
  rendu Markdown réutilisé via `PublicContentMarkdown`, rien ne s'affiche
  si la liste est vide) et `src/pages/prototype/flash-public-client.ts`
  (validation stricte côté client de la réponse, même schéma que le contrat
  serveur, même méthode que `public-content-client.ts`). Branché dans
  `LyceeConnectPrototype.tsx` juste sous le bandeau de service, visible sur
  toutes les vues publiques sauf `agent` (espace professionnel).
- CSS : `src/pages/prototype/lycee-connect.css`, classes `.lycee-flash-*`,
  une teinte par niveau d'importance (`normale`/`importante`/`urgente`),
  un ajustement de padding à 720 px.

## Preuves réellement exécutées

- `npm run test:flash-payload-policy` → 27/27 (dont les 6 nouveaux tests du
  contrat public).
- `npm run test:flash-public-feed` (nouveau) → 5/5.
- `npm run test:flash-public-route` (nouveau, preuve de wiring par lecture de
  la source de la route — pas d'appel HTTP réel) → 7/7.
- `npm run test:flash` (agrégat, inclut maintenant les deux scripts
  ci-dessus) → vert.
- `node node_modules/typescript/bin/tsc --noEmit` → aucune erreur.
- `npm run build` (`vite build`, a fonctionné dans ce shell ce soir,
  contrairement à l'avertissement de `CLAUDE.md`) → succès, `dist/` produit.
- `npm run test:preview-security-gate` → intégralement vert, code de sortie
  0, aucun `fail` différent de 0 dans la sortie complète.

## Ce qui reste supposé, pas prouvé

- **Aucune preuve PostgreSQL réelle.** La jointure Drizzle
  (`flashInfoAudiences` filtrée sur `groupRef = "public:site"`, `status =
  'publiee'`, `expiresAt > now()`) n'a jamais tourné contre une base
  réelle : ni la forme du SQL généré, ni la présence effective de
  `flashInfoVersions.status`/`expiresAt` en colonnes exploitables par
  l'index `flash_info_versions_scope_status_idx` n'ont été vérifiées à
  l'exécution. C'est le rôle du LOT 6.
- **Aucune preuve navigateur.** Le rendu à 320 px / 1440 px du bandeau n'a
  été ni ouvert dans un navigateur ni capturé — seul le CSS a été écrit et
  relu. Le LOT 6 prévoit une recette navigateur explicite ; ce lot ne
  l'anticipe pas.
- **La convention `public:site` n'a toujours pas d'origine validée par
  Adel.** Voir la décision en tête de ce document. Rien dans
  `FlashProposalPage.tsx` ne permet aujourd'hui à un auteur de choisir
  cette audience à la proposition — un flash ne peut donc, pour l'instant,
  devenir visible sur la route publique qu'en insérant la ligne
  `flash_info_audiences` correspondante par un autre moyen que l'écran
  existant. Câbler ce choix côté écran de proposition n'est pas dans le
  périmètre du LOT 2 tel qu'écrit dans le plan.
- **Le flux public n'est jamais purgé de son propre statut.** Une version
  `publiee` qui expire reste `publiee` en base (le cron
  `api/cron/flash-expiry.ts` ne traite que `proposee` et `validee`) ; seule
  la borne `expires_at > now()` de cette route l'exclut de l'affichage. Le
  comportement observable est correct (elle disparaît bien), mais la ligne
  ne change jamais de statut — cohérent avec ce qui existait déjà, pas une
  nouveauté de ce lot, à garder en tête pour le LOT 6 et au-delà.

## Portée strictement respectée

Rien d'autre que le LOT 2 n'a été touché : aucune écriture de
`flash_notification_dispatches` (LOT 3), aucune file durable (LOT 4), aucun
changement à la porte de l'écran de validation (LOT 5). Aucun drapeau
ouvert, aucun envoi, aucune donnée réelle, aucun `git push`.
