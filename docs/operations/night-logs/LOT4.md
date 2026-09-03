# LOT 4 — Tout ce qui est mécanique et sûr, fait maintenant

Date : 2026-09-03 (nuit), branche `codex/lycee-connect-prototype`.
Aucune action distante. Rien poussé. Rien publié. Aucun drapeau activé.

## Résultat en un mot

**Quatre contrôles rejoués, aucune anomalie certaine trouvée, donc aucune
correction appliquée.** Le lot ne modifie aucun fichier de code : les
contrôles mécaniques disponibles ce soir (redirections, liens internes,
audit statique de la CSS responsive) sont tous au vert. Le contrôle
responsive complet demandé par le plan (rendu réel dans un navigateur à
320/390/1440 px avec capture des erreurs console) **n'a pas pu être exécuté
cette nuit** : aucun outil de pilotage de navigateur (Playwright, Puppeteer)
n'est installé dans ce dépôt, et en installer un maintenant (téléchargement
de binaires navigateur) sort du périmètre « mécanique et sûr, fait
maintenant ». C'est noté explicitement en **À FAIRE PAR LE PROPRIÉTAIRE** /
outillage supplémentaire, pas caché ni simulé.

## 1. Rejeu du contrôle des 27 redirections contre l'inventaire

```
npm run test:legacy-routes    → 2/2 tests passés
npm run test:legacy-coverage  → 4/4 tests passés
```

Mêmes suites que le LOT 3, rejouées indépendamment ce soir pour ce lot :
elles comparent `vercel.json` (27 redirections permanentes vers
`/site/<slug>`, hors `accueil-historique`) à
`content/legacy-site/inventory.json` (28 contenus) et à
`coverage-baseline.md`. Lecture directe de `vercel.json` confirmée :
exactement 27 règles `/<slug> → /site/<slug>` + 1 règle non comptée
`/category/:path* → /?view=news`. **PROUVÉ** : cohérence interne du dépôt.
Aucune vérification en ligne (aucune action distante autorisée).

## 2. Contrôle des liens internes des brouillons repris

`npm run test:legacy-links` (1/1, test unitaire sur données synthétiques du
réécrivain de liens) a été rejoué, puis complété par un audit mécanique
direct des 28 corps de texte réels dans
`content/legacy-site/inventory.json` (pas seulement le fixture du test) :
extraction de tous les liens Markdown (`](...)`, 129 liens sur les 28
contenus) et vérification que :
- chaque lien `/site/<slug>` cible un slug qui existe réellement parmi les
  28 contenus repris ;
- aucun lien absolu vers `lycee-blaise-cendrars-sevran.fr` ne subsiste pour
  une page qui a un équivalent repris (donc aurait dû être réécrit).

Résultat :
- 30 liens internes `/site/...` trouvés, **0 cible inconnue** (`brokenSite:
  0`) ;
- 7 liens absolus vers `lycee-blaise-cendrars-sevran.fr/category/...`
  subsistent (`accueil-historique` ×2, `cdi` ×2, `vie-du-lycee` ×3) — **ce
  n'est pas une anomalie** : ce sont des rubriques WordPress sans page de
  destination reprise, et le réécrivain de liens (`export-legacy-wordpress.mjs`,
  couvert par `test:legacy-links`) est explicitement conçu pour les laisser
  intactes plutôt que de créer un lien mort vers une page inexistante ;
- `unrewrittenOther: 0` — aucun lien WordPress absolu vers une page qui *a*
  un équivalent repris n'a été oublié par la réécriture.

**PROUVÉ** : aucun lien interne cassé parmi les 28 brouillons repris.
Aucune correction nécessaire sur ce point.

## 3. Contrôle responsive 320 / 390 / 1 440 px des pages publiques

Pages visées par le plan : accueil, À la une, Vie du lycée, page éditoriale,
Services, Aide, Suivi, Confidentialité (toutes portées par
`src/pages/prototype/LyceeConnectPrototype.tsx` +
`src/pages/prototype/PublicContentPage.tsx`, application une page).

Deux niveaux de preuve, à ne pas confondre :

**a) PROUVÉ — contrat automatisé existant, rejoué ce soir :**
```
npm run test:prototype-responsive-contract → 4/4 tests passés
```
Ce test vérifie statiquement, sur `lycee-connect.css` et
`LyceeConnectPrototype.tsx` : la présence d'un point de rupture à 390 px, le
passage en une colonne des grilles d'outils/services à 390 px, l'absence de
piste large fixe (`min-width` ≥ 400 px) dans ce bloc, et une hauteur minimale
de 40 px pour toutes les cibles tactiles secondaires (boutons de section, de
formulaire, de la grille de services, du panneau appareil, etc.).

**b) PROUVÉ — audit statique complémentaire fait ce soir**, portant sur
l'ensemble de `lycee-connect.css` (1337 lignes), pas seulement les sélecteurs
déjà couverts par le test :
- recherche de toute déclaration `min-width` en dur : 5 occurrences
  trouvées (210 px, 24 px, 19 px, 190 px, 160 px) — toutes trop petites pour
  provoquer un débordement à 320 px, et la seule proche (`.lycee-submit-request`,
  210 px) est neutralisée par une règle `@media (max-width: 720px)` qui la
  passe en `width: 100%` avant même d'atteindre 390 px ;
- recherche de toute déclaration `width`/`min-width` fixe ≥ 330 px hors
  `max-width` : aucune trouvée en dehors des `max-width` (qui sont des
  plafonds, pas des planchers, donc sans risque de débordement) ;
- aucune règle `overflow-x` défensive présente, cohérent avec l'absence de
  piste large détectée.

**c) NON FAIT cette nuit — rendu réel dans un navigateur.** Aucun outil de
pilotage de navigateur (Playwright, Puppeteer, etc.) n'est présent dans
`package.json` ni dans `node_modules`. Le plan demande un contrôle « aucun
débordement, aucune erreur console » sur 8 pages × 3 largeurs, ce qui suppose
un rendu réel — l'audit statique ci-dessus donne une forte présomption
d'absence de débordement mais **ne prouve ni le rendu réel ni l'absence
d'erreur console**. Installer un navigateur headless cette nuit (téléchargement
de binaires, dizaines à centaines de Mo) sort du périmètre « mécanique et
sûr » du lot et n'a pas été fait. **À FAIRE PAR LE PROPRIÉTAIRE** (ou lot
outillé séparément) : contrôle visuel réel des 8 pages aux 3 largeurs avec
capture de la console, par exemple via Playwright une fois ajouté au projet.

## 4. Corrections appliquées

**Aucune.** Les trois contrôles ci-dessus n'ont révélé aucune anomalie
certaine et non éditoriale à corriger : 0 redirection manquante, 0 lien
interne cassé, 0 risque de débordement détecté par analyse statique. Le plan
demande de ne corriger que ce qui est certain — il n'y avait rien de tel à
corriger ce soir. Aucun fichier de code n'a donc été modifié dans ce lot.

## Distinction PROUVÉ / SUPPOSÉ / À FAIRE PAR LE PROPRIÉTAIRE

- **PROUVÉ** : cohérence des 27 redirections avec l'inventaire (6/6 tests
  automatisés) ; 0 lien interne cassé sur les 129 liens des 28 brouillons
  réels ; contrat responsive automatisé au vert (4/4) ; audit statique
  complémentaire de la CSS sans risque de débordement détecté à 320/390/1440 px.
- **SUPPOSÉ** : l'absence de débordement réel et l'absence d'erreur console
  dans un navigateur — présumées par l'audit statique, non observées
  directement.
- **À FAIRE PAR LE PROPRIÉTAIRE** : contrôle visuel réel (navigateur) des 8
  pages publiques aux largeurs 320/390/1440 px, avec capture des erreurs
  console, une fois un outil de rendu (ex. Playwright) disponible dans
  l'environnement.

## Commandes exécutées ce soir pour ce lot

```
npm run test:legacy-routes
npm run test:legacy-coverage
npm run test:legacy-links
npm run test:prototype-responsive-contract
```

Plus un audit ad hoc en Node (lecture seule) sur
`content/legacy-site/inventory.json` pour l'extraction et la vérification
des liens internes des 28 brouillons, et une lecture directe de
`vercel.json` et de `src/pages/prototype/lycee-connect.css`.
