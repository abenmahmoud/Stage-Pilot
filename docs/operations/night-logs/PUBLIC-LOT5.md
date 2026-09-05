# LOT 5 — Fermer T071E

5 septembre 2026. Plan : `docs/operations/PLAN_FLASH_PUBLIC_2026-09-05.md`.
Session unique, LOT 5 seulement, à la suite du LOT 4 (raccorder à la file
durable existante, compte rendu `PUBLIC-LOT4.md`).

## Ce que ce lot ferme

T071E (`specs/002-agent-etablissement-adaptatif/tasks.md`) était restée non
cochée à la clôture du plan de publication (5 septembre 2026) pour une seule
raison, déjà identifiée avec précision à ce moment-là : la décision
`shared/flash-validation-access.ts` était déjà appliquée côté serveur sur les
trois routes qui mutent une version (`decision.ts`, `correction.ts`,
`publication.ts`, via `assertFlashValidationAccess`) et déjà remontée par
ligne à `FlashValidationPage.tsx` (`access.allowed`/`reason`/`selfValidated`),
mais **la porte de l'écran lui-même**
(`/admin/informations-flash/valider`) restait gardée par
`RoleRoute allowedRoles={CONTENT_MANAGER_ROLES}` dans `src/App.tsx` — un
rôle applicatif, pas le service. Conséquence concrète : un compte
`administration` ou `proviseur` sans le service `referent_numerique`/`ddfpt`
atteignait quand même l'écran (boutons désactivés côté serveur, mais aucun
refus d'accès à la porte).

## Ce qui a été fait

- `api/flash/validation/screen-access.ts` (nouvelle route, `GET` seul) :
  appelle `requireFlashActor` puis
  `grantedFlashValidationService(actor.user.role, actor.serviceCodes)` —
  exactement le même calcul que celui qui ouvre déjà la file
  (`assertFlashValidationQueueAccess`, `api/_shared/flash-access.ts`), pas un
  second calcul récrit pour l'occasion. Ne renvoie ni le rôle ni les
  `serviceCodes` bruts : seulement `allowed`/`grantedByService`, passés par
  le contrat strict `toFlashValidationScreenAccessPayload`
  (`api/_shared/flash-response.ts`).
- `shared/flash-payload-policy.ts` : nouveau type
  `FlashValidationScreenAccessPayload` et son validateur
  `isValidFlashValidationScreenAccessPayload`, avec le même invariant que
  `FlashValidationAccessPayload` (`allowed` vrai si et seulement si
  `grantedByService` n'est pas `null`), champs exacts (`hasExactFields`) pour
  refuser tout champ recopié par erreur (ex. un `reason` qui n'a pas de sens
  ici).
- `shared/flash-validation-route.ts` (nouveau, pur, sans React ni réseau) :
  `decideFlashValidationRoute({ user, authLoading, access, roleHome })` décide
  quoi afficher — attendre, rediriger vers le login, rediriger vers l'accueil
  du rôle de l'utilisateur, ou afficher l'écran — à partir de l'état
  d'authentification et de la réponse déjà reçue du serveur. Ne recalcule
  jamais elle-même qui a le service : elle ne fait que router sur le
  résultat serveur.
- `src/App.tsx` : nouveau composant `FlashValidationRoute`, qui appelle
  `apiFetch("flash/validation/screen-access")` dans un `useEffect`, valide la
  réponse (`isValidFlashValidationScreenAccessPayload`), et **ferme l'écran
  sur toute erreur réseau ou réponse invalide** (`setAccess({ status:
  "checked", allowed: false })` dans le `.catch`) — échec fermé, jamais
  ouvert. La route `/admin/informations-flash/valider` utilise désormais ce
  composant à la place de `RoleRoute allowedRoles={CONTENT_MANAGER_ROLES}`.
  Les cinq autres routes qui utilisaient déjà `CONTENT_MANAGER_ROLES`
  (proposer une information, gestionnaire de contenus, etc.) sont
  inchangées : seule la porte de validation change, rien d'autre dans ce
  fichier.
- `specs/002-agent-etablissement-adaptatif/tasks.md` : T071E cochée, avec
  l'état précis de ce qui a été fait et de ce qui reste supposé (voir
  ci-dessous).
- Tests :
  - `scripts/test-flash-validation-route.mjs` (nouveau) : 7 cas sur la
    fonction pure (attente pendant le chargement, redirection login sans
    session, attente de la réponse serveur, redirection vers l'accueil
    propre au rôle — `administration` vers `/stages`, `proviseur` vers
    `/grand-oral`, jamais un accueil générique commun — accès accordé pour
    tout rôle qui porte le service), plus une preuve de câblage par lecture
    de `src/App.tsx` (import réel, appel `apiFetch` réel, validation du
    payload, fermeture sur erreur, route effectivement enveloppée par
    `FlashValidationRoute` et non plus par `RoleRoute`).
  - `scripts/test-flash-payload-policy.mjs` : 5 cas ajoutés pour
    `isValidFlashValidationScreenAccessPayload` (accepté ouvert/fermé,
    refusé si `allowed` et `grantedByService` se contredisent, refusé si un
    champ étranger est présent).
  - `package.json` : script `test:flash-validation-route`, ajouté à
    l'agrégat `test:flash-recette`.

## Preuves réellement exécutées

- `npm run test:flash-validation-route` (nouveau) → 7/7.
- `npm run test:flash-payload-policy` (avec les 5 nouveaux cas) → 32/32.
- `npm run test:flash-recette` (agrégat complet, inclut désormais ce nouveau
  script) → intégralement vert, aucune régression sur les scripts déjà en
  place (`test:flash-access`, `test:flash-validation-access`,
  `test:flash-validation-page`, files et décisions déjà servies).
- `npm run test:spec-integrity` → vert, 634 tâches, 5 specs, T071E désormais
  comptée dans les 228 tâches closes de la spec 002 (227 avant ce lot, 228
  après ; 71 encore ouvertes).
- `node node_modules/typescript/bin/tsc --noEmit` → aucune erreur (le
  périmètre `include` du `tsconfig.json` couvre `src`, `db`, `api` et
  `shared`, donc les quatre fichiers touchés).
- `npm run build` (`vite build`, a fonctionné dans ce shell ce soir) →
  succès, `dist/` produit, `FlashValidationPage` toujours son propre chunk
  (`FlashValidationPage-*.js`, 22.14 kB).
- `npm run test:preview-security-gate` → code de sortie 0, sortie complète
  relue, aucun `fail` différent de 0.
- `docker info` → échoue encore (`dockerDesktopLinuxEngine` introuvable),
  même constat que toutes les nuits précédentes de ce plan.

## Ce qui reste supposé, pas prouvé

- **Aucune preuve navigateur réelle.** Ce lot prouve la décision par une
  fonction pure testée et par lecture de code (le composant appelle bien
  l'API, valide bien le contrat, ferme bien l'écran sur erreur), pas par un
  clic réel dans un navigateur avec un compte `administration` sans service
  qui tenterait de naviguer vers `/admin/informations-flash/valider`. Docker
  Desktop reste indisponible dans ce shell ce soir, donc aucune pile
  Supabase locale n'a tourné pour fabriquer un tel compte et l'essayer
  réellement. C'est exactement le écart que le LOT 6 (recette PostgreSQL et
  navigateur réelle) doit combler, en particulier son scénario « un compte
  sans le service : écran refusé ».
- **`requireFlashActor` filtre déjà les rôles hors `FLASH_ACTOR_ROLES`**
  (`superadmin`, `administration`, `agent`, `proviseur`, `professeur`) avant
  même de regarder le service : un compte `eleve` ou `pp` qui appellerait
  directement la nouvelle route obtient un 403 de `requireFlashActor`, pas un
  `{ allowed: false }`. Ce lot ne change rien à cette liste — elle existait
  déjà pour les autres routes flash — et le composant client traite les deux
  cas de la même façon (échec réseau → écran fermé), donc le comportement
  utilisateur final est identique. Non vérifié séparément par un test dédié
  à ce cas précis dans ce lot.
- **Le superadmin garde un accès inconditionnel**, comme partout ailleurs
  dans le domaine flash (`grantedFlashValidationService` le traite à part,
  sans exiger de service déclaré) — comportement hérité, pas décidé ni
  modifié par ce lot, seulement propagé jusqu'à la porte de l'écran.

## Portée strictement respectée

Rien d'autre que le LOT 5 n'a été touché : aucun changement au pont vers la
file durable (LOT 4, déjà clos), aucune recette PostgreSQL ou navigateur
(LOT 6), aucune tâche autre que T071E cochée dans `tasks.md`. Aucun drapeau
ouvert, aucun envoi réel, aucune donnée réelle, aucun `git push`.
