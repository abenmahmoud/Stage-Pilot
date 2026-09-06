# LOT 4 — Les trois autres parcours (cantine, Koxo, messagerie académique)

Plan : `docs/operations/PLAN_BRANCHEMENT_COFFRE_2026-09-06.md`, §LOT 4.
Portée stricte : les trois parcours restants du coffre, sur le même montage
que le LOT 3 (`decideVaultAccess` → `getOrCreateVaultAssignment` →
`recordVaultCodeDisplay`, journal à chaque décision), plus l'escalade support
réelle (`open_referral`). Aucun écran (LOT 5), aucune recette adverse de
bout en bout avec balayage anti-fuite (LOT 6), aucune clôture de tâche
Spec Kit (LOT 7).

## Ce qui a été livré

- `api/_shared/code-vault-service-delivery-route.ts` — assemblage commun aux
  parcours **cantine** et **koxo**, qui partagent exactement la même forme
  (`ProofBackedJourneyPhase` : `before_proof`, `awaiting_verification`,
  `verified`, `lookup_failed`). Factorisé plutôt que dupliqué depuis le LOT 3
  parce que la seule différence réelle entre les deux est la fonction de
  décision (`decideCantineJourneyStep` / `decideKoxoJourneyStep`) et le
  service cible :
  - `parseServiceDeliveryRequestInput(journeyType, value)` : même validation
    stricte que `parseEntInactifRequestInput` (LOT 3), avec `lookup_failed`
    en plus dans l'énumération des phases acceptées ;
  - `handleServiceDeliveryVaultRequest(tx, input)` : reprend telles quelles
    les deux garanties du LOT 3 (remise expirée jamais re-remise sur la
    seule foi d'une phase déclarée ; quatrième affichage du jour basculé sur
    le formulaire enrichi) — aucune des deux garanties n'a été réécrite, la
    fonction appelle littéralement les mêmes briques
    (`getOrCreateVaultAssignment`, `recordVaultCodeDisplay`,
    `isVaultDisplayStillVisible`, `recordVaultAccessEvent`) ;
  - nouveauté du lot : quand la décision pure renvoie `open_referral`
    (badge cantine introuvable, code Koxo introuvable), la fonction appelle
    `createVaultEscalationTicket` (ci-dessous) au lieu de renvoyer une
    décision qui reste sans suite, et renvoie `{ outcome: "escalated",
    publicCode }`.
- `api/_shared/code-vault-support-escalation.ts` — `createVaultEscalationTicket`
  ouvre une **vraie** ligne dans `support_requests` (la même table et la
  même file que `api/support/requests/index.ts`), pas une réimplémentation
  de la politique de routage support (`shared/support-routing.ts` n'est pas
  touché). Décisions assumées, écrites dans le code et ici :
  - **Idempotence déterministe** : la clé (`institution_id`,
    `idempotency_key_hash`) est dérivée de (établissement, parcours, motif,
    référence de l'acteur, référence du bénéficiaire) — un rejeu de la même
    décision `open_referral` (même personne, même motif) retrouve le ticket
    déjà ouvert au lieu d'en créer un second (`on conflict ... do nothing`
    puis relecture, même schéma que la route publique) ;
  - **Aucun nom fabriqué** : `requester_first_name`/`requester_last_name`
    portent le libellé explicite `"Escalade automatique"` /
    `"Coffre de codes"`, jamais un nom inventé. Aucune table du dépôt ne
    relie aujourd'hui un compte connecté à un nom réel (même limite déjà
    posée par le LOT 3 pour `personRef`) ; l'identité technique réelle
    (référence de personne, profil de l'acteur, motif, parcours) va dans
    `subject_context` (jsonb), en clair pour l'agent qui traite le ticket,
    jamais une valeur de code ;
  - **`category: 'autre'`** : la contrainte SQL de `support_requests`
    n'admet que `ent`, `email_academique`, `ordinateur`, `logiciel`, `autre`
    — aucune catégorie « cantine » ou « koxo » n'existe. Le motif réel
    (`cantine_badge_not_found`, `koxo_code_not_found`, ...) va dans
    `subcategory`, jamais perdu ;
  - **Aucune session d'appareil, aucun contact, aucun jeton magique** :
    ces trois mécanismes de la route publique (`api/support/requests/index.ts`)
    servent un requérant anonyme à retrouver sa demande plus tard, ce qui
    n'a pas de sens pour un ticket ouvert par un acteur déjà authentifié.
    Un helper `sha256` local (par `node:crypto`, pas un import de
    `api/_shared/support.ts`) évite d'entraîner tout le graphe de la route
    publique (`db/index.ts`, `api/_shared/auth.ts`) dans ce module —
    l'import direct a d'abord cassé la testabilité sans base (voir plus
    bas, « bug réel trouvé »).
- `api/_shared/code-vault-messagerie-academique-route.ts` — assemblage du
  parcours qui ne remet jamais de code (rappel du plan explicitement
  respecté : « ne lui invente pas une remise »). Structurellement différent
  des deux autres : `messagerie_academique` n'est pas un `VaultService`
  (`shared/code-vault-policy.ts` ne connaît que `ent`, `cantine`, `koxo`),
  donc `decideVaultAccess` ne s'applique pas ici — le parcours est par
  construction toujours un self-service (seul l'email déjà au dossier de
  l'appelant est en jeu). `handleMessagerieAcademiqueVaultRequest` journalise
  un `consult` dans `code_vault_access_events` (même journal que les deux
  autres parcours, comme l'exige le plan) uniquement quand
  `confirm_academic_email_only` est atteint ; les autres phases renvoient
  l'action pure sans toucher la base.
- Trois routes Vercel minces, même forme que `api/vault/ent-inactif.ts`
  (LOT 3) :
  - `api/vault/koxo.ts` (rôles `eleve`, `professeur`, self-service) ;
  - `api/vault/cantine.ts` (rôle `eleve` **uniquement**, voir « décisions de
    conception » ci-dessous) ;
  - `api/vault/messagerie-academique.ts` (rôles `eleve`, `professeur`).
- Tests sans base : `scripts/test-code-vault-service-delivery-route.mjs`
  (14 tests, cantine + koxo), `scripts/test-code-vault-messagerie-academique-route.mjs`
  (8 tests), `scripts/test-code-vault-support-escalation.mjs` (4 tests, `tx`
  fabriqué comme `test-code-vault-pg-error.mjs` du LOT 2 — le contrôle de
  flux est prouvé ici, la forme réelle des requêtes SQL par la recette
  PostgreSQL ci-dessous).
- `scripts/test-local-code-vault-service-delivery-route.mjs`
  (PostgreSQL réel jetable) : 31 assertions dans une transaction annulée en
  fin de script (même savepoint intentionnel que le LOT 3), couvrant les huit
  scénarios détaillés plus bas.
- `package.json` : cinq entrées ajoutées
  (`test:code-vault-service-delivery-route`,
  `test:code-vault-messagerie-academique-route`,
  `test:code-vault-support-escalation`,
  `recipe:local-code-vault-service-delivery-route`), au même emplacement que
  leurs homologues du LOT 3.

## Décisions de conception assumées, à trancher si un besoin plus large apparaît

- **Cantine et Koxo restent un self-service strict dans ce lot** (élève, ou
  professeur pour Koxo). `decideVaultAccess` (§7, LOT 1) autorise déjà en
  pur la remise déléguée (professeur principal → élève, service → tiers) et
  la cantine du professeur pour lui-même « selon disponibilité validée » —
  mais aucune table du dépôt ne porte aujourd'hui `cantineAvailabilityValidated`
  ni « le professeur principal détient déjà un autre code actif ». Construire
  ces branches aurait promis une vérification qui n'existe pas. Conséquence
  assumée : le rôle `professeur` est **absent** de `api/vault/cantine.ts`
  (pas de branche qui refuserait silencieusement pour toujours), et
  `handleServiceDeliveryVaultRequest` reste réutilisable pour un futur appel
  avec `cantineAvailabilityValidated` réel si une source de vérité apparaît.
- **`emailVerifiable` (messagerie académique) reste une déclaration de
  l'appelant**, comme `phase` l'était déjà pour le LOT 3 : le mécanisme réel
  (`api/identity/device/{request,verify}.ts`) est désactivé par
  `IDENTITY_DEVICE_ACCESS_ENABLED` (`CLAUDE.md`), et
  `shared/identity-directory-lookup.ts` sert une recherche d'agent support
  sur un tiers, pas un contrôle de vérifiabilité du propre email de
  l'appelant. Même limite que le LOT 3, pas une régression introduite ici.
- **`code_vault_access_events` ne journalise pas l'escalade elle-même.**
  Un `lookup_failed` qui aboutit à `open_referral` n'est pas un refus
  d'accès (`decideVaultAccess` a autorisé la personne — c'est la recherche
  de la ressource qui a échoué), et aucun des quatre types d'événement du
  LOT 3 (`consult`, `activation_confirmed`, `authorized_validation`,
  `access_denied`) ne décrit correctement une ouverture de ticket. La preuve
  d'une escalade vit dans `support_requests`/`support_events`, la table
  faite pour ça — documenté explicitement dans le code plutôt que de forcer
  un type d'événement qui ne correspond pas.
- **`personRef` reste l'identifiant Supabase de l'appelant** (`user.id`),
  même décision que le LOT 3, pour la même raison (aucune table ne relie un
  compte connecté à un `personRef` d'annuaire pour un élève ou un
  professeur).

## Bug réel trouvé et corrigé pendant ce lot (pas par relecture)

La première version de `api/_shared/code-vault-support-escalation.ts`
importait `sha256` depuis `api/_shared/support.ts`. `npm run
test:code-vault-service-delivery-route` a échoué immédiatement avec
`SyntaxError [ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX]` : `support.ts` importe
`api/_shared/auth.ts`, qui utilise une propriété de paramètre TypeScript
(`constructor(public status: number, ...)`) — syntaxe que le mode
« strip-only » de Node (`--experimental-strip-types`, utilisé par tous les
tests sans base du coffre) ne sait pas traiter. `support.ts` entraîne aussi
`db/index.ts` dans son graphe d'import, ce qui aurait de toute façon cassé
la testabilité sans base de ce module. Corrigé en définissant un `sha256`
local à deux lignes (`node:crypto`), même esprit que
`shared/code-vault-pg-error.ts` (LOT 2), qui reste lui aussi sans dépendance
lourde. Après correction, les 4 suites de tests sans base passent, et la
recette PostgreSQL confirme que le hachage produit une idempotence correcte
en base réelle (scénario 6 ci-dessous).

## Deux régressions préexistantes découvertes, non corrigées (hors périmètre de ce lot)

Ce lot exécute `Un lot = une tâche Spec Kit` : ces deux défauts ne
concernent aucun fichier touché par le LOT 4 et ne sont pas corrigés ici.

- **`recipe:local-code-vault-write-point` (LOT 1/2) échoue.** Le test
  attend qu'une deuxième écriture sur la même attribution lève une erreur
  dont `message` (ou `cause.message`) contient
  `"duplicate key value violates unique constraint"`. Depuis le LOT 2,
  `writeVaultCodeValue` relance une `SanitizedPgWriteError` dont le message
  est générique (`"Failed query: insert into ..."`) et qui n'a
  structurellement **pas** de propriété `cause` (garantie volontaire du
  LOT 2, prouvée par `test-code-vault-pg-error.mjs` : « aucune référence à
  l'erreur d'origine via `cause` »). Le test du LOT 1 n'a jamais été mis à
  jour après le LOT 2 pour vérifier le nouveau contrat de l'erreur
  sanitisée. `git status` confirme que ni `code-vault-write.ts` ni ce script
  de recette n'ont été modifiés par ce lot.
- **`recipe:local-code-vault-adversarial` échoue.** Le scénario de
  clôture du plan du 5 septembre (`PLAN_COFFRE_CODES_2026-09-05.md`) vérifie
  qu'aucun fichier de `api/` ou `workers/` (hors la définition elle-même)
  ne contient la chaîne littérale `traceManualVaultCodeReplacement`. Le
  commentaire du LOT 3
  (`api/_shared/code-vault-ent-inactif-route.ts`, ligne 47 : « Aucun
  remplacement pour ce lot (`traceManualVaultCodeReplacement` reste hors
  périmètre) ») et un commentaire de `code-vault-write.ts` contiennent tous
  les deux cette chaîne dans un commentaire, pas un appel — le scan ne
  distingue pas un commentaire d'un appel réel, et personne n'avait rejoué
  cette recette depuis le LOT 3 pour le remarquer. `git status` confirme que
  ni l'un ni l'autre fichier n'a été modifié par ce lot ; aucun fichier créé
  par le LOT 4 ne contient cette chaîne (vérifié par recherche).

Ces deux points sont à signaler explicitement avant toute clôture (LOT 7) :
la garantie « refus par erreur générique documentée » (LOT 2) et le
« balayage structurel sans appelant » (clôture du 5 septembre) ne sont plus
prouvées par leurs recettes PostgreSQL respectives, même si les modules
concernés sont probablement toujours corrects — seule la preuve est rompue,
pas nécessairement le comportement.

## Preuves réellement exécutées

Pile Supabase locale jetable (Docker Desktop disponible aujourd'hui), jamais
`--linked`, jamais `db push`, aucune URL distante :

- `npx supabase db reset` : les **108 migrations** rejouées depuis zéro sans
  erreur (aucune migration ajoutée par ce lot).
- `npm run recipe:local-code-vault-service-delivery-route` — exécuté deux
  fois de suite, **31 assertions** à chaque fois, résultat stable :
  `{"target":"127.0.0.1:54322","assertions":31,"rollbackVerified":true,"realData":false}`.
  Couvre : refus d'autorisation (cantine, motif `self_only`, aucun ticket
  créé) ; remise cantine réussie sans fuite de valeur ; remise expirée
  ramenée à `before_proof` (défaut n°1 du LOT 3, réutilisé sans
  modification) ; quatrième affichage koxo basculé sur le formulaire
  enrichi (défaut n°2, motif `koxo_daily_quota_exceeded`) ; `lookup_failed`
  cantine ouvre un vrai ticket (`assigned_team: intendance`,
  `category: autre`, `subcategory: cantine_badge_not_found`, référence
  réelle de la personne dans `subject_context`) et journalise
  `request.created` dans `support_events` ; rejeu du même `lookup_failed` ne
  crée pas de second ticket (idempotence vérifiée en base réelle) ;
  `lookup_failed` koxo route vers `referent_numerique`, pas `intendance` ;
  messagerie académique confirme sans jamais créer d'attribution, avec
  exactement un `consult` journalisé.
- `npm run test:code-vault-service-delivery-route` — 14/14, sans base.
- `npm run test:code-vault-messagerie-academique-route` — 8/8, sans base.
- `npm run test:code-vault-support-escalation` — 4/4, sans base.
- Non-régression, au vert : `npm run test:code-vault-policy` (16),
  `npm run test:code-vault-delivery-policy` (5),
  `npm run test:code-vault-journeys` (8),
  `npm run test:code-vault-write-point` (7, sans base — y compris le
  balayage confirmant qu'aucun fichier hormis `code-vault-write.ts` n'insère
  dans `code_vault_private_rows`),
  `npm run test:code-vault-pg-error` (5),
  `npm run test:code-vault-ent-inactif-route` (6),
  `npm run test:code-vault-secure-display` (9),
  `npm run recipe:local-code-vault-ent-inactif-route` (23 assertions,
  PostgreSQL réel), `npm run recipe:local-code-vault-assignment`
  (29 assertions, PostgreSQL réel).
- Non-régression en échec, préexistante et non causée par ce lot (voir
  section dédiée ci-dessus) :
  `npm run recipe:local-code-vault-write-point`,
  `npm run recipe:local-code-vault-adversarial`.
- `node node_modules/typescript/bin/tsc --noEmit` — aucune erreur.
- `npx vite build` — succès (Windows), même avertissement préexistant de
  taille de chunk, sans rapport avec ce lot.
- `npm run test:preview-security-gate` — code de sortie 0, jusqu'à
  `test:migration-integrity` (108 migrations, aucun doublon).
- `npm run test:spec-integrity` — 5 specs, 635 tâches recensées.

## Ce qui reste supposé, pas prouvé

- Aucune requête HTTP réelle contre `api/vault/{cantine,koxo,messagerie-academique}.ts` :
  comme pour le LOT 3, la preuve porte sur les fonctions
  `handle*VaultRequest` appelées directement, pas sur un `fetch` contre un
  serveur Vercel dev réellement démarré avec un jeton Supabase valide.
- La délégation professeur principal → élève (cantine, koxo) et l'accès
  institution-wide d'un profil `service` restent des branches pures de
  `decideVaultAccess` jamais exercées par une route réelle dans ce lot (voir
  « décisions de conception » ci-dessus).
- Le cas `outcome: "defective"` de `recordVaultCodeDisplay` reste, comme au
  LOT 3, géré par le code mais sans chemin réel pour se produire (aucune
  route n'appelle `flagVaultCodeDefective`).

## Portée délibérément non couverte par ce lot

- Aucun écran monté (`CodeVaultSecureDisplay`) — LOT 5.
- Aucune recette adverse de bout en bout avec balayage anti-fuite sur le
  scénario complet des cinq parcours — LOT 6.
- Aucune clôture de tâche Spec Kit (T064, T069) — LOT 7.
- ENT actif (`decideEntActifJourneyStep`) — jamais nommé par le plan
  (ni LOT 3 ni LOT 4), toujours sans route réelle.

## Périmètre respecté

Aucun import de personne réelle, aucun email envoyé, aucun drapeau activé.
Aucune mutation Vercel, Supabase distant, VPS, DNS. Toutes les recettes
tournent sur la pile Supabase locale jetable (`127.0.0.1:54322`), jamais
`--linked`, jamais `db push`, aucune URL distante. Aucune lecture de
`~/Documents/LyceeGest-DONNEES-PRIVEES`. Aucun `git push`. Travail
entièrement fait dans cette session, aucune délégation à un agent en
arrière-plan. Commit local unique pour ce lot, avec chemins explicites,
limité aux fichiers du LOT 4 (`api/_shared/code-vault-service-delivery-route.ts`,
`api/_shared/code-vault-messagerie-academique-route.ts`,
`api/_shared/code-vault-support-escalation.ts`, `api/vault/cantine.ts`,
`api/vault/koxo.ts`, `api/vault/messagerie-academique.ts`,
`scripts/test-code-vault-service-delivery-route.mjs`,
`scripts/test-code-vault-messagerie-academique-route.mjs`,
`scripts/test-code-vault-support-escalation.mjs`,
`scripts/test-local-code-vault-service-delivery-route.mjs`, `package.json`,
ce compte rendu). Les fichiers non liés à ce lot déjà présents dans l'arbre
de travail (`docs/operations/PLAN_CONNAISSANCE_OB1_2026-09-05.md`,
`nuit.ps1`, `.nuit-coffre.lock`, `nuit-coffre.ps1`, et le plan
`PLAN_BRANCHEMENT_COFFRE_2026-09-06.md` lui-même) n'ont pas été touchés et
ne sont pas inclus dans ce commit.
