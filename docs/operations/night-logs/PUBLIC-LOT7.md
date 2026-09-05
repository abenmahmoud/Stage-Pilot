# LOT 7 — Clôture (2026-09-05)

Périmètre strict : `docs/operations/PLAN_FLASH_PUBLIC_2026-09-05.md`, LOT 7
uniquement — compte rendu global. Aucun code métier touché dans ce lot :
seule la lecture des six comptes rendus précédents
(`PUBLIC-LOT1.md` à `PUBLIC-LOT6.md`), de `tasks.md` et du dépôt courant.
`CLAUDE.md` appliqué intégralement.

## Ce que le plan a livré, en une phrase

Le circuit décrit en tête du plan est maintenant construit et prouvé
localement de bout en bout, sauf deux trous explicitement identifiés
(scénario 4 de la recette, et les canaux push/sms) : une flash publiée par
un service habilité devient visible sur une route publique anonyme, écrit
des lignes d'envoi jamais réellement transmises, et l'écran de validation
est désormais fermé à qui ne porte pas le service.

## LOT par LOT, ce qui est réellement prouvé

- **LOT 1** — `shared/flash-visibility.ts`, module pur. 11/11 tests. Aucune
  preuve base ni navigateur (hors périmètre du lot).
- **LOT 2** — route publique `GET /api/content/flash/public` et affichage
  (`FlashPublicBulletin`). Tests unitaires et de câblage verts, `tsc`/`build`
  verts. **Aucune preuve PostgreSQL ni navigateur au moment du lot** — comblée
  ensuite par le LOT 6.
- **LOT 3** — écriture des lignes `flash_notification_dispatches` à l'état
  `simulated` (jamais `sent`), idempotente. Tests verts. Migration
  `20260905150000` jamais exécutée en base réelle au moment du lot — comblée
  par le LOT 6 (`db reset`, 102 migrations rejouées).
- **LOT 4** — pont vers la file durable de la spec 005, **canal email
  seulement** (décision assumée et documentée, pas un oubli : push/sms
  n'ont aucun fournisseur ni consommateur nulle part dans ce dépôt, en
  étendre le périmètre aurait été construire un second mécanisme que la
  règle commune n°4 du plan interdit). Le pont reste inerte tant que
  `communication_settings.module_enabled` est faux (défaut) et que
  `FLASH_COMMUNICATION_BRIDGE_HMAC_SECRET` n'est pas défini (non défini).
  Aucun consommateur ne réclame jamais les travaux `prepare_delivery` mis en
  file, nulle part dans ce dépôt, pour aucun usage — pas seulement pour flash.
- **LOT 5** — porte de l'écran de validation reposant sur
  `GET /api/flash/validation/screen-access` et `grantedFlashValidationService`,
  plus `FlashValidationRoute` côté client (échec réseau = écran fermé).
  T071E cochée à ce moment sur preuve de fonction pure et de lecture de code
  — la preuve PostgreSQL réelle restait à faire, notée comme telle.
- **LOT 6** — recette PostgreSQL réelle (102 migrations rejouées depuis
  zéro, `npm run recipe:local-flash-public`, 23 assertions passées) et
  recette navigateur réelle (Chromium/Playwright, 320/390/1440 px, captures
  dans `.vercel/flash-recette/`). Six des sept scénarios du plan tiennent
  tels quels. **Le scénario 4 échoue** : corriger une flash publiée la fait
  passer à `modifiee`, et la route publique ne sert que `publiee` — la
  flash corrigée disparaît du site au lieu d'afficher la correction, faute
  de toute route `modifiee -> publiee`. Le volet « visible pour un membre »
  du scénario 2 n'a une preuve qu'au niveau module, pas HTTP bout-en-bout,
  faute de route authentifiée servant le fil flash à une personne
  identifiée.

## T071E : cochée, et vérifiée à nouveau ici

`specs/002-agent-etablissement-adaptatif/tasks.md:1195` porte `[x] T071E`,
avec deux entrées horodatées : l'état non coché du 5 septembre (clôture du
plan de publication) puis la clôture du LOT 5 de ce plan. Relu pendant ce
LOT 7 : la case est justifiée par une preuve allant au-delà de ce que le
LOT 5 avait lui-même — le LOT 6 a depuis exercé la vraie route
`GET /api/flash/validation/screen-access` contre un PostgreSQL réel avec un
compte `administration` fictif sans le service (`allowed: false`) puis avec
(`allowed: true`). La case reste cochée à raison ; ce LOT 7 ne la touche
pas, conformément à la consigne du plan (« cocher T071E seulement si elle
l'est vraiment » — elle l'était déjà).

Aucune autre tâche n'est décochée ni cochée par ce lot. Le trou trouvé par
le LOT 6 (scénario 4) ne remet pas en cause T071E : il touche la porte de
correction/publication, pas la porte de validation. Il ne remet pas non plus
en cause T071B/T071F au sens littéral de leur texte (calcul des ensembles,
transition `validee -> publiee`) — ces tâches ne promettaient pas de
transition retour `modifiee -> publiee`. `npm run test:spec-integrity`
confirme l'état inchangé depuis le LOT 6 : 634 tâches, 5 specs, 228 tâches
closes sur la spec 002 (71 encore ouvertes).

**Correction d'une inexactitude devenue caduque dans `CLAUDE.md`** : la
section « État au 3 septembre 2026 » y affirme encore, pour un domaine
différent (persistance flash, plan antérieur), que T071/T071A/T071B/T071C/
T071E restaient ouvertes. C'était exact le 3 septembre ; ça ne l'est plus
depuis la clôture du plan de publication le 5 septembre puis de ce plan de
visibilité publique. Ce LOT 7 ne modifie pas `CLAUDE.md` — hors périmètre
du plan — mais le signale explicitement ici pour la prochaine session.

## Preuves exécutées pendant ce LOT 7

- `node node_modules/typescript/bin/tsc --noEmit` → aucune erreur.
- `npm run build` (`vite build`) → succès, `dist/` produit.
- `npm run test:preview-security-gate` → code de sortie `0`, sortie complète
  (2340 lignes) relue par recherche de `fail [1-9]` / `not ok` /
  `AssertionError` : aucune occurrence.
- `npm run test:spec-integrity` → 634 tâches, 5 specs, inchangé depuis le
  LOT 6 (aucune tâche cochée par ce lot).
- `npm run test:migration-integrity` → 102 migrations, 102 versions
  uniques, 77 références vérifiées.
- `docker info` / `npx supabase status` → pile locale toujours démarrée
  depuis le LOT 6 (conteneurs `supabase_*_lyceegest-prototype`), non
  arrêtée ni relancée par ce lot ; aucune commande de recette rejouée ici,
  la preuve PostgreSQL réelle du plan reste celle, déjà actée, du LOT 6.

Aucune de ces preuves n'est une nouvelle recette PostgreSQL ni navigateur :
ce lot est un compte rendu, pas une nouvelle exécution fonctionnelle.

## Ce qui reste avant qu'une information flash puisse être envoyée pour de vrai

### Drapeaux fermés aujourd'hui, tous vérifiés dans le code au moment de ce lot

- `VITE_FLASH_INFO_UI_ENABLED` / `FLASH_INFO_UI_ENABLED` — ferment l'écran de
  proposition (`src/lib/feature-flags.ts`). Non définis, donc faux.
- `VITE_FLASH_VALIDATION_UI_ENABLED` / `FLASH_VALIDATION_UI_ENABLED` —
  ferment l'écran de validation. Non définis, donc faux.
- `communication_settings.module_enabled` — colonne `boolean not null default
  false` (`supabase/migrations/20260830053500`), par établissement. Tant
  qu'elle est fausse, le pont du LOT 4 n'écrit jamais rien dans
  `communications`/`communication_versions`/`communication_jobs`, quel que
  soit l'état des autres drapeaux.
- `FLASH_COMMUNICATION_BRIDGE_HMAC_SECRET` — variable d'environnement, non
  définie, aucune valeur choisie ni committée. Sans elle, le pont reste
  inerte même si `module_enabled` devenait un jour vrai.
- **Aucun drapeau n'existe pour la route publique elle-même**
  (`GET /api/content/flash/public`) ni pour `FlashPublicBulletin` : ce sont
  les seules pièces de ce plan déjà actives sans interrupteur dédié.
  Ce n'est pas une régression du plan — elles ne servent et n'affichent
  que ce qui est déjà légitimement `publiee`, avec la même absence de
  drapeau que `api/content/public.ts` déjà en place — mais ça mérite
  d'être su explicitement : la route et le bandeau sont en production dès
  ce commit, pas seulement en préparation.

### Ce qui resterait fermé même en ouvrant tous les drapeaux ci-dessus

- **Aucun consommateur ne traite jamais un travail `communication_jobs` de
  type `prepare_delivery`**, ni pour flash ni pour l'usage natif du centre
  de communication (T010, spec 005, encore ouverte). Ouvrir
  `module_enabled` et le secret HMAC ferait écrire des lignes dans la file,
  mais rien ne les lirait ni ne les transmettrait au Webmail.
- **Push et SMS n'ont aucun canal de file durable.** `flash_notification_dispatches`
  continue de porter ces cibles au seul état `simulated`, sans chemin vers
  un envoi réel : `communication_deliveries.channel` reste limité à
  `('email')` par contrainte CHECK, et aucun fournisseur push n'existe nulle
  part dans ce dépôt. Étendre ce périmètre est un choix architectural plus
  large qu'un lot, explicitement laissé ouvert par le LOT 4.
- **Corriger une flash déjà publiée la retire du site public au lieu de la
  corriger dessus** (LOT 6, scénario 4) : aucune route ne fait jamais
  repasser une version `modifiee` vers `publiee`. Tant que ce point n'est
  pas tranché, publier une correction sur une information déjà visible est
  une régression fonctionnelle pour le public, pas seulement une preuve
  manquante.
- **Aucune route authentifiée ne sert le fil flash à une personne
  identifiée** pour une audience ciblée (`classe:2nde4`, etc.) : seule la
  route anonyme du LOT 2 existe. Une flash ciblée reste donc, dans les
  faits, invisible pour son public réel tant que cet écran n'est pas
  construit.
- **`FLASH_PUBLIC_AUDIENCE_GROUP_REF = "public:site"` n'a jamais de
  chemin pour être choisie depuis un écran.** `FlashProposalPage.tsx` ne
  permet pas à un auteur de sélectionner cette audience à la proposition ;
  une flash ne peut aujourd'hui apparaître sur la route publique qu'en
  insérant la ligne `flash_info_audiences` correspondante par un autre
  moyen que l'écran existant.

### Validations humaines encore attendues d'Adel, listées par les six lots

1. Confirmer ou remplacer la convention `FLASH_PUBLIC_AUDIENCE_GROUP_REF =
   "public:site"` inventée aux LOT 1/2 — jamais actée ailleurs.
2. Confirmer la décision du LOT 4 de ne raccorder que le canal email à la
   file durable, en laissant push/sms hors de tout mécanisme de livraison
   réelle pour le moment, plutôt que de construire un second circuit.
3. Trancher le comportement attendu de « corriger une publiée » (scénario 4
   du LOT 6) : une nouvelle transition légale `modifiee -> publiee`, geste
   humain distinct comme l'a été T071F pour `validee -> publiee`, ou une
   redéfinition du sens de « corriger » sur ce domaine. Ce point bloque
   toute évolution ultérieure de la correction post-publication.
4. Décider s'il faut construire un écran authentifié pour les audiences
   ciblées avant d'ouvrir `VITE_FLASH_INFO_UI_ENABLED` en production, sans
   quoi une flash ciblée validée et publiée ne sera, dans les faits, vue par
   personne de son public réel.

### Preuves manquantes, au sens strict

- Aucune preuve sur un projet Supabase distant (interdit par CLAUDE.md,
  rappel volontaire, pas un oubli).
- Aucune preuve qu'un travail `prepare_delivery` mis en file soit un jour
  réellement traité — le consommateur n'existe pas, donc aucune preuve n'est
  possible avant qu'il soit construit.
- Aucune preuve HTTP bout-en-bout pour une audience ciblée vue par un
  membre identifié (module-only, voir LOT 6).
- Aucune preuve que corriger une publiée affiche la correction au public
  (LOT 6 : preuve du contraire, apportée).

## Portée strictement respectée

Rien d'autre que ce compte rendu n'a été écrit par ce LOT 7 : aucune route,
aucun module, aucune migration, aucune case cochée ou décochée dans
`tasks.md`. Aucun drapeau ouvert, aucun envoi réel, aucune donnée réelle,
aucun `git push`. Un seul commit local, comme les six lots précédents.
