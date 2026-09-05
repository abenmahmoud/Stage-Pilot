# LOT 4 — Recette, sur PostgreSQL réel et en navigateur

5 septembre 2026. Plan : `docs/operations/PLAN_FLASH_CORRECTION_VISIBLE_2026-09-05.md`,
LOT 4 uniquement. Session unique. Aucun code de `correction.ts`, `publication.ts`,
`publishable.ts` ni du trigger `flash_guard_version` n'a été modifié : ce lot
recette, il ne corrige rien. Fichiers touchés, rien d'autre :

- `scripts/test-flash-correction-recette.mjs` (nouveau, recette PostgreSQL
  réel, `--local-stack-only`)
- `scripts/test-flash-correction-browser-recette.mjs` (nouveau, recette
  Chromium réel, `--local-stack-only`)
- `package.json` (deux entrées `recipe:local-flash-correction` et
  `recipe:local-flash-correction-browser`, même convention que les recettes
  existantes)

Aucune migration, aucun drapeau, aucun envoi, aucune donnée réelle. Pile
Supabase locale jetable déjà en service au début de cette session (conteneurs
Docker existants, port 54322/54321) ; comptes et établissement entièrement
fictifs, marqueur aléatoire par exécution.

## Ce que le LOT 4 devait vérifier

Cinq points, tous exécutés réellement, pas relus dans le code :

1. publier, corriger, constater que l'ancienne version reste servie ;
2. publier la correction, constater le remplacement ;
3. vérifier qu'aucune étape ne laisse la page publique vide ;
4. proposer une flash « visible par tous » depuis l'écran, la publier, la voir ;
5. captures à 320, 390 et 1 440 px.

## Résultat : le plan n'est PAS terminé. Deux échecs réels, prouvés contre PostgreSQL et en navigateur, pas seulement lus dans le code

`CORR-LOT1.md` et `CORR-LOT2.md` avaient chacun signalé, **par lecture de
code seulement**, que la persistance réelle (`correction.ts`, `publication.ts`,
`publishable.ts`, trigger `flash_guard_version`) n'avait jamais été mise en
cohérence avec la règle pure ouverte au LOT 1
(`shared/flash-transitions.ts`, `modifiee -> publiee` légale) ni avec l'écran
construit au LOT 2. Ce LOT 4 a rejoué exactement le parcours du plan contre
une base PostgreSQL réelle et un vrai navigateur Chromium, et confirme que ce
risque signalé s'est bien réalisé.

### Échec 1 — corriger une information publiée la fait immédiatement disparaître de la route publique, avant toute tentative de republication

`correction.ts` **mute la même ligne** (`flash_info_versions`) : `status`
passe de `publiee` à `modifiee`, et `title`/`bodyMarkdown` sont écrasés en
place par le nouveau contenu. Il n'existe qu'une seule ligne par information
flash (`flash_infos.current_version`). La route publique
(`api/content/flash/public.ts`) filtre strictement `status = 'publiee'`.

Conséquence, prouvée par un appel réel à la vraie route
`POST /api/flash/proposals/[id]/correction` contre PostgreSQL, puis un appel
réel à `GET /api/content/flash/public` :

- **DB (`scripts/test-flash-correction-recette.mjs`, scénario A)** : dès la
  confirmation de la correction — avant tout clic sur « Publier la correction
  maintenant » — la route publique renvoie 0 élément pour cette information.
  Ni l'ancienne version (déjà écrasée), ni la nouvelle (statut `modifiee`,
  jamais servi) ne sont visibles.
- **Navigateur (`scripts/test-flash-correction-browser-recette.mjs`)** :
  même constat par un vrai clic « Confirmer la correction » dans
  `FlashValidationPage.tsx`, puis un vrai chargement de `/` dans un second
  onglet Chromium isolé. Captures réelles, aux trois largeurs demandées
  (320/390/1440), avant et après la correction :
  - `corr-lot4-public-1-apres-publication-initiale-{320,390,1440}.png` :
    l'information est visible.
  - `corr-lot4-public-2-apres-correction-avant-republication-{320,390,1440}.png` :
    l'information a disparu de la page publique aux trois largeurs, alors que
    l'encart amont de `FlashValidationPage.tsx` (LOT 2) affirme au même
    instant : « le public voit toujours l'ancienne version ». **Cette phrase
    est fausse en base réelle.** (Répertoire de sortie :
    `.vercel/flash-recette/`, non versionné, comme les recettes précédentes.)

C'est exactement la régression que ce plan devait réparer (§ « La régression
à réparer » du plan). Elle n'est pas réparée : LOT 1/2/3 n'ont touché que des
modules purs et des écrans, jamais `correction.ts` ni `public.ts`.

### Échec 2 — republier la correction échoue, avec un message d'erreur qui ment sur la cause

Tentative réelle, dans les deux recettes, de `POST
/api/flash/proposals/[id]/publication` sur la version corrigée
(`status = 'modifiee'`) :

- **DB** : réponse `409`, `{"error":"Cette information vient d'être publiée
  par quelqu'un d'autre."}`. Ce message est écrit pour un cas de concurrence
  réelle (`updated` vide après le `UPDATE ... WHERE status = 'validee'`) ; ici
  il se déclenche car la clause `WHERE` de `publication.ts` est câblée en dur
  sur `status = 'validee'`, qui ne correspond jamais à `'modifiee'`. Statut
  final inchangé : `modifiee`.
- **Navigateur** : même résultat par un vrai clic sur le vrai bouton du
  rappel du LOT 2, « Publier la correction maintenant »
  (`corr-lot4-admin-republish-attempt-1440.png`) : un encart `role="alert"`
  affiche le même message trompeur. Le référent qui suit le rappel construit
  au LOT 2 — cliquer ce bouton pour que la correction remplace l'ancienne
  version — reçoit une explication qui n'a aucun rapport avec la cause réelle.
- Si la clause `WHERE` était corrigée, la transition échouerait quand même
  **au niveau SQL** : le trigger `flash_guard_version`
  (`supabase/migrations/20260905013000_create_flash_info_foundation.sql`,
  lignes ~256-262) n'autorise que `(old.status = 'publiee' and new.status =
  'modifiee')`, jamais l'inverse, malgré `shared/flash-transitions.ts` qui
  autorise `modifiee -> publiee` depuis le LOT 1. Non exercé directement ici
  (l'échec de la clause `WHERE` empêche d'atteindre le trigger), mais lu et
  confirmé dans la migration.
- `GET /api/flash/validation/publishable` (file « Validées, en attente de
  publication ») reste filtrée en dur sur `status = 'validee'` : une
  correction n'y apparaît jamais. Confirmé par l'appel réel à cette route
  dans `scripts/test-flash-correction-recette.mjs`
  (`correctionListedAsPublishable: false`).

Reconfirmation après cette tentative : la route publique reste vide pour
cette information (`corr-lot4-public-3-apres-tentative-republication-*.png`,
trois largeurs). Rien n'a changé : ni l'ancienne version n'a été rétablie, ni
la nouvelle n'a été publiée.

## Ce qui a été prouvé, sans réserve

### Un flux de publication simple ne casse rien

Scénario C de `test-flash-correction-recette.mjs` : proposer, valider,
publier — **sans correction** — ne laisse jamais la page publique vide pour
cette information. La régression est bien localisée à la correction d'une
version déjà publiée, pas au parcours de publication initiale (LOT existant,
déjà recetté au plan de publication publique).

### « Visible par tous », de la proposition à l'affichage public

Une flash proposée avec l'audience `public:site` (le `groupRef` exact ajouté
à l'écran de proposition au LOT 3 de ce plan), une fois validée puis publiée
par la vraie route, apparaît réellement sur `GET /api/content/flash/public` :

- **DB** : scénario D de `test-flash-correction-recette.mjs`, contre
  PostgreSQL réel.
- **Navigateur** : la même préparation, publiée par un vrai clic sur
  « Publier » dans `FlashValidationPage.tsx`, puis vue réellement sur `/` par
  Chromium aux trois largeurs
  (`corr-lot4-public-1-apres-publication-initiale-{320,390,1440}.png`).

Ceci exerce le **chemin serveur complet** de la case à cocher du LOT 3
(`parseFlashGroupRef` -> `flash_info_audiences` -> filtre de
`api/content/flash/public.ts`), avec le même `groupRef` que celui que produit
la case. Réserve honnête : ce lot a proposé la flash par un appel direct à
`POST /api/flash/proposals`, pas par un vrai clic sur la case « Visible par
tous sur le site » de `FlashProposalPage.tsx` dans Chromium — ce clic précis
avait déjà été prouvé par lecture statique du code au LOT 3
(`npm run test:flash-proposal-page`, 10/10) mais jamais par un clic réel dans
un navigateur. Ce clic-là reste à rejouer si Adel veut une preuve
navigateur complète du LOT 3, pas seulement du chemin serveur qu'il déclenche.

## Un piège d'outillage trouvé et corrigé dans les scripts de recette (pas dans le produit)

Deux découvertes propres à la construction de ce lot, sans rapport avec le
produit :

- Le gabarit repris de `scripts/test-flash-publication-browser-recette.mjs`
  ne branchait jamais `GET /api/flash/validation/screen-access`
  (`api/flash/validation/screen-access.ts`), route ajoutée après ce gabarit
  et désormais appelée par `FlashValidationRoute` (`src/App.tsx`) avant
  d'afficher l'écran. Sans elle, toute recette navigateur de cet écran
  échoue en silence (redirection vers le tableau de bord, jamais une erreur
  explicite) — corrigé dans les deux nouveaux scripts de ce lot.
- Un second onglet Chromium du **même contexte navigateur** partage le
  `localStorage` (donc la session) avec le premier : faire naviguer un
  second onglet vers la route publique perturbait réellement la session aal2
  de l'onglet resté sur l'écran de correction (le panneau de rappel du LOT 2
  disparaissait). Corrigé en donnant à l'onglet « route publique » son propre
  contexte navigateur (`browser.newContext()` séparé), qui n'a plus accès au
  `localStorage` de l'onglet admin.

Ni l'un ni l'autre n'est un défaut du produit ; les deux sont documentés en
tête des scripts pour ne pas être reperdus.

## Preuves réellement exécutées

- `node --import ./scripts/ts-test-resolver.mjs --experimental-transform-types scripts/test-flash-correction-recette.mjs --local-stack-only`
  (alias `npm run recipe:local-flash-correction`) contre PostgreSQL réel
  (`127.0.0.1:54322`) : 10 vérifications passées, échecs des scénarios A/B
  capturés et rapportés dans le JSON de sortie du script (`findings`), pas
  masqués par une assertion qui aurait fait échouer le script — volontaire,
  pour que la preuve survive même si le comportement change.
- `node --import ./scripts/ts-test-resolver.mjs --experimental-transform-types scripts/test-flash-correction-browser-recette.mjs --local-stack-only`
  (alias `npm run recipe:local-flash-correction-browser`) : Chromium réel,
  session aal2 réelle (signIn + enrôlement TOTP + vérification), 7
  vérifications passées, build `vite` réel, 11 captures d'écran réelles dans
  `.vercel/flash-recette/` (non versionné, même convention que les recettes
  précédentes) :
  - `corr-lot4-public-1-apres-publication-initiale-{320,390,1440}.png`
  - `corr-lot4-admin-correction-confirmee-1440.png`
  - `corr-lot4-public-2-apres-correction-avant-republication-{320,390,1440}.png`
  - `corr-lot4-admin-republish-attempt-1440.png`
  - `corr-lot4-public-3-apres-tentative-republication-{320,390,1440}.png`
- `node node_modules/typescript/bin/tsc --noEmit` : aucune erreur.
- `npm run test:preview-security-gate` : intégralement vert.
- `npm run test:spec-integrity` : vert, 635 tâches, comptage inchangé (ce lot
  ne coche ni n'ouvre aucune tâche Spec Kit).
- `npm run build` (`vite build`) : build de production réussi.

## Ce qui reste supposé, pas prouvé

- Le clic réel sur la case « Visible par tous sur le site » de
  `FlashProposalPage.tsx` dans un navigateur (voir plus haut) : prouvé par
  test statique (LOT 3) et par le chemin serveur qu'il produit (ce lot), pas
  par un clic Playwright littéral sur cette case précise.
- Le comportement du trigger `flash_guard_version` face à un
  `modifiee -> publiee` qui atteindrait réellement le `UPDATE` SQL (si la
  clause `WHERE` de `publication.ts` était corrigée) : lu dans la migration,
  pas déclenché ici, puisque la clause `WHERE` actuelle empêche d'y arriver.
- Tout ce qui suppose une correction qui se propage réellement (audience
  ajoutée/retirée notifiée, écart décisif traité) reste non observable tant
  que republier une correction échoue : ce lot ne peut pas recetter plus loin
  que le point de blocage trouvé.

## À trancher avec Adel avant de déclarer ce plan terminé

Exactement le point déjà annoncé, sans preuve d'exécution, par `CORR-LOT1.md`
et `CORR-LOT2.md` — confirmé ici par une exécution réelle contre PostgreSQL
et un navigateur, DB et écran, deux fois indépendamment :

**La persistance réelle (`api/flash/proposals/[id]/correction.ts`,
`api/flash/proposals/[id]/publication.ts`,
`api/flash/validation/publishable.ts`, trigger `flash_guard_version` dans
`supabase/migrations/20260905013000_create_flash_info_foundation.sql`) n'a
jamais été mise en cohérence avec la règle pure ouverte au LOT 1 ni avec
l'écran construit au LOT 2.** Aujourd'hui, corriger une information déjà
publiée la fait disparaître du site public immédiatement, et aucun geste
depuis l'écran ne peut la republier. Le plan affirme le contraire dans son
énoncé même (« une information ne disparaît jamais du site du fait d'une
correction ») : c'est faux en pratique, sur PostgreSQL réel comme en
navigateur.

Il manque, au minimum, avant que ce plan puisse être déclaré terminé :

1. une migration qui ouvre `(old.status = 'modifiee' and new.status =
   'publiee')` dans `flash_guard_version` ;
2. `publication.ts` : la clause `WHERE` doit accepter `status IN ('validee',
   'modifiee')`, pas seulement `'validee'` ;
3. `publishable.ts` : le filtre doit lister aussi les versions `modifiee`,
   sans quoi aucune file d'écran ne peut jamais présenter une correction en
   attente de republication (le bouton du rappel du LOT 2 reste alors le
   seul chemin, comme déjà signalé au LOT 2) ;
4. une décision explicite sur ce que sert la route publique **entre**
   l'enregistrement d'une correction et sa republication : soit une seconde
   ligne de version est créée par `correction.ts` (au lieu d'une mutation en
   place) pour que l'ancienne reste lisible pendant que la nouvelle est en
   attente, soit une autre mécanique équivalente est choisie — mais le
   principe actuel d'une seule ligne mutée en place rend structurellement
   impossible la promesse du plan (« l'ancienne version reste affichée »).

Ce LOT 4 ne propose aucune de ces quatre décisions : il n'était pas dans son
périmètre de les trancher, seulement de recetter et de rapporter fidèlement.
Le LOT 5 (clôture) doit porter ce constat à Adel avant toute déclaration de
fin de plan.
