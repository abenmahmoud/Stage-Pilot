# LOT 7 — Clôture honnête

Plan : `docs/operations/PLAN_BRANCHEMENT_COFFRE_2026-09-06.md`, §LOT 7.
Portée stricte : aucune correction de code, aucune nouvelle recette. Relire
les six lots contre leurs preuves, trancher T064 et T069, faire tourner les
quatre contrôles de clôture. Rien d'autre.

## Relecture lot par lot (preuve réellement exécutée vs supposée)

- **LOT 1** (point d'écriture unique) — prouvé : `writeVaultCodeValue` est la
  seule fonction qui écrit dans `code_vault_private_rows`
  (`test:code-vault-write-point`, balayage structurel du dépôt). Aucune route
  n'appelle cette fonction à ce jour (voir LOT 5 ci-dessous) : le point
  d'écriture existe et est sûr, mais n'est branché nulle part.
- **LOT 2** (jamais journaliser une erreur Postgres entière) — prouvé par
  `test:code-vault-pg-error`. Régression connue, non corrigée (hors périmètre
  de ce lot, déjà signalée par LOT 4/6) : le message de l'erreur sanitisée
  n'est plus celui attendu par `recipe:local-code-vault-write-point`, qui
  échoue depuis le LOT 2 — la garantie (aucune fuite de `cause`/`detail`)
  reste vraie, revérifiée par une route réelle au LOT 6, seule la preuve
  d'origine est cassée.
- **LOT 3** (route réelle ENT inactif) — prouvé en PostgreSQL local réel
  (`recipe:local-code-vault-ent-inactif-route`, 23 assertions) : refus
  motivé, remise expirée jamais re-remise, quatrième affichage basculé sur
  formulaire. Resté supposé : aucune requête HTTP contre
  `api/vault/ent-inactif.ts` (preuve au niveau de `handleEntInactifVaultRequest`
  appelée directement, pas via un serveur Vercel démarré).
- **LOT 4** (cantine, Koxo, messagerie académique) — prouvé en PostgreSQL
  local réel (`recipe:local-code-vault-service-delivery-route`,
  31 assertions) : mêmes garanties assemblées sur les trois parcours,
  escalade support (`open_referral`) ouvrant un vrai ticket idempotent.
  Resté supposé : même limite que LOT 3 (pas de requête HTTP réelle) ; la
  délégation professeur principal → élève et l'accès `service`
  institution-wide restent des branches pures jamais exercées par une route
  réelle. Deux régressions préexistantes signalées, non corrigées (hors
  périmètre) : `recipe:local-code-vault-write-point` et
  `recipe:local-code-vault-adversarial` (scan littéral qui confond un
  commentaire et un appel réel).
- **LOT 5** (écran monté) — prouvé : bug réel du minuteur de presse-papier
  démontré puis corrigé (recette Chromium réelle, avant/après). **Trou
  bloquant non résolu, documenté explicitement par ce lot lui-même** : aucun
  point de lecture/déchiffrement n'a jamais été branché sur
  `code_vault_private_rows`. `CoffreEntInactifPage` est montée, mais son état
  `revealed` porte toujours `value: null` — la page ne peut aujourd'hui
  afficher aucun code, réel ou fictif, quelle que soit la route appelée.
  Décision de périmètre explicitement non prise par aucun lot (1 à 6) :
  ouvrir ce point de lecture est nommé par le plan comme nécessitant une
  validation humaine (`CLAUDE.md`, « codes d'accès... validation humaine »).
- **LOT 6** (recette adverse de bout en bout) — prouvé en PostgreSQL local
  réel via les routes assemblées (`handleEntInactifVaultRequest`,
  `handleServiceDeliveryVaultRequest`), 32 assertions : refus motivé et
  parent → enfant refusé par le même appel, membre d'un autre établissement
  ne voit rien (y compris au niveau du privilège de rôle base), remise après
  expiration exige une nouvelle preuve, quatrième affichage renvoie au
  formulaire, écriture réelle chiffrée puis relue sans fuite, balayage
  anti-fuite négatif sur trace/journal/réponse d'erreur/contexte de modèle.
  Non couvert : messagerie académique (ne remet jamais de code, hors
  périmètre des six garanties) et l'escalade support (déjà recettée au
  LOT 4).

Vérifié à nouveau pour cette clôture, aucun fichier `api/` ne référence
`decryptVaultCodeValue` ni `code-vault-crypto.ts` en dehors de sa propre
définition (`shared/code-vault-crypto.ts`) ; aucun fichier `api/` ne mentionne
un parcours « ENT actif » (`grep` sur `api/` : zéro résultat pour
`decideEntActifJourneyStep`, `ent-actif`, `EntActif`).

## T064 — peut être cochée

> « Concevoir et tester le coffre de codes Koxo, ENT et cantine : attribution
> unique, transaction concurrente, contrôle par rôle, affichage 30 minutes,
> trois consultations par jour et journal sans valeur secrète. »

Les six garanties du texte, contre les preuves :

1. **Attribution unique** et **transaction concurrente** — brique du
   5 septembre (`getOrCreateVaultAssignment`), non réécrite par ce plan,
   prouvée par `scripts/test-local-code-vault-assignment.mjs` et
   `scripts/code-vault-assignment-concurrency-worker.mjs` (PostgreSQL réel).
2. **Contrôle par rôle** — `requireRole(req, [...])` sur les quatre routes
   Vercel (LOT 3/4), rôles distincts par parcours (cantine : `eleve`
   seul ; ENT inactif, Koxo, messagerie académique : `eleve`/`professeur`).
3. **Affichage 30 minutes** — `isVaultDisplayStillVisible`, garde-fou du
   LOT 3, prouvé en PostgreSQL réel sur les deux routes assemblées (LOT 3,
   LOT 4, revérifié LOT 6).
4. **Trois consultations par jour** — quatrième affichage basculé sur
   `form_fallback`, prouvé en PostgreSQL réel sur ENT inactif (LOT 3) et sur
   cantine (LOT 6, choix délibéré de ne pas revérifier deux fois la même
   route).
5. **Journal sans valeur secrète** — c'est précisément la garantie que ce
   plan a fait passer d'« vraie seulement dans un script de recette » (état
   avant ce plan, nommé explicitement par le LOT 3) à vraie par du code
   applicatif réel : `api/_shared/code-vault-access-events.ts` journalise
   chaque décision (refus compris) depuis les routes réelles des LOT 3/4, et
   le balayage anti-fuite du LOT 6 confirme qu'aucune valeur n'apparaît
   jamais dans `code_vault_access_events`, sur le scénario complet.

Les six propriétés sont donc prouvées par du code applicatif réel, pas
seulement par des briques isolées ou des scripts qui imitent une route.
**T064 cochée** dans `specs/002-agent-etablissement-adaptatif/tasks.md`,
avec renvoi vers ce compte rendu. Réserve honnête, sans incidence sur le
texte de T064 : deux recettes de non-régression préexistantes échouent
toujours pour des raisons de forme de message déjà documentées (LOT 2/4/6),
pas de fond.

## T069 — ne peut pas être cochée, deux manques distincts

> « Construire avec données fictives les parcours ENT inactif et actif,
> cantine, Koxo et messagerie académique : preuve sur coordonnée officielle,
> composant sécurisé, aucun secret dans le modèle ou les journaux, et
> formulaire humain en cas d'échec. L'import réel reste fermé jusqu'à la
> recette du coffre. »

1. **« ENT actif » n'a jamais été construit.** La tâche nomme cinq parcours.
   Quatre ont une route réelle (`api/vault/{ent-inactif,cantine,koxo,
   messagerie-academique}.ts`). Aucun fichier du dépôt (`api/`) ne référence
   un parcours ENT actif — ni route, ni assemblage, ni page. Ce n'est pas un
   oubli de ce plan : ni le LOT 3 ni le LOT 4 ne le nomment (confirmé par
   leurs propres sections « portée non couverte »). Sur cinq parcours
   demandés par le texte de la tâche, un est entièrement absent.
2. **Le « composant sécurisé » n'affiche jamais de valeur, même fictive.**
   Le LOT 5 documente lui-même ce trou : aucun point de lecture/déchiffrement
   n'a jamais été branché sur `code_vault_private_rows`
   (`decryptVaultCodeValue` n'est appelée par aucun fichier de `api/`,
   reconfirmé ci-dessus). `CoffreEntInactifPage`, la seule page montée,
   atteint l'état `revealed` mais avec `value: null` en permanence : le
   composant `CodeVaultSecureDisplay` n'est donc jamais monté avec une valeur
   réelle par cette page, fictive ou non. « Construire... avec données
   fictives » un parcours qui remet un code suppose qu'un code, même fictif,
   soit un jour visible par la personne au bout du parcours réel — ce n'est
   le cas d'aucun des quatre parcours construits.

Les deux manques sont indépendants : corriger le second ne construit pas
« ENT actif », et construire « ENT actif » ne créerait pas de point de
lecture. **T069 reste non cochée.** Elle ne pourra l'être qu'après une
décision humaine explicite sur le point de lecture (nommée « trou bloquant »
par le LOT 5 lui-même, jamais tranchée depuis) et la construction d'un
parcours ENT actif qu'aucun lot de ce plan n'a jamais eu pour mandat de
livrer.

## Contrôles de clôture exécutés

- `node node_modules/typescript/bin/tsc --noEmit` — aucune erreur.
- `npx vite build` — succès (Windows), `CoffreEntInactifPage` toujours en
  chunk séparé, même avertissement préexistant de taille de chunk, sans
  rapport avec ce lot.
- `npm run test:preview-security-gate` — code de sortie 0, jusqu'à
  `test:migration-integrity` (108 migrations, 79 références vérifiées, aucun
  doublon).
- `npm run test:spec-integrity` — code de sortie 0, 5 specs, **635 tâches**
  recensées, dont désormais T064 cochée
  (`002-agent-etablissement-adaptatif` : 228 → 229 tâches complétées, 72 →
  71 ouvertes ; totaux non revérifiés ligne à ligne au-delà du compteur
  global du script, qui ne distingue pas quelle tâche a changé d'état).

Aucune recette PostgreSQL rejouée par ce lot (portée du LOT 7 : relecture et
clôture, pas de nouvelle preuve d'exécution métier) — les décomptes
d'assertions cités plus haut pour les LOT 1 à 6 sont ceux déjà consignés dans
`BRANCHE-LOT{1..6}.md`, non rejoués ici.

## Ce qui reste non résolu après ce plan, à trancher explicitement avec Adel

- Le point de lecture/déchiffrement du coffre (trou bloquant du LOT 5) :
  sans lui, aucun parcours ne peut jamais remettre un code à un utilisateur,
  quel que soit le nombre de lots futurs.
- Le parcours ENT actif, jamais nommé par ce plan, toujours sans aucune
  trace dans le dépôt.
- Deux recettes de non-régression cassées par leur propre forme, pas par le
  comportement qu'elles vérifient : `recipe:local-code-vault-write-point`
  (message d'erreur générique depuis le LOT 2, jamais mis à jour) et
  `recipe:local-code-vault-adversarial` (scan littéral qui confond un
  commentaire et un appel réel).
- T064A (décision de l'administration sur la remise enfant → parent) reste
  ouverte, hors périmètre de ce plan et de ce lot.

## Périmètre respecté

Aucun import de personne réelle, aucun email envoyé, aucun drapeau activé.
Aucune mutation Vercel, Supabase distant, VPS, DNS. Aucune lecture de
`~/Documents/LyceeGest-DONNEES-PRIVEES`. Aucun `git push`. Travail
entièrement fait dans cette session, aucune délégation à un agent en
arrière-plan. Aucune correction de code des LOT 1 à 6 (portée strictement
« clôture »). Commit local unique pour ce lot, avec chemins explicites,
limité aux fichiers du LOT 7
(`specs/002-agent-etablissement-adaptatif/tasks.md`,
`docs/operations/night-logs/BRANCHE-LOT7.md`). Les fichiers non liés à ce lot
déjà présents dans l'arbre de travail avant cette session
(`docs/operations/PLAN_CONNAISSANCE_OB1_2026-09-05.md`, `nuit.ps1`,
`.nuit-coffre.lock`, `nuit-coffre.ps1`, et le plan
`PLAN_BRANCHEMENT_COFFRE_2026-09-06.md` lui-même) n'ont pas été modifiés par
ce lot et ne sont pas inclus dans ce commit.
