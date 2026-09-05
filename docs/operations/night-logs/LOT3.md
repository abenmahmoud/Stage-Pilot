# LOT 3 — Écran de proposition, informations flash (5 septembre 2026)

Périmètre exécuté : uniquement le LOT 3 du plan
`docs/operations/NIGHT_PLAN_FLASH_2026-09-05.md`. Aucune ligne de LOT 1, 2, 4,
5 ou 6 touchée. `src/pages/prototype/lycee-connect.css` non modifié (vérifié
par `git status` avant et après : absent des fichiers changés). `.nuit.lock`
préexistant, laissé tel quel.

## Sources lues avant d'écrire une ligne

- `specs/002-agent-etablissement-adaptatif/politique-operationnelle-agent-2026-2027.md`
  §13 : lu dans le résumé fidèle déjà repris en tête du plan de nuit (règle
  métier), confirmé contre `docs/operations/night-logs/LOT1.md` et
  `docs/operations/night-logs/LOT2.md` (comptes rendus des lots précédents,
  pas `specs/project-memory.md`).
- `specs/002-agent-etablissement-adaptatif/tasks.md`, tâches T071, T071A,
  T071B, T071C, T071D (`grep` sur `T071`) — relues en entier pour ce lot,
  en particulier T071C (canal supplémentaire, jamais le canal d'urgence,
  renvoi vers la messagerie existante) et T071 (versionner texte/audience/
  importance/canaux/expiration).
- `specs/project-memory.md` **non lu en entier**, conformément à la règle
  commune n°9 — pas eu besoin d'y recourir.
- `shared/flash-version-diff.ts`, `shared/flash-audience-correction.ts`,
  `shared/flash-transitions.ts`, `shared/flash-expiration.ts` (LOT 2) en
  entier, pour réutiliser les mêmes constantes et validations
  (`FLASH_IMPORTANCE_LEVELS`, `FLASH_NOTIFICATION_CHANNELS`,
  `parseFlashGroupRef`) plutôt que d'en réinventer une version UI parallèle.
- `docs/operations/night-logs/LOT1.md` en entier, pour la contrainte SQL
  exacte sur les canaux par importance (normale = aucun, importante = push
  obligatoire + email facultatif, urgente = push et email obligatoires + sms
  facultatif rattaché à un contact précis, jamais à un groupe).
- `src/pages/admin/EnvoisNominatifsPage.tsx` en entier, comme gabarit de
  style pour un écran d'administration en simulation (mêmes `Card`, mêmes
  bannières d'avertissement, même vocabulaire « simulation », mêmes classes
  Tailwind mobile-first).
- `src/App.tsx`, `src/components/AppLayout.tsx`, `src/lib/feature-flags.ts`,
  `shared/role-access.ts` pour suivre exactement le motif de routage,
  navigation et drapeaux déjà en place pour `/admin/envois-nominatifs`.

## Ce qui a été livré

Un seul écran, données fictives, aucune écriture serveur :

1. **`src/pages/admin/FlashProposalPage.tsx`** — formulaire de proposition
   d'information flash :
   - Texte (titre + corps), public (cases à cocher sur six groupes fictifs
     invention : classes, niveau, personnels, parents cantine — aucun nom
     réel).
   - Importance : une suggestion très simple par mots-clés (`suggestFlashImportance`,
     locale à cette page) est affichée avec sa justification, mais **rien
     n'est présélectionné** — la personne doit cocher explicitement l'un des
     trois niveaux (`normale`/`importante`/`urgente`) avant de pouvoir
     préparer la proposition. Un bouton « Reprendre » permet d'adopter la
     suggestion en un geste, sans jamais la rendre automatique.
   - Canaux : dérivés de l'importance choisie selon la règle exacte du LOT 1
     (`flashChannelRequirement`) — aucun pour normale, push obligatoire/email
     facultatif pour importante, push et email obligatoires/sms facultatif
     pour urgente. Le SMS ne peut cibler que des contacts individuels fictifs
     (jamais un groupe), conformément à « SMS aux seules personnes choisies ».
   - Expiration : champ `datetime-local` obligatoire (attribut HTML `required`
     **et** vérification JS qu'une date future a été saisie) ; impossible de
     préparer une proposition sans elle.
   - Bannière permanente, avant et après préparation : une proposition en
     attente n'a prévenu personne, avec un lien vers la messagerie du lycée
     (même adresse déjà utilisée en lecture seule dans
     `src/pages/prototype/LyceeConnectPrototype.tsx`, reprise à l'identique
     plutôt qu'inventée) pour la personne qui doit joindre son public tout de
     suite.
   - Le bouton final n'affiche qu'un récapitulatif local (état React) : aucun
     `fetch`, aucun appel Supabase, aucune écriture — vérifié par le test
     décrit plus bas.
2. **`shared/role-access.ts`** — nouvelle constante `FLASH_PROPOSAL_ROLES`
   (`superadmin`, `administration`, `proviseur`, `professeur`, `pp`), pour
   coller à l'exigence exacte du §13 (« un personnel ou professeur vérifié
   propose »), distincte de `CONTENT_MANAGER_ROLES` qui ne couvre pas
   `professeur`/`pp`.
3. **`src/lib/feature-flags.ts`** — nouveau drapeau `FLASH_INFO_UI_ENABLED`,
   **fermé par défaut** (`import.meta.env.VITE_FLASH_INFO_UI_ENABLED === "true"`),
   même motif que `NOMINATIVE_SEND_UI_ENABLED` : la page reste atteignable
   par son adresse pour relecture, mais n'apparaît dans la navigation que si
   ce drapeau est ouvert explicitement. Conforme à la règle commune n°4
   (« aucun drapeau ouvert ») : ce nouveau drapeau est ajouté fermé, aucun
   drapeau existant n'a été touché.
4. **`src/App.tsx`** — route `admin/informations-flash/proposer`, protégée
   par `RoleRoute allowedRoles={FLASH_PROPOSAL_ROLES}`.
5. **`src/components/AppLayout.tsx`** — lien de navigation « Information
   flash » (icône `Zap`), affiché seulement si `FLASH_INFO_UI_ENABLED`, dans
   le même bloc que les autres liens `isAdmin || isProviseur`.
6. **`scripts/test-flash-proposal-page.mjs`** — script de test statique
   (analyse du code source par expressions régulières, pas de rendu réel),
   enregistré comme `npm run test:flash-proposal-page` : absence de tout
   appel réseau/serveur, présence de l'avertissement « n'a prévenu
   personne » et du lien vers la messagerie, expiration `required`,
   importance jamais présélectionnée, SMS rattaché à des contacts et non à
   un groupe, absence de largeur fixe susceptible de casser l'écran à
   320 px, absence de `<table>` (pas de scroll horizontal forcé), cibles
   tactiles ≥ 40 px, et validité des références de groupes fictives avec
   `parseFlashGroupRef` du LOT 2 (double filet, comme le reste du projet).

## Décision de conception à signaler : la suggestion d'importance est une heuristique de démonstration, pas une capacité d'agent prouvée

`suggestFlashImportance` (dans la page, pas dans `shared/`) classe le texte
par une simple recherche de mots-clés (« annulé », « urgent », « évacuation »,
etc. → urgente ; « changement », « report », « nouvelle salle », etc. →
importante ; sinon normale). C'est délibérément **hors du périmètre testé du
LOT 2** : ce n'est pas une fonction pure partagée avec des scénarios
adverses, c'est une illustration UI de « l'agent suggère ». Elle n'a aucune
valeur de preuve métier et peut se tromper largement sur un texte réel. Le
point non négociable, lui, est bien appliqué et vérifié par le test statique :
la suggestion n'est **jamais** appliquée automatiquement, la personne doit
choisir explicitement un niveau avant de pouvoir préparer la proposition.

## Décision de conception à signaler : la messagerie « ENT » du plan est en réalité le Webmail déjà présent dans le code

Le résumé du plan de nuit dit « renvoie vers la messagerie ENT ». Le seul lien
de messagerie professionnelle déjà présent dans ce dépôt est `WEBMAIL_URL`
(`src/pages/prototype/LyceeConnectPrototype.tsx`, ligne 179 —
`https://mail.lycee-blaise-cendrars-sevran.fr/`), utilisé ailleurs uniquement
comme lien externe en lecture (`target="_blank"`, aucune mutation). Aucun
lien ENT séparé n'existe dans le code. Plutôt que d'inventer une URL ENT non
vérifiée (interdiction explicite de deviner des URLs), ce lot réutilise cette
même adresse Webmail déjà utilisée par l'application. **À confirmer avec
Adel** : si un ENT distinct existe réellement et doit être ce lien à la
place, ou en complément.

## Hors périmètre assumé (à ne pas confondre avec « fait »)

- Aucune donnée n'est lue depuis `flash_infos`/`flash_info_versions` (tables
  du LOT 1) : le formulaire ne fait que produire un objet local
  (`PreparedFlashProposal`) qui n'est jamais persisté. Le branchement réel
  (écriture d'une proposition, lecture de l'auteur vérifié) est hors
  périmètre du LOT 3 et n'est pas simulé au-delà de l'aperçu affiché.
- L'authenticité du compte proposant (« personnel ou professeur vérifié »)
  n'est pas illustrée sur cet écran : la protection réelle vient de
  `RoleRoute`/`FLASH_PROPOSAL_ROLES`, pas d'un élément visuel dédié.
- Le lien de navigation n'est ajouté que dans le bloc `isAdmin || isProviseur`
  de `AppLayout.tsx`. Un compte `professeur` ou `pp` peut atteindre la page
  par son adresse (`RoleRoute` l'autorise, cohérent avec §13), mais n'a pas
  encore d'entrée dans son propre menu — à compléter si un lot futur ajoute
  une navigation dédiée aux professeurs.
- Aucun test de rendu réel dans un navigateur (pas de Playwright installé
  dans ce projet, session non interactive sans outil de capture d'écran) :
  la vérification à 320 px et au format ordinateur s'appuie sur (a) des
  classes Tailwind mobile-first sans largeur fixe (`grid-cols-1` par défaut,
  `sm:grid-cols-2` seulement à partir du point de rupture `sm`, aucune
  `<table>` à défilement forcé) et (b) un test automatisé qui vérifie ces
  propriétés par lecture du code source (`test:flash-proposal-page`). **Ce
  n'est pas une preuve visuelle réelle**, seulement une preuve structurelle.

## Preuves réellement exécutées

Toutes les commandes ci-dessous ont été lancées dans cette session, pas
supposées :

1. `node node_modules/typescript/bin/tsc --noEmit` → **succès**, aucune
   sortie d'erreur (exécuté deux fois : une fois juste après l'écriture de
   la page, une fois après l'ajout du script de test — les deux fois sans
   erreur).
2. `npm run test:flash-proposal-page` (nouveau script) → **succès**, 7/7
   tests.
3. `npm run test:flash` (regression des quatre modules du LOT 2, inchangés
   par ce lot) → **succès**, 27/27 tests (6 + 7 + 8 + 6), identique au
   résultat du LOT 2.
4. `npm run build` (`tsc --noEmit && vite build`) → **succès**, build
   terminé en 10.19 s. `FlashProposalPage-*.js` apparaît bien comme chunk
   séparé (15.25 kB, lazy-loadé). Seul avertissement : chunks > 500 kB
   (`xlsx`, `index`), préexistant et documenté dans LOT 1/LOT 2, sans rapport
   avec ce lot.
5. `npm run test:preview-security-gate` → **succès**, code de sortie 0
   capturé explicitement (`REAL_EXIT_CODE=0`), suite complète exécutée
   jusqu'à `test:migration-integrity` inclus
   (`{"migrations":97,"uniqueVersions":97,...}`, inchangé — ce lot n'ajoute
   aucune migration).
6. `git status --porcelain` avant de committer → confirme que seuls les
   fichiers de ce lot ont changé : `package.json`, `shared/role-access.ts`,
   `src/App.tsx`, `src/components/AppLayout.tsx`, `src/lib/feature-flags.ts`
   (modifiés), `scripts/test-flash-proposal-page.mjs` et
   `src/pages/admin/FlashProposalPage.tsx` (nouveaux) ;
   `src/pages/prototype/lycee-connect.css` absent de la liste ; `.nuit.lock`
   présent avant ce lot, non touché.

Aucune commande n'a échoué. Rien à noter comme « échec préexistant à
masquer ».

## Ce qui reste supposé, pas prouvé

- La pertinence de l'heuristique de suggestion d'importance (mots-clés) n'a
  aucune valeur de preuve métier, voir plus haut.
- Le rendu réel à 320 px et au format ordinateur n'a pas été capturé dans un
  navigateur (aucun outil de capture disponible dans cette session non
  interactive) : seule une vérification structurelle du code source a été
  faite, voir « Hors périmètre assumé ».
- L'adresse de messagerie utilisée (Webmail du lycée) est une supposition
  raisonnable faute de lien ENT distinct dans le code existant, pas une
  confirmation d'Adel que c'est le bon canal pour ce cas précis.
- Aucune vérification que `professeur`/`pp` peuvent réellement se connecter
  et atteindre cette route dans ce prototype (le mécanisme `RoleRoute` est
  identique à celui déjà utilisé ailleurs, mais aucun compte de test
  `professeur` n'a été exercé dans cette session).

## Pour la suite (LOT 4 à LOT 6, à lire avant de coder)

- LOT 4 doit lire les propositions réellement stockées (LOT 1) plutôt que
  l'objet local produit ici : ce lot ne fournit qu'un formulaire de saisie,
  pas un flux de données bout en bout.
- Si un ENT distinct du Webmail existe réellement, corriger `WEBMAIL_URL`
  utilisé ici (dupliqué depuis `LyceeConnectPrototype.tsx`) ou factoriser
  cette constante dans un module partagé plutôt que la garder dupliquée à
  deux endroits.
- `FLASH_PROPOSAL_ROLES` (`shared/role-access.ts`) est disponible pour LOT 4
  si l'écran de validation doit distinguer les rôles qui proposent de ceux
  qui valident (référent numérique/DDFPT) — à ne pas confondre les deux
  ensembles de rôles.
