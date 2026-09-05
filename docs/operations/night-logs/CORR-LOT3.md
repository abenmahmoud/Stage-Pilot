# LOT 3 — Choisir l'audience publique depuis l'écran

Plan : `docs/operations/PLAN_FLASH_CORRECTION_VISIBLE_2026-09-05.md`, LOT 3.

## Ce qui était vrai avant ce lot

`FLASH_PUBLIC_AUDIENCE_GROUP_REF = "public:site"` (`shared/flash-visibility.ts`)
est la seule valeur de `group_ref` qui rend une version visible sur la route
publique (`api/content/flash/public.ts`). Aucun écran ne permettait de la
choisir : l'écran de proposition (`src/pages/admin/FlashProposalPage.tsx`)
n'offrait que les six groupes fictifs de `FICTITIOUS_FLASH_GROUPS`
(classes, niveau, personnel, parents). Une flash ne pouvait donc jamais
atteindre le public anonyme par un usage normal de l'interface — seul un
appel direct à l'API ou une valeur insérée en base l'aurait permis.

## Ce qui a été fait

Dans `src/pages/admin/FlashProposalPage.tsx`, carte « Public visé » :

- Ajout d'une case à cocher distincte des six groupes fictifs, au-dessus de
  la grille, avec le libellé explicite « Visible par tous sur le site » et
  une phrase qui dit ce qu'elle fait (« publie l'information sur la page
  publique du site, sans compte ni connexion ») et ce qui la distingue des
  groupes en dessous (« restent un public fictif »). Aucun code technique
  (`public:site`) n'apparaît à l'écran.
- La case est branchée sur le même état et le même mécanisme que les groupes
  fictifs (`selectedGroups`, `toggleGroup`), en import direct de la constante
  `FLASH_PUBLIC_AUDIENCE_GROUP_REF` depuis `shared/flash-visibility.ts` —
  aucune valeur recopiée à la main, aucune règle réécrite. Cocher cette case
  ajoute `"public:site"` à `groupRefs` envoyé à `POST /api/flash/proposals`,
  qui passe déjà par `parseFlashGroupRef` côté serveur (`shared/flash-proposal-input.ts`) :
  aucun changement de contrat, aucune règle de validation nouvelle.

Étendue volontairement limitée à l'écran de proposition, comme demandé par
le plan (« à l'écran de proposition »). L'écran de correction
(`FlashValidationPage.tsx`) réutilise la même liste `FICTITIOUS_FLASH_GROUPS`
pour choisir le public d'une correction, mais n'a pas reçu cette case : ce
n'est pas dans le périmètre de ce lot, à trancher séparément si une
correction doit pouvoir, elle aussi, viser le public anonyme.

## Preuves réellement exécutées

- `node node_modules/typescript/bin/tsc --noEmit` : aucune erreur.
- `npm run test:flash-proposal-page` : 10/10, dont un nouveau test qui
  vérifie l'import de la constante, le libellé explicite, le branchement de
  la case sur `selectedGroups`/`toggleGroup`, et l'absence du code technique
  `public:site` dans le texte affiché.
- `npm run test:preview-security-gate` : suite complète verte (routes
  privées, absence de modèle d'audience ou de coordonnées dans les écrans
  publics, client Webmail, intégrité des migrations).
- `npm run build` (`vite build`) : build de production réussi.

## Ce qui reste supposé, pas prouvé

- Aucune recette navigateur réelle n'a été rejouée dans ce lot : je n'ai pas
  cliqué la case dans un navigateur, seulement vérifié le code source et le
  typage. La recette en conditions réelles (proposer une flash « visible par
  tous », la valider, la publier, la voir sur la route publique) est le
  périmètre explicite du LOT 4 du même plan, pas de celui-ci.
- Aucune vérification que le référent numérique ou la DDFPT, au moment de
  valider une proposition cochée « Visible par tous sur le site », voit cette
  information avec la même clarté sur l'écran de validation : ce lot n'a
  touché que l'écran de proposition, pas l'écran de validation/correction.
