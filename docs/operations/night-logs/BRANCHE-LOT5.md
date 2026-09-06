# LOT 5 — L'écran, monté pour de vrai

Plan : `docs/operations/PLAN_BRANCHEMENT_COFFRE_2026-09-06.md`, §LOT 5.
Portée stricte : monter `CodeVaultSecureDisplay` sur la route réelle du
LOT 3 (`POST /api/vault/ent-inactif`), brancher `onExpire` sur une nouvelle
demande de preuve d'identité, et corriger le bug du minuteur d'effacement du
presse-papier annulé au démontage. Aucune recette adverse de bout en bout
avec balayage anti-fuite (LOT 6), aucune clôture de tâche Spec Kit (LOT 7).

## Le point le plus important de ce lot : la valeur du code n'est toujours nulle part

Avant d'écrire une ligne d'écran, vérification faite sur tout le dépôt :
`decryptVaultCodeValue` (`shared/code-vault-crypto.ts`, LOT 1) n'est appelé
**par aucun fichier** de `api/` ou `shared/`. Les routes du LOT 3
(`api/_shared/code-vault-ent-inactif-route.ts`) et du LOT 4
(`api/_shared/code-vault-service-delivery-route.ts`) le disent explicitement
dans leur en-tête : elles s'arrêtent à la décision d'autorisation, à
l'attribution et à la comptabilité d'affichage, et ne déchiffrent ni ne
renvoient jamais la valeur. `writeVaultCodeValue` (LOT 1) elle-même n'est
appelée par aucune route : aucun code réel n'a d'ailleurs jamais été écrit
dans `code_vault_private_rows` par le code applicatif.

Conséquence assumée, pas corrigée en douce : **`CodeVaultSecureDisplay` ne
peut aujourd'hui être monté avec aucune valeur réelle**, quelle que soit la
route qui l'appelle. Deux choix étaient possibles :

1. Ajouter un point de lecture (symétrique de `code-vault-write.ts`) pour que
   la route du LOT 3 déchiffre et renvoie la valeur au moment de l'affichage.
2. Monter l'écran avec le contrat actuel de la route (aucune valeur), et
   documenter le manque plutôt que de le combler.

Choix retenu : **le 2.** `CLAUDE.md` classe les « codes d'accès » et les
« actions officielles » parmi les sujets à validation humaine explicite ;
ouvrir un nouveau chemin de lecture d'un secret chiffré est exactement ce
type de décision, et aucun lot du plan (ni le 3, ni le 4, ni le 5) ne
l'a nommée. Ce n'est pas une garantie technique qui manque ici — le
chiffrement, lui, est prouvé (LOT 1) — c'est une décision de périmètre qui
n'a jamais été prise. **Trou bloquant, à trancher avec Adel avant tout LOT
qui prétendrait afficher un vrai code** : sans point de lecture, T064
(« journal sans valeur secrète ») peut être vraie, mais aucun parcours du
coffre ne peut jamais remettre un code à qui que ce soit, quel que soit le
nombre de lots suivants.

## Ce qui a été livré malgré ce trou

- `shared/code-vault-ent-inactif-screen.ts` — décision pure
  `decideEntInactifScreenState`, même esprit que `decideFlashValidationRoute`
  (`shared/flash-validation-route.ts`) : traduit la réponse de la route du
  LOT 3 en état d'écran (`denied`, `send_proof`, `awaiting_verification`,
  `form_fallback`, `password_reset_invited`, `revealed`), sans réseau ni DOM.
  L'état `revealed` porte un champ `value: string | null`, toujours `null`
  aujourd'hui pour la raison ci-dessus, mais présent pour que la page reste
  prête sans modification le jour où un point de lecture existera.
  `ENT_INACTIF_PHASE_AFTER_DISPLAY_EXPIRY` fixe la phase à redemander après
  une expiration : toujours `before_proof`, jamais `verified` — le même
  garde-fou que le défaut n°1 du LOT 3, appliqué ici côté écran.
- `src/pages/coffre/CoffreEntInactifPage.tsx` — écran réel, monté sur
  `POST /api/vault/ent-inactif` (aucune route imaginée), qui fait progresser
  la phase à partir d'actions explicites de la personne (canal de preuve
  choisi, « preuve reçue », « vérification confirmée »), jamais d'elle-même —
  même principe que `shared/code-vault-journeys.ts` (« c'est à l'appelant de
  faire progresser cette phase à partir d'événements réels »). Récupère
  l'année scolaire via `GET /api/etablissement` (déjà utilisé par
  `ParametresPage.tsx`, lecture ouverte à tout utilisateur connecté), plutôt
  que de la deviner ou de la coder en dur. Monte réellement
  `CodeVaultSecureDisplay` quand l'état `revealed` porte une valeur non nulle,
  avec `onExpire={restartAfterExpiryOrGap}` — qui redemande une preuve
  d'identité (`before_proof`), jamais une reprise à `verified`. Quand l'état
  `revealed` ne porte pas de valeur (le cas réel aujourd'hui), affiche un
  panneau qui nomme explicitement le manque plutôt que d'inventer un code, et
  propose le même redémarrage.
- `src/App.tsx` — route protégée `coffre/ent-inactif`, rôles `eleve` et
  `professeur` (mêmes rôles que `api/vault/ent-inactif.ts`), import paresseux
  au même endroit que les autres pages.
- **Bug corrigé, exactement celui nommé par le plan** :
  `src/components/CodeVaultSecureDisplay.tsx` effaçait la promesse
  d'effacement du presse-papier. Le composant annulait
  (`clearTimeout(clipboardClearTimeoutRef.current)`) le minuteur de 30 s dans
  un `useEffect` de nettoyage exécuté **au démontage** — donc chaque fois que
  l'élève quitte l'écran, ce qui est précisément ce qu'il fait pour aller
  coller son code ailleurs. Correctif : suppression de ce `useEffect` de
  nettoyage ; le `setTimeout` est global et continue de tourner après le
  démontage, sans dépendre du cycle de vie React. Le remplacement du minuteur
  lors d'une seconde copie (avant un nouveau démontage) reste inchangé, dans
  `handleCopy`.

## Bug réellement démontré, pas seulement corrigé par relecture

Avant de coder le correctif, `scripts/test-code-vault-secure-display.mjs` a
reçu un nouveau test comptant les occurrences de
`clearTimeout(clipboardClearTimeoutRef.current)` (attendu : une seule, dans
`handleCopy`). Sur le code d'origine, ce test aurait compté deux occurrences
(dont celle du nettoyage au démontage) et échoué — vérifié après coup en
restaurant temporairement l'ancien fichier (`git stash`) : le test échoue
bien avant le correctif.

Preuve plus forte, en navigateur réel (Chromium local,
`scripts/test-code-vault-secure-display-browser-recette.mjs`, déjà existante
depuis le LOT 6 du plan du 5 septembre) : un scénario a été ajouté qui monte
le composant, copie la valeur fictive, **démonte le composant tout de
suite**, attend 31 secondes (plus que le délai d'effacement de 30 s), puis
relit le presse-papier réel du navigateur.

- **Avant le correctif** (vérifié en restaurant l'ancien fichier par
  `git stash` puis en rejouant la recette) : le presse-papier contient
  toujours `FICTIF-LOT6-9F3K-2QRT` après le démontage et l'attente — la
  recette échoue avec `AssertionError`, valeur attendue `""`, valeur reçue la
  valeur fictive. Le bug est donc réel, pas seulement supposé par lecture du
  code.
- **Après le correctif** (état livré par ce lot) : le presse-papier est bien
  vide après démontage et attente — la recette passe, 17 assertions au lieu
  de 16 (le scénario ajouté), résultat stable.

## Non-régression

Sans base, au vert : `npm run test:code-vault-policy` (16),
`npm run test:code-vault-delivery-policy` (5),
`npm run test:code-vault-journeys` (8),
`npm run test:code-vault-write-point` (7),
`npm run test:code-vault-pg-error` (5),
`npm run test:code-vault-ent-inactif-route` (6),
`npm run test:code-vault-service-delivery-route` (14),
`npm run test:code-vault-messagerie-academique-route` (8),
`npm run test:code-vault-support-escalation` (4).

## Preuves réellement exécutées

- `npm run test:code-vault-ent-inactif-screen` — 8/8, sans base.
- `npm run test:code-vault-ent-inactif-page` — 6/6, vérification statique de
  la page et de son branchement dans `src/App.tsx`.
- `npm run test:code-vault-secure-display` — 10/10 (9 existants + le nouveau
  test de non-régression du démontage).
- `npm run recipe:local-code-vault-secure-display-browser` — Chromium réel,
  **17 assertions**, incluant le nouveau scénario démontage/presse-papier
  décrit ci-dessus. Rejoué une fois avec l'ancien composant (`git stash`) pour
  confirmer l'échec attendu, puis une fois avec le correctif restauré pour
  confirmer le succès.
- `node node_modules/typescript/bin/tsc --noEmit` — aucune erreur.
- `npx vite build` — succès (Windows, aucun problème rencontré aujourd'hui),
  `CoffreEntInactifPage` apparaît comme chunk séparé
  (`dist/assets/CoffreEntInactifPage-*.js`, 10.11 kB), même avertissement
  préexistant de taille de chunk sur d'autres pages, sans rapport avec ce lot.
- `npm run test:preview-security-gate` — code de sortie 0.
- `npm run test:spec-integrity` — 5 specs, 635 tâches recensées, inchangé.

## Ce qui reste supposé, pas prouvé

- **Aucune valeur de code n'a jamais été affichée dans un navigateur réel
  via la page `CoffreEntInactifPage`** — voir la section « trou bloquant »
  ci-dessus. La recette Chromium de ce lot exerce le composant seul, avec une
  valeur fictive passée en props directement (même méthode qu'au LOT 6 du
  plan du 5 septembre), pas la page réelle avec une vraie requête HTTP.
- Aucune requête HTTP réelle contre `api/vault/ent-inactif.ts` depuis cette
  page : comme au LOT 3, la route elle-même reste prouvée par
  `handleEntInactifVaultRequest` appelée directement dans les tests, pas par
  un serveur Vercel dev démarré avec un jeton Supabase valide.
- Le canal de preuve (email/téléphone) et la « vérification confirmée » sont
  des actions cliquées par la personne dans cette page, pas un mécanisme réel
  d'envoi ni de vérification de preuve — aucune route de ce type n'existe
  dans le périmètre du coffre (même limite déjà posée par le LOT 4 pour
  `emailVerifiable`). La porte réelle reste `decideVaultAccess` côté serveur ;
  rien ici ne permet de contourner un refus.
- Le panneau affiché quand `revealed` ne porte pas de valeur montre
  `remainingDisplaysToday` : ce chiffre est réel (renvoyé par la route), mais
  n'a aujourd'hui aucune conséquence visible pour la personne puisqu'aucun
  code ne s'affiche jamais.

## Portée délibérément non couverte par ce lot

- Aucun point de lecture/déchiffrement pour `code_vault_private_rows` —
  décision à trancher avec Adel (voir « trou bloquant » ci-dessus), pas un
  numéro de lot.
- Aucune recette adverse de bout en bout avec balayage anti-fuite sur le
  scénario complet des cinq parcours — LOT 6.
- Aucune clôture de tâche Spec Kit (T064, T069) — LOT 7.
- Cantine, Koxo : même composant, même défaut de minuteur corrigé une fois
  pour toutes (le composant est partagé), mais aucun écran dédié monté pour
  ces deux parcours dans ce lot — non demandé par le plan pour le LOT 5, qui
  ne nomme que la route du LOT 3 (ENT inactif).

## Périmètre respecté

Aucun import de personne réelle, aucun email envoyé, aucun drapeau activé.
Aucune mutation Vercel, Supabase distant, VPS, DNS. Aucune lecture de
`~/Documents/LyceeGest-DONNEES-PRIVEES`. Aucun `git push`. Travail
entièrement fait dans cette session, aucune délégation à un agent en
arrière-plan. Commit local unique pour ce lot, avec chemins explicites,
limité aux fichiers du LOT 5 (`shared/code-vault-ent-inactif-screen.ts`,
`src/pages/coffre/CoffreEntInactifPage.tsx`, `src/App.tsx`,
`src/components/CodeVaultSecureDisplay.tsx`,
`scripts/test-code-vault-ent-inactif-screen.mjs`,
`scripts/test-code-vault-ent-inactif-page.mjs`,
`scripts/test-code-vault-secure-display.mjs`,
`scripts/test-code-vault-secure-display-browser-recette.mjs`, `package.json`,
ce compte rendu). Les fichiers non liés à ce lot déjà présents dans l'arbre
de travail avant cette session (`docs/operations/PLAN_CONNAISSANCE_OB1_2026-09-05.md`,
`nuit.ps1`, `.nuit-coffre.lock`, `nuit-coffre.ps1`, et le plan
`PLAN_BRANCHEMENT_COFFRE_2026-09-06.md` lui-même) n'ont pas été modifiés par
ce lot et ne sont pas inclus dans ce commit.
