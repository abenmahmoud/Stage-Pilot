# LOT 4 — Écran de validation et de modification, informations flash (5 septembre 2026)

Périmètre exécuté : uniquement le LOT 4 du plan
`docs/operations/NIGHT_PLAN_FLASH_2026-09-05.md`. Aucune ligne de LOT 1, 2, 3,
5 ou 6 touchée. `src/pages/prototype/lycee-connect.css` non modifié (vérifié
par `git status` avant et après : absent des fichiers changés). `.nuit.lock`
préexistant, laissé tel quel.

## Sources lues avant d'écrire une ligne

- `specs/002-agent-etablissement-adaptatif/politique-operationnelle-agent-2026-2027.md`
  §13 en entier (offset ciblé par `grep` sur `§13`, pas le fichier complet).
- `specs/002-agent-etablissement-adaptatif/tasks.md`, tâches T071, T071A,
  T071B, T071C, T071D (`grep` sur `T071`), en particulier T071A (règle de
  correction) et T071B (trois ensembles, canaux ayant réellement notifié).
- `specs/project-memory.md` **non lu en entier**, conformément à la règle
  commune n°9 — pas eu besoin d'y recourir : tout le contexte utile était déjà
  dans les comptes rendus LOT1/LOT2/LOT3.
- `docs/operations/night-logs/LOT1.md`, `LOT2.md`, `LOT3.md` en entier (comptes
  rendus des lots précédents, pas `project-memory.md`).
- `shared/flash-transitions.ts`, `shared/flash-version-diff.ts`,
  `shared/flash-audience-correction.ts`, `shared/flash-expiration.ts` (LOT 2)
  en entier, pour réutiliser exactement leurs types et fonctions plutôt que
  d'en réinventer une version UI parallèle.
- `src/pages/admin/FlashProposalPage.tsx` (LOT 3) en entier, comme gabarit de
  style, de fixtures fictives et de motif de simulation (mêmes `Card`, mêmes
  bannières, même vocabulaire).
- `src/App.tsx`, `src/components/AppLayout.tsx`, `src/lib/feature-flags.ts`,
  `shared/role-access.ts`, `src/components/ui/Card.tsx` pour suivre exactement
  le motif de routage, navigation, drapeaux et composants déjà en place.
- `package.json` (section `scripts`) pour reprendre le motif exact
  d'enregistrement des scripts `test:flash*`.

## Ce qui a été livré

Un seul écran, données fictives, aucune écriture serveur, aucune lecture
serveur :

1. **`src/pages/admin/FlashValidationPage.tsx`** :
   - **Liste des propositions en attente avec leur âge** (`formatFlashAge`),
     en tête d'écran, puis une carte détaillée par proposition.
   - **Comparaison des deux versions** (quand une version précédente existe) :
     colonnes « Avant »/« Après » (titre, texte, importance, public), titre
     mis en évidence si modifié, et affichage de l'écart calculé
     (`analyzeFlashVersionGap` du LOT 2 : décisif ou de forme).
   - **Le décisif couvre aussi le changement de public** : `analyzeFlashVersionGap`
     ne compare que texte + importance (le public est une table à part, cf.
     LOT 2) ; ce lot ajoute la comparaison des deux audiences
     (`audienceChanged`) et combine `isDecisive = gap.kind === "decisif" ||
     audienceChanged`, pour que « décisif » corresponde à la liste complète de
     §13 (date, heure, lieu, annulation, **public**, importance), pas
     seulement au texte.
   - **Proposition de correction affichée seulement si décisif** : si l'écart
     est de forme et qu'aucun changement de public n'est détecté, aucune
     section de correction ne s'affiche par défaut ; un bouton « Demander
     quand même une correction » la révèle (§13 : « peut demander une
     notification même sur une correction de forme »). Si l'écart est décisif,
     la section apparaît directement avec un bouton « Refuser la correction »
     (§13 : « peut … la refuser sur un changement décisif »).
   - **Éligibilité des canaux et trois ensembles** via
     `resolveFlashAudienceTreatment` du LOT 2, à partir des canaux ayant
     *réellement* notifié la version précédente (jamais son importance
     déclarée) :
     - `correctionPossible === false` et nouvelle importance `normale` → « seul
       le site est mis à jour, aucun envoi possible » ;
     - `correctionPossible === false` et nouvelle importance non normale
       (montée depuis une version jamais notifiée, ex. normale → urgente) →
       message explicite « ceci n'est pas une correction, c'est une
       information neuve » avec le texte neuf affiché ;
     - `correctionPossible === true` → les **trois ensembles** (Maintenus,
       Retirés, Ajoutés), chacun avec son effectif, son texte propre
       (information corrigée / ligne sans détail « ne vous concerne plus » /
       information neuve) et sa **case de confirmation individuelle** ; le
       bouton « Préparer la notification de correction (simulation) » reste
       désactivé tant qu'un ensemble non vide n'est pas confirmé.
   - **Aucun envoi** : les boutons « Préparer… », « Refuser la correction »,
     « Valider », « Refuser » ne font que mettre à jour un état React local
     (`useState`) et afficher un texte de confirmation ; vérifié par le test
     statique décrit plus bas (absence de `fetch`, `supabase`, `.insert(`,
     `.from(`).
   - **Transitions d'état réellement vérifiées, pas juste supposées** : les
     boutons « Valider »/« Refuser » appellent
     `assertLegalFlashVersionTransition` du LOT 2 (double filet avec le
     trigger SQL) ; une transition refusée afficherait « Transition refusée :
     <raison> » au lieu d'être masquée.
   - **T071D, proposition expirée sans validation** : section séparée
     « Propositions expirées sans validation », utilisant
     `checkFlashProposalExpiration` du LOT 2 pour confirmer la détection (pas
     seulement une donnée supposée), avec le message factuel exact du plan
     (« cette proposition n'a pas été publiée, faute de validation à temps, et
     personne n'a été informé »), sans mise en cause d'un valideur, et un
     compteur visible (« Échecs comptés et consultables »).
   - **Responsive 320 px** : `grid-cols-1` par défaut, `sm:grid-cols-2`
     seulement à partir du point de rupture `sm`, aucune `<table>`, cibles
     tactiles `min-h-[40px]` sur les cases à cocher et les boutons.
2. **`src/lib/feature-flags.ts`** — nouveau drapeau `FLASH_VALIDATION_UI_ENABLED`,
   **fermé par défaut**, même motif que `FLASH_INFO_UI_ENABLED` : la page
   reste atteignable par son adresse pour relecture, mais n'apparaît dans la
   navigation que si ce drapeau est ouvert explicitement. Conforme à la règle
   commune n°4 : drapeau ajouté fermé, aucun drapeau existant modifié.
3. **`src/App.tsx`** — route `admin/informations-flash/valider`, protégée par
   `RoleRoute allowedRoles={CONTENT_MANAGER_ROLES}`.
4. **`src/components/AppLayout.tsx`** — lien de navigation « Valider les
   flash » (icône `ShieldCheck`, déjà importée), affiché seulement si
   `FLASH_VALIDATION_UI_ENABLED`, dans le même bloc `isAdmin || isProviseur`
   que les autres liens de validation/contenu.
5. **`scripts/test-flash-validation-page.mjs`** — script de test statique
   (analyse du code source par expressions régulières, pas de rendu réel),
   enregistré comme `npm run test:flash-validation-page` : absence de tout
   appel réseau/serveur, réutilisation effective des quatre modules du LOT 2,
   correction affichée seulement si décisif (ou demandée quand même), présence
   des trois ensembles et de leur confirmation individuelle, message factuel
   T071D sans mise en cause d'un valideur, refus de transition géré via
   `FlashTransitionError`, absence de largeur fixe et de `<table>`, cibles
   tactiles ≥ 40 px, validité des références de groupes fictives avec
   `parseFlashGroupRef` du LOT 2.

## Décision de conception à signaler : qui valide, faute de rôle dédié « référent numérique »/« DDFPT »

§13 et les tâches T071/T071A/T071B/T071C confient la validation au « référent
numérique ou à la DDFPT ». Le système de rôles de ce prototype
(`shared/role-access.ts`, type `LyceeGestRole`) ne connaît que
`superadmin | administration | agent | pp | professeur | proviseur | eleve` :
« référent numérique » et « DDFPT » n'existent dans le code que comme
**services de routage des tickets support** (`shared/support-agent-access.ts`,
`SupportService` : `referent_numerique`, `ddfpt`), pas comme rôles de compte.
Faute de rôle dédié, ce lot protège `/admin/informations-flash/valider` avec
`CONTENT_MANAGER_ROLES` (`superadmin`, `administration`, `proviseur`) : c'est
exactement le même ensemble de rôles déjà utilisé pour
`/admin/contenus`, `/admin/communications` et `/admin/envois-nominatifs`,
c'est-à-dire les comptes qui gèrent déjà la publication dans ce prototype.
**Ce n'est pas une confirmation d'Adel** que ces rôles correspondent
exactement au « référent numérique ou DDFPT » de la politique — à valider
avant toute ouverture réelle du drapeau.

## Décision de conception à signaler : le jeu d'essai fictif est vérifié par du code, pas juste écrit à la main

Plutôt que d'inventer des textes qualifiés de « décisif » ou « de forme » sans
preuve, chaque scénario du jeu d'essai a été rejoué contre les fonctions
pures du LOT 2 dans un script temporaire (`node --experimental-strip-types`,
supprimé après vérification, jamais committé) :

- `flash-002` (changement d'heure et de salle, même public) →
  `analyzeFlashVersionGap` renvoie bien `"decisif"`.
- `flash-003` (reformulation ponctuation/casse seule) →
  `analyzeFlashVersionGap` renvoie bien `"forme"`.
- `flash-004` (retrait de `personnel:enseignants`, texte identique) →
  `resolveFlashAudienceTreatment` renvoie bien
  `maintained:["niveau:terminale"]`, `removed:["personnel:enseignants"]`,
  `added:[]`, `correctionPossible:true`.
- `flash-005` (normale jamais notifiée → urgente) →
  `resolveFlashAudienceTreatment` renvoie bien `correctionPossible:false` et
  la totalité du public dans `added`.

Ces quatre résultats correspondent exactement aux quatre cas cités par le
plan de nuit (changement décisif, correction de forme, audience réduite,
normale → urgente). Le cinquième scénario du jeu d'essai (`flash-001`,
nouvelle proposition sans version précédente) n'a pas de calcul à vérifier :
il n'y a rien à comparer.

## Hors périmètre assumé (à ne pas confondre avec « fait »)

- **Aucune lecture depuis `flash_info_versions` / `flash_info_audiences` /
  `flash_notification_dispatches`** (tables du LOT 1) : comme annoncé dans le
  compte rendu du LOT 3 (« LOT 4 doit lire les propositions réellement
  stockées »), ce lot ne le fait pas — il reprend le même mode simulation que
  LOT 3, avec un jeu d'essai fictif local. Le branchement réel à la base
  reste à faire, et Docker Desktop n'était de toute façon pas disponible pour
  rejouer une pile Supabase locale pendant cette session (aucune migration
  n'a été touchée par ce lot, donc la question ne se posait pas directement
  ici, mais elle reste ouverte pour un lot de branchement futur).
- **Les décisions de validation/refus/préparation de correction ne sont
  jamais persistées** : elles vivent uniquement dans l'état React de la page
  et disparaissent au rechargement. Aucune trace de décision, d'auteur ou
  d'écart n'est écrite où que ce soit (T071A demande de « conserver avec la
  version l'écart analysé, la proposition et la décision humaine » : cette
  conservation reste à brancher sur la base du LOT 1).
- **Le comptage des échecs (T071D, « rendre le compte de ces échecs
  consultable ») est illustré par un jeu d'essai fixe de deux propositions
  expirées**, pas par un vrai compteur agrégé sur des données réelles.
- **`FLASH_PROPOSAL_ROLES` (LOT 3) et le rôle de validation ne sont pas reliés
  dans ce lot** : rien n'empêche techniquement dans ce prototype qu'un même
  compte `administration` propose (`FLASH_PROPOSAL_ROLES` l'inclut) et valide
  (`CONTENT_MANAGER_ROLES` l'inclut aussi) sa propre proposition. §13 ne
  l'interdit pas explicitement non plus ; à clarifier avec Adel si une
  séparation stricte proposant/valideur est attendue.
- **Aucun test de rendu réel dans un navigateur** (pas de Playwright installé,
  session non interactive sans outil de capture d'écran) : la vérification à
  320 px s'appuie sur des classes Tailwind mobile-first et un test
  automatisé qui relit le code source, pas sur une capture d'écran réelle.

## Preuves réellement exécutées

Toutes les commandes ci-dessous ont été lancées dans cette session, pas
supposées :

1. `node node_modules/typescript/bin/tsc --noEmit` → **succès**, aucune sortie
   d'erreur.
2. `npm run test:flash-validation-page` (nouveau script) → **succès**, 10/10
   tests.
3. Vérification manuelle des quatre scénarios du jeu d'essai contre les
   fonctions pures du LOT 2 (script temporaire non committé,
   `node --experimental-strip-types`, supprimé après exécution) → **succès**,
   les quatre résultats correspondent exactement à l'attendu (détail
   ci-dessus).
4. `npm run test:flash` (régression des quatre modules du LOT 2, inchangés
   par ce lot) → **succès**, 27/27 tests (6 + 7 + 8 + 6), identique aux LOT 2
   et LOT 3.
5. `npm run build` (`tsc --noEmit && vite build`) → **succès**, build terminé
   en 22.01 s. `FlashValidationPage-*.js` apparaît comme chunk séparé
   (20.18 kB, lazy-loadé). Seul avertissement : chunks > 500 kB (`xlsx`,
   `index`), préexistant et documenté dans LOT 1/LOT 2/LOT 3, sans rapport
   avec ce lot.
6. `npm run test:preview-security-gate` → **succès**, code de sortie 0
   capturé explicitement (`REAL_EXIT_CODE=0`), suite complète exécutée
   jusqu'à `test:migration-integrity` inclus
   (`{"migrations":97,"uniqueVersions":97,"checkedReferences":77,...}`,
   inchangé — ce lot n'ajoute aucune migration).
7. `git status --porcelain` avant de committer → confirme que seuls les
   fichiers de ce lot ont changé : `package.json`, `src/App.tsx`,
   `src/components/AppLayout.tsx`, `src/lib/feature-flags.ts` (modifiés),
   `scripts/test-flash-validation-page.mjs` et
   `src/pages/admin/FlashValidationPage.tsx` (nouveaux) ;
   `src/pages/prototype/lycee-connect.css` absent de la liste ; `.nuit.lock`
   présent avant ce lot, non touché.

Aucune commande n'a échoué. Rien à noter comme « échec préexistant à
masquer ».

## Ce qui reste supposé, pas prouvé

- Que `CONTENT_MANAGER_ROLES` est le bon proxy pour « référent numérique ou
  DDFPT » (voir décision de conception ci-dessus) — c'est un choix cohérent
  avec le reste du prototype, pas une confirmation d'Adel.
- Que l'absence de séparation stricte entre `FLASH_PROPOSAL_ROLES` et les
  rôles de validation est acceptable au regard de §13.
- Le rendu réel à 320 px et au format ordinateur n'a pas été capturé dans un
  navigateur, seulement vérifié structurellement (voir « Hors périmètre
  assumé »).
- La pertinence des textes exacts affichés pour chaque ensemble (maintenus/
  retirés/ajoutés) n'a pas été relue par Adel mot à mot ; seule leur
  correspondance avec les trois définitions de §13 (information corrigée /
  ligne sans détail / information neuve) est vérifiée.

## Pour la suite (LOT 5 et LOT 6, à lire avant de coder)

- LOT 5 doit rejouer les scénarios déjà vérifiés ici (décisif, forme,
  audience réduite, audience élargie, normale → urgente) comme de vraies
  fixtures adverses avec preuves exécutées, pas seulement comme un jeu
  d'essai illustratif d'écran : ce lot a vérifié les *fonctions* du LOT 2 sur
  ces cas, pas le *comportement bout en bout de l'écran* face à un
  adversaire.
- LOT 5 doit aussi vérifier explicitement qu'aucun code de ce lot ne peut
  émettre un message (déjà couvert par `test:flash-validation-page`, mais à
  confirmer indépendamment comme demandé par le plan).
- Le branchement réel sur les tables du LOT 1 (lecture des propositions,
  écriture des décisions, comptage réel des échecs T071D) reste entièrement
  à faire — ni LOT 3 ni LOT 4 ne le font, tous deux fonctionnent sur des jeux
  d'essai locaux.
- La question du rôle « référent numérique ou DDFPT » (ci-dessus) doit être
  tranchée avec Adel avant toute ouverture du drapeau
  `FLASH_VALIDATION_UI_ENABLED` en dehors d'un usage de relecture.
