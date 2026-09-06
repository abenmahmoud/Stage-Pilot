# LOT 3 — La première route réelle : ENT inactif

Plan : `docs/operations/PLAN_BRANCHEMENT_COFFRE_2026-09-06.md`, §LOT 3.
Portée stricte : une route réelle pour le seul parcours « ENT inactif »,
enchaînant `decideVaultAccess`, `getOrCreateVaultAssignment` et
`recordVaultCodeDisplay` sans en réécrire aucune, journalisant chaque
décision (refus compris) dans `code_vault_access_events`, et corrigeant les
deux défauts nommés par le plan. Aucun autre parcours (LOT 4), aucun écran
(LOT 5), aucune recette adverse de bout en bout (LOT 6).

## Ce qui a été livré

- `api/_shared/code-vault-access-events.ts` — écrit une ligne dans
  `code_vault_access_events` à partir d'un `VaultActor`
  (`shared/code-vault-policy.ts`) et d'une décision. Vérifie côté
  application, avant d'envoyer la requête, que `refusalReason` est fourni si
  et seulement si `eventType` vaut `access_denied` — la même règle que la
  contrainte SQL de la table, pour échouer tôt plutôt que de compter sur le
  rejet en base. N'écrit jamais de valeur : les colonnes de la table ne
  peuvent structurellement pas en porter une.
- `api/_shared/code-vault-ent-inactif-route.ts` — l'assemblage lui-même,
  testable sans requête HTTP :
  - `parseEntInactifRequestInput` : validation stricte à la frontière
    (`phase`, `proofChannel`, `schoolYear`, aucun champ en plus ou en moins,
    année scolaire au format `AAAA-AAAA`) ;
  - `handleEntInactifVaultRequest(tx, input)` : appelle `decideVaultAccess`
    et journalise un `access_denied` motivé en cas de refus ; sinon appelle
    `decideEntInactifJourneyStep` (`shared/code-vault-journeys.ts`, LOT 1 du
    5 septembre, non modifié) pour savoir où en est le parcours ; pour les
    phases qui précèdent la remise (`before_proof`, `awaiting_verification`,
    `revealed`), renvoie l'action pure sans toucher la base ; pour la remise
    (`reveal_in_secure_display`), crée/récupère l'attribution, journalise un
    `consult`, puis applique les deux garde-fous du lot avant d'appeler
    `recordVaultCodeDisplay` :
    1. **défaut n°1 du plan** — si la précédente remise existe et que sa
       fenêtre de visibilité de 30 minutes (`isVaultDisplayStillVisible`) est
       dépassée, la route renvoie `before_proof` (action `send_proof`) et
       n'appelle **pas** `recordVaultCodeDisplay` : une phase `verified`
       déclarée par l'appelant ne suffit plus, quelle que soit son
       origine — un jour plus tard, l'attribution ne ressort plus sans
       signal ;
    2. **défaut n°2 du plan** — si `recordVaultCodeDisplay` renvoie
       `quota_exceeded` (quatrième affichage du jour), la route renvoie
       `form_fallback` (`shared/code-vault-journeys.ts`, type déjà défini,
       jusqu'ici jamais invoqué) au lieu d'une erreur brute. Le cas
       `defective` (structurellement inatteignable dans ce lot : aucune
       route n'appelle encore `flagVaultCodeDefective`) est traité de la
       même façon, par exhaustivité de type.
  - Ne déchiffre et ne renvoie jamais la valeur du code : ce module importe
    `code-vault-assignment.ts` et `code-vault-access-events.ts`, jamais
    `shared/code-vault-crypto.ts`. La réponse en cas de remise réussie ne
    porte que `remainingDisplaysToday` et `revealedAt`.
- `api/vault/ent-inactif.ts` — la route Vercel, volontairement mince :
  `requireRole(req, ["eleve", "professeur"])`, analyse du corps via
  `parseEntInactifRequestInput`, résolution de l'établissement unique
  (`requireConfiguredInstitution`, même motif que les autres routes du
  dépôt), construction de l'acteur et de la cible, puis un seul appel à
  `handleEntInactifVaultRequest` dans une transaction Drizzle
  (`db.transaction`). Toujours un self-service : la cible est toujours
  l'appelant lui-même (`subjectPersonRef: user.id`).
- `scripts/test-code-vault-ent-inactif-route.mjs`
  (`test:code-vault-ent-inactif-route`, sans base) : 6 tests de
  `parseEntInactifRequestInput` — entrée valide, valeur qui n'est pas un
  objet simple, champ en trop ou manquant, phase inconnue, canal de preuve
  hors email/phone, année scolaire mal formée.
- `scripts/test-local-code-vault-ent-inactif-route.mjs`
  (`recipe:local-code-vault-ent-inactif-route`, PostgreSQL réel jetable,
  même famille que `test-local-code-vault-assignment.mjs`) : appelle
  directement `handleEntInactifVaultRequest`, jamais une réimplémentation de
  ses règles. 23 assertions, dans une transaction annulée en fin de script
  (savepoint intentionnel, base non polluée) :
  1. un refus d'autorisation (cible différente de l'acteur, motif
     `self_only`) écrit exactement une ligne `access_denied` motivée, aucune
     attribution créée — structurellement inatteignable via la route HTTP
     réelle (la cible y est toujours l'appelant), donc testé directement
     contre la fonction, comme l'exige le plan (« refus compris ») ;
  2. les phases qui précèdent la remise ne créent aucune attribution ;
  3. la première remise réussit, journalise un `consult`, ne renvoie que le
     quota restant et l'horodatage — jamais de valeur ;
  4. **défaut n°1** : une tentative 60 minutes après une remise ramène à
     `before_proof` sans incrémenter `display_count` ni avancer
     `revealed_at` (vérifié par relecture directe des colonnes) ;
  5. **défaut n°2** : trois remises rapprochées (dans la fenêtre de 30
     minutes) réussissent, la quatrième bascule sur `form_fallback` avec le
     motif `ent_inactif_daily_quota_exceeded`, sans incrémenter le compteur
     une quatrième fois.
- `package.json` : quatre entrées ajoutées
  (`test:code-vault-ent-inactif-route`,
  `recipe:local-code-vault-ent-inactif-route`), aux mêmes emplacements que
  leurs homologues du LOT 3 du 5 septembre.

## Bug réel trouvé et corrigé par la recette PostgreSQL, pas par relecture

`tx.execute(sql\`...\`)` renvoie les lignes brutes du pilote `postgres` : une
colonne `timestamptz` en ressort en **chaîne**, jamais en `Date`, malgré le
type `VaultAssignmentRow.revealed_at: Date | null` déclaré dans
`api/_shared/code-vault-assignment.ts` (LOT 3 du 5 septembre — même écart déjà
contourné par `scripts/test-local-code-vault-assignment.mjs`, qui repasse par
`new Date(...)` avant toute comparaison, mais jamais documenté comme piège
pour un futur appelant). `handleEntInactifVaultRequest` appelait
`isVaultDisplayStillVisible(assignment.revealed_at, now)` directement : la
première exécution de la recette locale a levé
`TypeError: revealedAt.getTime is not a function`, jamais vu par
`tsc --noEmit` (le type ment, TypeScript n'y peut rien) ni par une recette en
mémoire avec des objets fabriqués. Corrigé par une conversion explicite
(`new Date(assignment.revealed_at)`) avant l'appel, avec un commentaire dans
le code pointant ce piège pour le prochain appelant (LOT 4). C'est exactement
le genre d'écart qu'une recette PostgreSQL réelle attrape et qu'un test en
mémoire ne peut pas voir.

## Décisions de conception assumées, à trancher si un besoin plus large apparaît

- **`personRef` d'un élève ou professeur connecté au portail = son
  identifiant Supabase (`user.id`)**, pas un `personRef` de l'annuaire
  officiel (`identity_directory_*`). Aucune table du dépôt ne relie
  aujourd'hui un compte Supabase connecté à un `personRef` d'annuaire pour
  un élève ou un professeur (seule `institution_memberships`, utilisée par
  `resolvePersistedSupportAgentAccess`, relie un `user_id` à un rôle et des
  services — pour les profils `service`, pas `eleve`/`professeur`). Choix
  défendable ici parce que la route est un self-service strict
  (`subjectKind: "self"`, cible toujours égale à l'acteur) : la clé du
  quadruplet reste stable et unique par personne, même si elle diffère d'un
  futur `personRef` d'annuaire. À trancher explicitement si LOT 4 doit
  relier un professeur principal à un élève par un `personRef` partagé avec
  l'annuaire.
- **La preuve sur coordonnée (email/téléphone déjà au dossier) reste
  déclarative**, portée par le seul paramètre `phase` envoyé par
  l'appelant. Le mécanisme réel d'envoi/vérification
  (`api/identity/device/{request,verify}.ts`, dont le commentaire de
  `shared/code-vault-journeys.ts` dit explicitement qu'il suit le même
  schéma) est désactivé par un drapeau (`IDENTITY_DEVICE_ACCESS_ENABLED`,
  `CLAUDE.md`) qu'aucune règle de ce dépôt ne permet d'activer dans ce lot.
  Le vrai gain de sécurité de ce lot n'est donc pas « l'appelant a
  prouvé son identité » (non vérifiable ici), mais « une attribution déjà
  remise et expirée ne se re-remet jamais sur la seule foi de cette
  déclaration » (défaut n°1, ci-dessus) — un appelant qui *peut* mentir sur
  la fraîcheur de sa preuve ne peut plus, lui, forcer une remise silencieuse
  d'un code déjà expiré. Brancher un vrai mécanisme de preuve reste hors
  périmètre de ce lot et du plan tel qu'écrit pour les LOT 4/5.
- **Aucune lecture ni déchiffrement de la valeur du code.** La réponse de la
  route ne porte jamais `code_vault_private_rows` : ni ce lot ni le plan ne
  demandent de brancher la lecture/déchiffrement ici — LOT 5 mentionne
  seulement le montage de l'écran, pas la fonction qui lui fournirait la
  valeur déchiffrée. Cette fonction reste donc à écrire, à un lot non
  encore nommé explicitement par le plan.
- **`version` du quadruplet toujours 1** (`CURRENT_VAULT_ASSIGNMENT_VERSION`)
  : aucun remplacement humain n'est câblé sur cette route (comme documenté
  dans `traceManualVaultCodeReplacement`, réservé à une action
  administrative explicite).
- **`schoolYear` reste un paramètre fourni par l'appelant**, pas calculé :
  aucun utilitaire « année scolaire courante » n'existe dans le dépôt (seule
  `shared/schedule-admin-payload.ts` valide un format déjà fourni en
  entrée) ; en inventer un serait hors périmètre de ce lot.

## Portée délibérément non couverte par ce lot

- Aucun autre parcours (ENT actif, cantine, Koxo, messagerie académique) —
  LOT 4.
- Aucun écran monté (`CodeVaultSecureDisplay`) — LOT 5.
- Aucune recette adverse de bout en bout avec balayage anti-fuite sur le
  scénario complet — LOT 6.
- Aucune vraie preuve d'identité envoyée ou vérifiée (voir ci-dessus).
- Le cas `outcome: "defective"` de `recordVaultCodeDisplay` est géré par le
  code mais n'a aucun chemin réel pour se produire dans ce lot (aucune route
  n'appelle `flagVaultCodeDefective`) : non testé en conditions réelles,
  seulement par exhaustivité de type.

## Preuves réellement exécutées

Pile Supabase locale jetable (Docker Desktop disponible aujourd'hui), jamais
`--linked`, jamais `db push`, aucune URL distante :

- `npx supabase db reset` : les **108 migrations** du dépôt (`ls
  supabase/migrations` en compte 108) rejouées depuis zéro sans erreur
  (aucune migration ajoutée par ce lot — le schéma du 5 septembre suffit).
- `npm run recipe:local-code-vault-ent-inactif-route` — exécuté deux fois de
  suite, **23 assertions** à chaque fois, résultat stable :
  `{"target":"127.0.0.1:54322","assertions":23,"rollbackVerified":true,"realData":false}`.
  La première exécution a révélé et fait corriger le bug `revealed_at`
  décrit plus haut ; les deux exécutions suivantes (après correction) sont
  au vert.
- `npm run test:code-vault-ent-inactif-route` — 6/6, sans base.
- Non-régression, toutes au vert : `npm run test:code-vault-policy` (16),
  `npm run test:code-vault-delivery-policy` (5),
  `npm run test:code-vault-journeys` (8), `npm run test:code-vault-write-point`
  (7, y compris le balayage structurel confirmant qu'aucun fichier hormis
  `code-vault-write.ts` n'insère dans `code_vault_private_rows`),
  `npm run test:code-vault-pg-error` (5).
- `node node_modules/typescript/bin/tsc --noEmit` — aucune erreur.
- `npx vite build` — succès (Windows), même avertissement préexistant de
  taille de chunk, sans rapport avec ce lot.
- `npm run test:preview-security-gate` — code de sortie 0, jusqu'à
  `test:migration-integrity` (108 migrations, aucun doublon).
- `npm run test:spec-integrity` — 5 specs, 635 tâches recensées.

## Ce qui reste supposé, pas prouvé

- Aucune requête HTTP réelle contre `api/vault/ent-inactif.ts` : la preuve
  porte sur `handleEntInactifVaultRequest` appelée directement (comme les
  recettes locales des LOT 1/3 précédents), pas sur un `fetch` contre un
  serveur Vercel dev réellement démarré avec un jeton Supabase valide. Le
  branchement `requireRole` → `db.transaction` → fonction testée n'a donc
  pas de preuve d'exécution de bout en bout par-dessus la couche HTTP —
  seule la couche métier (l'essentiel du risque) est recettée en conditions
  réelles.
- La correspondance `user.role === "professeur"` → `actor.profile:
  "professeur"` n'a été exercée par aucun test (recette et tests unitaires
  ne couvrent que le profil `eleve`) : la lecture du code montre qu'elle
  suit exactement le même chemin, mais ce n'est pas une preuve d'exécution.

## Périmètre respecté

Aucun import de personne réelle, aucun email envoyé, aucun drapeau activé.
Aucune mutation Vercel, Supabase distant, VPS, DNS. Toutes les recettes
tournent sur la pile Supabase locale jetable (`127.0.0.1:54322`), jamais
`--linked`, jamais `db push`, aucune URL distante. Aucune lecture de
`~/Documents/LyceeGest-DONNEES-PRIVEES`. Aucun `git push`. Travail
entièrement fait dans cette session, aucune délégation à un agent en
arrière-plan. Commit local unique pour ce lot, avec chemins explicites,
limité aux fichiers du LOT 3 (`api/_shared/code-vault-access-events.ts`,
`api/_shared/code-vault-ent-inactif-route.ts`, `api/vault/ent-inactif.ts`,
`scripts/test-code-vault-ent-inactif-route.mjs`,
`scripts/test-local-code-vault-ent-inactif-route.mjs`, `package.json`, ce
compte rendu). Les fichiers non liés à ce lot déjà présents dans l'arbre de
travail (`docs/operations/PLAN_CONNAISSANCE_OB1_2026-09-05.md`, `nuit.ps1`,
`.nuit-coffre.lock`, `nuit-coffre.ps1`, et le plan
`PLAN_BRANCHEMENT_COFFRE_2026-09-06.md` lui-même) n'ont pas été touchés et ne
sont pas inclus dans ce commit.
