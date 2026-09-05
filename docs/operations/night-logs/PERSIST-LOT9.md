# LOT 9 — Clôture (persistance des informations flash, 2026-09-05)

Plan : `docs/operations/PLAN_FLASH_PERSISTANCE_2026-09-05.md`, LOT 9.
Portée exacte de ce lot : **aucun code**. Un compte rendu global, appuyé sur
les huit comptes rendus déjà écrits (`PERSIST-LOT1.md` à `PERSIST-LOT8.md`,
tous relus en entier pour ce lot) et sur des commandes rejouées ce soir pour
vérifier qu'aucune régression ne s'est glissée entre le dernier commit du
LOT 8 et maintenant.

## Ce qui est prouvé par une commande réellement exécutée ce soir (LOT 9)

- `git status --porcelain=v1` : arbre de travail propre à part `.nuit.lock`
  (non suivi, préexistant, non lié à ce plan).
- `git branch --show-current` : `codex/lycee-connect-prototype`.
- `node node_modules/typescript/bin/tsc --noEmit` : aucune sortie, aucune
  erreur.
- `npm run build` : succès (`✓ built in 10.79s`), code 0.
- `npm run test:preview-security-gate` : code de sortie 0, 116 groupes de
  tests exécutés, aucun `ℹ fail [1-9]` dans la sortie complète.
- `npm run test:flash-recette` : code de sortie 0, aucun `fail [1-9]`,
  `not ok`, `✖` ni `Error:` dans la sortie complète — toutes les suites
  unitaires des LOT 1 à 6 restent vertes (`flash-transitions`,
  `flash-version-diff`, `flash-audience-correction`, `flash-expiration`,
  `flash-validation-access`, `flash-access`, `flash-payload-policy`,
  `flash-proposal-input`, `flash-decision-input`, `flash-correction`,
  `flash-expiry-cron`, `flash-expired-queue`, `flash-proposal-page`,
  `flash-validation-page`, `flash-recette-adverse`,
  `test:migration-integrity`).
- `npm run test:spec-integrity` : inchangé, 627 tâches, 5 specs
  (001 : 123/19 ouvertes, 002 : 221/77 ouvertes, 003 : 33/1, 004 : 21/5,
  005 : 111/16), aucune régression sur les autres domaines.
- Aucun échec rencontré ce soir sur ces commandes : rien à documenter comme
  erreur brute.

**Non rejoué ce soir, volontairement** : la recette PostgreSQL réelle du
LOT 7 (`scripts/test-local-flash-persistence.mjs`) et la recette navigateur
du LOT 8 (`scripts/test-flash-browser-recette.mjs`). Ce lot est une clôture
documentaire, pas une nouvelle recette ; relire ces deux comptes rendus pour
la preuve originale, datée et non rejouée à l'identique ici. Rien dans les
fichiers touchés par les LOT 1 à 8 n'a changé depuis (`git log` sans nouveau
commit sur les chemins flash entre le LOT 8 et ce soir), donc leurs
conclusions restent valables sans nouvelle exécution.

## Ce qui est réellement utilisable aujourd'hui

- **Proposer** une information flash (`POST /api/flash/proposals`) depuis
  l'écran `admin/informations-flash/proposer` : auteur pris de la session,
  idempotence sur double envoi, versionnée dès la création. Prouvé de bout
  en bout avec un vrai jeton Supabase et une vraie base (LOT 7, scénarios 1
  et 4) et par un rendu Chromium réel à trois largeurs (LOT 8).
- **Valider ou refuser** une proposition en attente
  (`POST /api/flash/proposals/[id]/decision`, `admin/informations-flash/valider`) :
  ouverte par le service `referent_numerique`/`ddfpt` réellement porté par
  l'appartenance à l'établissement (jamais par le rôle applicatif), verrou de
  concurrence qui laisse gagner une seule décision, cloisonnement inter-
  établissement qui bloque un compte extérieur avant toute lecture. Prouvé de
  bout en bout avec un vrai jeton Supabase et une vraie base (LOT 7,
  scénarios 1, 3, 5) et par un rendu Chromium réel (LOT 8).
- **Détecter l'expiration sans validation**, conserver la proposition et
  préparer (jamais émettre) un avis factuel à l'auteur, avec un compte
  consultable des échecs (`GET /api/flash/validation/expired`,
  `api/cron/flash-expiry.ts`). Prouvé par SQL direct rejouant exactement les
  requêtes de la route (LOT 5) ; pas encore rejoué avec un vrai jeton HTTP ni
  avec deux établissements simultanés.
- **Corriger après publication** (`POST /api/flash/proposals/[id]/correction`) :
  calcule les trois ensembles (maintenus/retirés/ajoutés) et les canaux
  réellement éligibles depuis la trace réelle des envois, jamais depuis
  l'importance déclarée ; le cas du 5 septembre (urgente notifiée puis
  ramenée à normale, correction toujours due) est rejoué et vérifié en base
  réelle (LOT 7, scénario 7). **Cette route ne peut être atteinte que si une
  version est déjà `publiee`** — voir le trou ci-dessous : aucune route du
  produit ne l'y amène aujourd'hui, elle n'a été exercée qu'en forçant cette
  transition par une requête SQL directe (LOT 7).

## Ce qui est encore simulé ou décoratif à l'écran

- **La sélection de contacts SMS** sur l'écran de proposition
  (`FlashProposalPage.tsx`) reste un jeu d'essai local : le contrat serveur
  (`shared/flash-proposal-input.ts`) n'a pas de champ pour transporter la
  liste des destinataires choisis, seulement `channels` (qui peut inclure
  `"sms"`). Cocher des contacts ne change rien côté serveur aujourd'hui.
- **Le public visé (audience) et le nom de l'auteur sont invisibles** sur
  l'écran de validation : aucune route actuelle ne les renvoie
  (`GET /api/flash/validation/queue` ne renvoie que la version courante).
  L'écran le dit explicitement à l'écran plutôt que d'inventer un affichage.
- **Aucune modification de texte avant validation** n'est câblée à l'écran
  (le bouton "Valider"/"Refuser" envoie toujours `content: null`) : la route
  accepte un contenu édité (LOT 3, "valider avec modifications") mais aucun
  formulaire d'édition n'existe. Un compte qui veut changer le texte doit
  refuser puis redemander une nouvelle proposition à l'auteur.

## Le trou qui traverse tout le plan, à trancher avec Adel avant toute suite

**Aucune des neuf tâches de ce plan n'écrit jamais la transition
`validee` → `publiee`.** Signalé pour la première fois au LOT 3
(`PERSIST-LOT3.md`), répété au LOT 4, LOT 6, LOT 7 sans qu'aucune instruction
supplémentaire n'ait tranché la question entre-temps :

- LOT 3 s'arrête à `validee`/`refusee` (titre du lot : "valider, refuser,
  modifier" — pas "publier").
- LOT 4 ("corriger après publication") suppose qu'une version `publiee`
  existe déjà, sans jamais l'y amener.
- LOT 7 a dû avancer cette transition **par une requête SQL directe** pour
  pouvoir recetter la correction du LOT 4 (scénario 1) — un contournement de
  recette explicitement documenté comme tel, pas une route de production.
- Conséquence concrète et vérifiée : **une information flash validée dans
  l'application réelle aujourd'hui n'apparaît nulle part côté public, et la
  route de correction du LOT 4, bien que fonctionnelle et testée en base
  réelle, est inatteignable par un usage normal** tant que cette transition
  n'a pas de route.

Question à trancher par Adel avant tout nouveau lot sur ce domaine : la
publication est-elle automatique dès la validation (dans ce cas un lot dédié
doit écrire cette transition, ses tests, et probablement l'affichage public
de l'information flash — hors périmètre de ce plan à neuf lots), ou un geste
humain distinct restant entièrement à spécifier (qui publie, depuis quel
écran, avec quelle garde) ? Ce plan ne tranche pas la question unilatéralement
et ne l'implémente donc pas.

## Autres points non résolus, à décider ou vérifier

- **RLS activé mais sans policy sur les six tables flash.** LOT 7 a vérifié
  (`information_schema.role_table_grants`) qu'`anon`/`authenticated` n'ont
  aucun privilège direct sur ces tables — c'est le retrait de privilège qui
  protège réellement, pas RLS. `force row level security` est actif mais
  aucune policy n'existe : si un futur usage donne un jour un privilège
  direct à `authenticated` sur ces tables (par exemple pour lire depuis le
  navigateur sans passer par une route API), rien ne les protégerait plus.
  À garder en tête si l'architecture d'accès change.
- **Deux enfants d'un même contact, deux groupes : preuve de schéma
  seulement.** LOT 7 confirme qu'aucune contrainte n'empêche deux lignes de
  diffusion de coexister pour un même contact, mais **aucune route n'écrit
  encore réellement dans `flash_notification_dispatches`** à partir d'une
  audience de groupes : la garantie "aucune livraison perdue" ne porte donc
  que sur l'absence de blocage, pas sur un algorithme de résolution
  groupe → contacts qui reste entièrement à écrire.
- **L'écran de validation reste protégé par un rôle applicatif
  (`RoleRoute allowedRoles={CONTENT_MANAGER_ROLES}` dans `src/App.tsx`), pas
  par le service.** Le LOT 6 a bien fait remonter la décision serveur par
  service jusqu'à chaque proposition affichée (T071E, vérifié) et le LOT 7 a
  vérifié qu'un compte sans le service `referent_numerique`/`ddfpt` reçoit un
  refus explicite. Mais la porte d'entrée de l'écran lui-même n'a pas été
  changée par ce plan : un compte avec le rôle `CONTENT_MANAGER_ROLES` mais
  sans le service peut toujours ouvrir l'écran (et n'y verra alors aucune
  action possible). Ce n'est pas nécessairement un défaut — c'est le même
  motif de double filet qu'ailleurs dans le dépôt — mais ce n'est pas non
  plus ce que T071E décrit comme entièrement résolu.
- **`test:preview-security-gate` ne connaît toujours pas le domaine flash**,
  choix pris au LOT 1 et jamais révisé depuis : sa réussite chaque soir
  prouve l'absence de régression ailleurs dans le dépôt, pas une couverture
  du domaine flash par la porte de sécurité de preview.
- **Aucune preuve HTTP bout en bout avec un vrai jeton pour le cron
  d'expiration** (`api/cron/flash-expiry.ts`) : seulement `secretMatches`
  vérifié par lecture de code et un rejeu SQL direct (LOT 5).
- **La politique "qui peut proposer" (LOT 2) et l'ordre de tri de la file de
  validation par expiration croissante (LOT 3)** sont des choix pris dans
  l'instant, jamais confirmés par Adel.

## État des tâches T071 à T071E (`specs/002-agent-etablissement-adaptatif/tasks.md`)

Aucune de ces six tâches n'était cochée avant ce lot. Après relecture
complète des huit comptes rendus et vérification croisée avec le code actuel :

- **T071D cochée** — seule tâche entièrement prouvée sans dépendre du trou de
  publication : détection serveur des propositions expirées sans validation,
  passage d'état, conservation, préparation d'un avis factuel sans mise en
  cause, compte consultable des échecs — tout est vérifié par une requête SQL
  directe rejouant exactement les requêtes de la route (LOT 5), et la route
  ne dépend jamais du statut `publiee`.
- **T071, T071A, T071B restent non cochées.** Leur logique (versionnement,
  calcul des trois ensembles, canaux réellement éligibles) est écrite et
  vérifiée en base réelle par LOT 7 — mais seulement en forçant par SQL la
  transition `publiee` qu'aucune route ne produit. Une tâche qui décrit un
  comportement de production ne peut pas être cochée quand ce comportement
  est actuellement inatteignable par un compte réel dans l'application.
  Cocher ces trois tâches reviendrait à déclarer prouvé ce qui ne l'est pas
  au niveau produit, contrairement à `CLAUDE.md`.
- **T071C reste non cochée.** Le message affiché à l'écran de proposition
  ("Une proposition en attente n'a prévenu personne, même une fois préparée
  ici.") est bien présent et vérifié par lecture du fichier source ce soir.
  Mais l'absence de notification avant validation n'est aujourd'hui vraie
  que par défaut — aucune route n'envoie quoi que ce soit, validé ou non —
  ce n'est pas une garantie démontrée par un scénario qui tente réellement de
  contourner la règle.
- **T071E reste non cochée.** L'essentiel du texte de la tâche est fait et
  prouvé (application serveur par service, remontée jusqu'à l'écran de
  validation, vérifiée par un vrai compte `referent_numerique` en base réelle
  au LOT 7) mais la tâche décrit aussi une porte d'écran qui ne devrait plus
  reposer sur le rôle applicatif ; cette porte (`RoleRoute`) n'a pas été
  changée par ce plan (voir section ci-dessus). Cocher la tâche masquerait ce
  reliquat.

## Ce qu'Adel doit décider ou faire

1. **Trancher le trou de publication** (`validee` → `publiee`) : automatique
   à la validation, ou geste humain distinct à spécifier ? Rien d'autre sur
   ce domaine ne peut raisonnablement avancer avant cette décision — en
   particulier T071/T071A/T071B ne pourront être cochées tant que la
   correction (LOT 4) reste inatteignable par un usage réel.
2. **Décider si le manque de champ serveur pour les contacts SMS choisis**
   (sélection actuellement décorative à l'écran) doit être comblé, et
   comment ces contacts s'articulent avec `flash_notification_dispatches`
   (qui n'a encore aucune route d'écriture, quel que soit le canal).
3. **Décider si un écran d'édition avant validation** ("modifier" avec
   contenu édité, route déjà fonctionnelle depuis le LOT 3) est nécessaire,
   ou si "refuser puis redemander" reste acceptable.
4. **Confirmer ou changer** : qui peut proposer (LOT 2), l'ordre de tri de la
   file de validation (LOT 3), et si la porte d'écran de validation doit
   passer du rôle applicatif au service réellement accordé (T071E).
5. **Rejouer LOT 7 et LOT 8** avant toute mise en avant produit de ce
   domaine si un délai significatif s'est écoulé depuis le 5 septembre 2026 :
   ce compte rendu ne revérifie pas ces deux recettes, seulement l'absence de
   régression sur les suites unitaires et le build.
6. **`.nuit.lock`** reste non suivi dans l'arbre de travail, sans lien
   identifié avec ce plan ; à examiner séparément si utile.

## Commit

Un commit local sur `codex/lycee-connect-prototype`, aucun push. Ce lot ne
modifie aucun fichier de code des LOT 1 à 8, uniquement ce compte rendu et
les cases réellement prouvées dans `specs/002-agent-etablissement-adaptatif/tasks.md`.
`src/pages/prototype/lycee-connect.css` non touché.
