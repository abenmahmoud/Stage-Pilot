# LOT 8 — Recette navigateur (2026-09-05)

Périmètre strict : `docs/operations/PLAN_FLASH_PERSISTANCE_2026-09-05.md`, LOT 8
uniquement. Établissement et compte entièrement fictifs. Aucun drapeau ouvert
laissé en l'état final, aucun envoi réel, aucune donnée réelle, aucune
commande `--linked`/`db push`/URL distante, aucun `vercel dev`.

## Ce qui est prouvé par une commande réellement exécutée

### Méthode

Chromium local réel (Playwright, ajouté en devDependency pour ce lot —
`npm install -D playwright` puis `npx playwright install chromium`), piloté
par `scripts/test-flash-browser-recette.mjs` (nouveau fichier), invoqué par :

```
node --import ./scripts/ts-test-resolver.mjs --experimental-transform-types \
  scripts/test-flash-browser-recette.mjs --local-stack-only
```

Le script, sur la pile Supabase locale déjà utilisée au LOT 7 :

- crée un établissement fictif et un compte fictif (`superadmin`, appartenance
  active avec le service `referent_numerique`), même motif que LOT 7
  (`admin.createUser` + insertion directe des tables techniques) ;
- ouvre une session **réelle** par `signInWithPassword`, puis enrôle et vérifie
  un facteur TOTP réel (mêmes fonctions `decodeBase32`/`totp` que
  `scripts/test-preview-routing-review-client.mjs`, déjà présentes dans ce
  dépôt) pour atteindre `aal2` — jamais un JWT fabriqué à la main ni une
  session simulée ;
- construit le front (`vite build`) contre cette pile locale, dans un
  répertoire de sortie isolé (`.vercel/flash-recette/dist`, distinct de
  `dist/` utilisé par `npm run build`) ;
- sert ce build par un petit serveur HTTP local qui, pour les deux seules
  routes réellement appelées au montage de l'écran de validation
  (`GET /api/flash/validation/queue` et `.../expired`), invoque **les vrais
  handlers** (`api/flash/validation/queue.ts`, `.../expired.ts`) avec un
  req/res minimal — même technique que LOT 7, aucune règle métier
  réimplémentée. L'écran de proposition n'appelle aucune route à son montage
  (formulaire local), donc aucun backend n'était nécessaire pour lui ;
- dépose la session `aal2` réellement obtenue dans le `localStorage` du
  navigateur (clé `sb-127-auth-token`, format natif de `@supabase/auth-js`)
  avant navigation, pour éviter de rescripter le formulaire de connexion agent
  tout en gardant un jeton réellement émis et réellement vérifié en MFA.

**Point non prévu par le plan, documenté explicitement** : les deux écrans
sont protégés par `ProtectedRoute` (`src/App.tsx`), qui exige `aal2` pour tout
rôle agent (`superadmin` en fait partie) — pas seulement `RoleRoute`. Un
compte fraîchement créé n'a pas cette garantie. Or `supabase/config.toml`
avait `[auth.mfa.totp] enroll_enabled = false` / `verify_enabled = false` sur
cette pile locale, ce qui rend l'enrôlement TOTP impossible tel quel. Pour
recetter réellement les deux écrans (pas seulement celui qui n'a pas de garde
MFA), ce lot a :

1. basculé temporairement ces deux valeurs à `true` dans
   `supabase/config.toml` ;
2. relancé la pile (`npx supabase stop` puis `npx supabase start`, données
   conservées — `"backup":true` confirmé dans la sortie) ;
3. exécuté la recette ;
4. **restauré `supabase/config.toml` à l'état commité** (`git checkout --`)
   et **relancé la pile une troisième fois** pour que l'état réel du
   conteneur corresponde à nouveau au fichier commité (MFA TOTP désactivé).

`git status --porcelain -- supabase/config.toml` ne montre aucune différence
après restauration. Aucun drapeau n'est resté ouvert dans l'état final commis
ou dans le conteneur.

### Résultat des 18 mesures demandées (2 écrans × 3 largeurs)

| Écran | 320 px | 390 px | 1 440 px |
| --- | --- | --- | --- |
| Proposer une information flash | débordement 0, 0 erreur console | débordement 0, 0 erreur console | débordement 0, 0 erreur console |
| Valider et modifier les informations flash | débordement 0, 0 erreur console | débordement 0, 0 erreur console | débordement 0, 0 erreur console |

**Zéro débordement partout, zéro erreur console partout.** `finalUrl` de
chaque mesure confirme que le navigateur est resté sur la page ciblée (pas de
redirection silencieuse vers `/login` ou `/security` qui aurait invalidé la
mesure). Captures dans `.vercel/flash-recette/` (répertoire ignoré par git,
comme prévu par le plan) : `proposer-{320,390,1440}.png`,
`valider-{320,390,1440}.png`. Deux captures (`valider-390`, `proposer-320`)
ont été relues visuellement : rendu réel et complet, pas de page blanche ni
d'écran d'erreur — l'écran de validation affiche « Propositions en attente
(0) » et « Propositions expirées sans validation (0) », des chiffres réels
issus de la vraie requête sur l'établissement fictif de ce lot (aucune
proposition n'y a été créée).

### Non-régression

- `npm run build` : succès (`tsc --noEmit` puis `vite build`).
- `npm run test:preview-security-gate` : exit `0`.
- `npm run test:flash-recette` : exit `0` (tous les sous-tests LOT 1 à 6, y
  compris `test:migration-integrity` → toujours `98` migrations).

## Ce que ce lot ferme réellement

Le plan note : « C'est le seul lot qui peut clore "responsive vérifié" :
jusqu'ici cette affirmation reposait sur une lecture du code, pas sur un
rendu. » C'est fait pour les deux écrans flash spécifiquement, par un rendu
Chromium réel et authentifié (pas un test statique de regex sur le code
source comme au LOT 6).

## Ce qui reste supposé, pas prouvé

- **Une seule résolution d'écran par mesure, une seule combinaison
  navigateur/OS.** Chromium seul, sur cette machine. Pas de test sur un vrai
  téléphone, pas de Firefox/Safari.
- **Aucun audit d'accessibilité automatisé dans ce passage** (lecteur d'écran,
  contraste) : hors périmètre du LOT 8 tel qu'écrit.
- **Le compte de recette n'a interagi avec aucun formulaire** : la mesure
  porte sur le rendu initial des deux écrans, pas sur leur comportement après
  saisie ou après une décision de validation (déjà couvert autrement par les
  tests LOT 3/6 et par la recette PostgreSQL du LOT 7).
- **Les fixtures de ce lot (un établissement, un compte, un facteur TOTP)
  restent dans la pile locale jetable**, comme au LOT 7 — aucune n'est réelle,
  tout disparaît au prochain `npx supabase db reset`. Slug marqué
  `flash-browser-recette-<marker aléatoire>` pour éviter toute collision avec
  les fixtures des lots précédents encore présentes sur cette même pile.
- **Preuve locale, pas recette distante** (rappel explicite du plan) : tout ce
  qui précède tourne sur `127.0.0.1:54321`/`54322`/le serveur HTTP éphémère de
  ce script, jamais sur un alias public ni un projet Supabase distant.
- **`playwright` a été ajouté en devDependency** (`package.json`,
  `package-lock.json`) — nécessaire pour un rendu Chromium réel plutôt qu'une
  simulation ; c'est un outil de test, jamais exécuté en production, conforme
  à `rules/typescript/testing.md` (« Use Playwright as the E2E testing
  framework »).

## Fichiers ajoutés ou modifiés

- `scripts/test-flash-browser-recette.mjs` (nouveau)
- `package.json`, `package-lock.json` (ajout de `playwright` en
  devDependency)

`supabase/config.toml` a été modifié puis restauré à l'identique pendant cette
session (voir ci-dessus) : **aucune différence commise**. Aucun fichier de LOT
1 à 7 modifié. `src/pages/prototype/lycee-connect.css` non touché.
