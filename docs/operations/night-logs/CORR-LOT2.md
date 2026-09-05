# LOT 2 — Le rappel à l'enregistrement, pur écran, et un blocage trouvé en le construisant

5 septembre 2026. Plan : `docs/operations/PLAN_FLASH_CORRECTION_VISIBLE_2026-09-05.md`.
Session unique, LOT 2 seulement. Fichiers touchés, rien d'autre :

- `src/pages/admin/FlashValidationPage.tsx`
- `scripts/test-flash-validation-page.mjs`

Aucune route, aucune migration, aucun drapeau, aucun envoi, aucune donnée réelle.

## Ce qui a été fait

Le LOT 2 porte uniquement sur l'écran de correction (`FlashValidationPage.tsx`,
carte « Correction confirmée » déjà branchée sur `POST .../correction` depuis
le LOT existant). Trois exigences du plan, toutes couvertes :

### 1. Le rappel à la confirmation

Dès que `submitCorrection` reçoit une confirmation du serveur, la carte
affiche désormais un encart ambre, avant le détail de l'écart et du
traitement d'audience :

> Correction enregistrée, mais pas visible : il faut la publier pour qu'elle
> remplace ce que le public voit encore.

### 2. Dire QUELLE ancienne version reste visible

`openCorrection` capture désormais, dans un nouvel état
`correctionBeforeVersion`, le titre et le texte de la version **encore
publiée** au moment précis où le formulaire s'ouvre — avant toute frappe.
Cette capture est indispensable : les champs `correctionTitle`/`correctionBody`
sont ensuite modifiés par la personne qui corrige, donc les relire au moment
de la confirmation aurait affiché le **nouveau** texte à la place de
l'ancien. `submitCorrection` associe ce cliché à la réponse du serveur
(`correctionResult.previousVersion`), et l'écran l'affiche nommément :

> Tant que cette publication n'a pas eu lieu, le public voit toujours
> l'ancienne version : « {titre encore servi} ».

### 3. Le bouton de publication, immédiatement accessible depuis ce rappel

Le rappel porte son propre bouton « Publier la correction maintenant », qui
appelle **la même fonction `publish()`** déjà utilisée par la file « Validées,
en attente de publication » — aucune route nouvelle, aucun recalcul côté
client. Une fois cette publication effectivement confirmée par le serveur
pour la même information (comparaison sur `flashInfoId`), le rappel disparaît
de lui-même : le bandeau de succès déjà existant (`notice`) suffit alors.

### Tests

`scripts/test-flash-validation-page.mjs` (+4 tests, lecture statique du
code source, même convention que les tests existants de ce fichier) :

- la capture du cliché « avant » vient bien de `item.version` (la version
  encore publiée), jamais des champs modifiables du formulaire ;
- le rappel nomme explicitement l'ancienne version encore servie ;
- le bouton du rappel appelle `publish()`, pas une route inventée ;
- le rappel se referme quand, et seulement quand, la même information est
  réellement republiée.

## Preuves réellement exécutées

- `npm run test:flash-validation-page` → 14/14 tests passés (10 existants +
  4 nouveaux).
- `npm run test:flash` (agrégat transitions/version-diff/audience-correction/
  expiration/visibility/public-feed/public-route) → tout vert, aucune
  régression : ce lot ne touche à aucun de ces modules purs.
- `node node_modules/typescript/bin/tsc --noEmit` → aucune erreur.
- `npm run test:preview-security-gate` → intégralement vert (surface privée,
  aucun modèle d'audience ou de livraison importé côté navigateur, aucune
  coordonnée de document privé dans une vue).
- `npm run test:spec-integrity` → vert, 635 tâches, comptage inchangé (ce lot
  ne coche ni n'ouvre aucune tâche Spec Kit).
- `npm run build` → a **réellement abouti** cette fois (`✓ built in 12.55s`,
  `FlashValidationPage-C_xBiezZ.js` régénéré à 23.23 kB). Le piège documenté
  dans `CLAUDE.md` (binaires natifs Windows de rollup absents) ne s'est donc
  pas reproduit dans ce shell pour cette session ; à ne pas généraliser pour
  autant, ce n'est qu'une observation ponctuelle.

Aucune de ces preuves n'est une recette PostgreSQL réelle ni une recette
navigateur : ce sont des exécutions locales de tests statiques, de typage et
de build, conformément à `CLAUDE.md`.

## Un blocage trouvé en construisant ce lot, pas encore résolu

Le plan demande que le bouton de publication du rappel soit « immédiatement
accessible ». Il l'est à l'écran : `publish()` appelle bien
`POST /api/flash/proposals/[id]/publication` avec le bon `flashInfoId`. Mais
en relisant cette route pour vérifier que l'appel aboutirait réellement, deux
faits, déjà lus dans le code, montrent qu'il échouerait aujourd'hui contre
une base réelle :

- `api/flash/proposals/[id]/publication.ts` (lignes ~138-148) écrit
  `.update(flashInfoVersions).set({ status: "publiee", ... }).where(and(...,
  eq(flashInfoVersions.status, "validee")))`. Cette clause `WHERE` est câblée
  en dur sur `"validee"`. Une version corrigée porte le statut `"modifiee"`
  (LOT 1 de ce même plan a bien ouvert la transition légale
  `modifiee -> publiee` dans `shared/flash-transitions.ts`, donc
  `assertLegalFlashVersionTransition` laisserait passer l'appel) — mais la
  requête SQL elle-même ne trouvera jamais de ligne à mettre à jour pour un
  statut `"modifiee"`. Le filet `if (!updated) throw new HttpError(409, "Cette
  information vient d'être publiée par quelqu'un d'autre.")` se déclencherait
  alors à tort : un message pensé pour la concurrence signalerait en réalité
  un statut jamais prévu par cette requête.
- `api/flash/validation/publishable.ts` filtre aussi exclusivement
  `eq(flashInfoVersions.status, "validee")`. Une version corrigée
  (`"modifiee"`) n'apparaîtra donc jamais dans la file « Validées, en attente
  de publication » : le rappel de ce LOT 2 est, concrètement, le **seul**
  chemin d'écran qui tenterait de publier une correction — et il buterait sur
  le point ci-dessus.

**Ceci est déduit d'une relecture du code, pas vérifié par une exécution
contre une base réelle** (aucune pile PostgreSQL locale disponible dans cette
session, et une recette réelle sort du périmètre strict du LOT 2, qui ne
touche qu'à l'écran). C'est exactement le point que la clôture du LOT 1
(`CORR-LOT1.md`) avait déjà signalé sans le résoudre : la persistance réelle
(`correction.ts`, `publication.ts`, `publishable.ts`) n'a pas encore été mise
en cohérence avec la règle pure ouverte au LOT 1. Ce LOT 2 construit l'écran
exactement comme demandé, avec le bouton relié à la bonne route — mais ne
corrige pas ces trois fichiers de persistance, car ce n'est pas son
périmètre.

**À trancher avec Adel avant de déclarer le plan de correction visible
terminé** : soit un lot dédié doit ouvrir `publication.ts`
(clause `WHERE` acceptant aussi `"modifiee"`) et `publishable.ts` (filtre
acceptant aussi `"modifiee"`) avant que ce bouton ne fonctionne réellement,
soit ce même constat doit être répété au LOT 4 (recette) pour qu'il ne soit
pas découvert seulement là, en base réelle, comme un échec de dernière
minute.

## Portée strictement respectée

Rien d'autre que les deux fichiers listés en tête n'a été modifié. Aucune
route, aucune migration, aucun composant hors `FlashValidationPage.tsx`,
aucun drapeau, aucun envoi, aucune donnée réelle.
