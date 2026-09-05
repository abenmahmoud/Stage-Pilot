# LOT 4 — Composant sécurisé d'affichage

Plan : `docs/operations/PLAN_COFFRE_CODES_2026-09-05.md`, §LOT 4. Portée
stricte : uniquement le composant frontend d'affichage d'un code déjà
révélé. Pas de route HTTP, pas de parcours utilisateur (LOT 5), pas de
branchement sur `api/_shared/code-vault-assignment.ts` (LOT 3) — ce composant
reçoit une valeur déjà autorisée et révélée par son appelant futur, il ne va
la chercher nulle part lui-même.

## Ce qui a été livré

- `src/components/CodeVaultSecureDisplay.tsx` : composant React seul, non
  monté sur aucune route pour l'instant (aucun appelant n'existe encore, ce
  sera le LOT 5). Réutilise `VAULT_DISPLAY_VISIBILITY_SECONDS` et
  `isVaultDisplayStillVisible` du LOT 3 (`shared/code-vault-policy.ts`)
  plutôt que de réimplémenter l'expiration de 30 minutes.
  - **Compte à rebours visible** : `role="timer"`, remis à jour chaque
    seconde, format `mm:ss`.
  - **Bouton de copie** : `navigator.clipboard.writeText`, jamais une
    sélection de texte dans un champ. La valeur est rendue dans un élément
    `<code>` non éditable, jamais un `<input>`, pour ne pas être proposée à
    l'enregistrement par un gestionnaire de mots de passe.
  - **Non téléchargeable** : aucun lien, aucun attribut `download`, aucun
    `createObjectURL`.
  - **Disparaît à l'expiration** : dès que `isVaultDisplayStillVisible`
    devient faux, le composant retire la valeur de l'affichage et montre un
    message demandant une nouvelle vérification d'identité ; `onExpire` est
    appelé une seule fois (`hasFiredExpireRef`), pour que l'appelant futur
    (LOT 5) puisse redemander une preuve d'identité sans dupliquer l'appel.
  - **Presse-papier non persistant** : après une copie, un
    `navigator.clipboard.writeText("")` est programmé 30 secondes plus
    tard, pour ne pas laisser la valeur indéfiniment accessible par collage.
  - **Aucune fuite structurelle** : pas de `document.title`, pas de
    `window.location`, pas de paramètre d'URL, pas de `console.log`.
  - **320 px à 1 440 px** : pas de largeur fixe, `w-full`, cible tactile du
    bouton de copie à 40 px minimum, aucun `<table>`.
- `scripts/test-code-vault-secure-display.mjs` + script npm
  `test:code-vault-secure-display` : vérifications statiques du fichier
  source, même méthode que `scripts/test-flash-proposal-page.mjs` (ce dépôt
  n'a pas de moteur DOM de test, donc pas de rendu réel — voir plus bas ce
  que cela ne prouve pas).

## Preuves réellement exécutées

- `node node_modules/typescript/bin/tsc --noEmit` : aucune erreur.
- `npx vite build` : succès (Windows), le composant compile et se bundle
  sans erreur (non inclus dans un chunk de route car non encore importé
  nulle part — attendu, voir « ce qui reste supposé »).
- `npm run test:code-vault-secure-display` : **9/9** assertions statiques
  passées (voir liste des garanties ci-dessus, chacune correspond à un test
  nommé dans le script).
- `npm run test:preview-security-gate` : code de sortie `0`, jusqu'à
  `test:migration-integrity` → `104` migrations, `104` versions uniques
  (inchangé, ce lot ne touche aucune migration).

## Ce qui reste supposé, pas prouvé

- **Aucun rendu réel dans un navigateur.** Les tests sont des vérifications
  du code source par expression régulière, pas un rendu React avec horloge
  simulée. En particulier :
  - le décompte du compte à rebours (`setInterval` chaque seconde) et la
    disparition effective au bout de 30 minutes n'ont pas été observés à
    l'écran, seule la présence du code qui les implémente a été vérifiée ;
  - le comportement réel de `navigator.clipboard.writeText` (succès, refus
    de permission, effacement après 30 secondes) n'a pas été exercé dans un
    vrai navigateur ; il peut échouer silencieusement sur certains
    navigateurs (Safari/iOS restreint l'écriture différée dans le
    presse-papier), ce que le code accepte déjà (`catch` silencieux, pas de
    nouvelle tentative) mais qui n'a pas été observé en conditions réelles ;
  - le rendu à 320 px et 1 440 px n'a pas été capturé dans un navigateur
    (Playwright existe dans les devDependencies mais n'a pas été utilisé
    ici, conformément au périmètre strict du lot) — seule l'absence de
    largeur fixe dans le code a été vérifiée.
- **« Aucune capture automatique »** n'est vérifiable par un test : le
  composant évite les vecteurs connus (pas de champ de saisie proposé à un
  gestionnaire de mots de passe, pas de méta-donnée, pas de titre de page),
  mais rien n'empêche une capture d'écran manuelle ou un outil
  d'accessibilité tiers de lire le DOM. C'est une limite de toute interface
  web, pas quelque chose que ce lot prétend résoudre.
- **Aucun appelant n'existe encore.** Le composant n'est monté sur aucune
  route ni page : son intégration dans les quatre parcours (ENT, cantine,
  Koxo, messagerie académique) est le LOT 5, qui devra aussi appeler
  `recordVaultCodeDisplay` (LOT 3) avant de lui passer une valeur, et brancher
  `onExpire` sur une nouvelle demande de vérification d'identité.
- **Le journal d'accès (`code_vault_access_events`, LOT 2) n'est pas
  concerné par ce lot** : ce composant ne fait aucun appel réseau et
  n'écrit donc rien ; l'écriture du journal reste liée à la route réelle du
  LOT 5.

## Périmètre respecté

Composant en données fictives uniquement (aucune valeur de code réelle
manipulée, y compris dans les tests). Aucun drapeau, aucun envoi, aucun
déploiement. Aucune lecture de `~/Documents/LyceeGest-DONNEES-PRIVEES`.
Aucun `git push`. Un seul commit local pour ce lot, limité au composant, à
son script de test et à l'entrée `package.json` correspondante.
