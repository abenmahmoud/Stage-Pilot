# LOT 7 — Clôture (2026-09-05)

Périmètre strict : `docs/operations/PLAN_COFFRE_CODES_2026-09-05.md`, LOT 7
uniquement — compte rendu global. Aucun code métier touché dans ce lot :
seule la lecture des six comptes rendus précédents (`COFFRE-LOT2.md` à
`COFFRE-LOT6.md` ; **aucun `COFFRE-LOT1.md` n'existe**, voir plus bas), du
plan, de `tasks.md` et du dépôt courant. `CLAUDE.md` appliqué intégralement.

## Ce que le plan a livré, en une phrase

Le contrat pur du coffre (autorisation, cycle de vie, quota, expiration,
cinq parcours) est écrit et testé, le schéma chiffré et le module
d'attribution/remise sont recettés sur PostgreSQL réel y compris de façon
adverse, le composant d'affichage sécurisé est recetté en Chromium réel —
mais **aucune route HTTP, aucune page, aucun formulaire n'assemble
aujourd'hui ces briques** : rien de tout cela n'est atteignable par un
utilisateur réel. C'est exactement la situation que le plan annonçait pour
ce LOT 7 (« ce qui est utilisable, simulé, à brancher »), pas un écart.

## Lot par lot, ce qui est réellement prouvé

- **LOT 1** — `shared/code-vault-policy.ts`, module pur (cycle de vie,
  matrice d'autorisation, type `ModelVisibleVaultFact` sans champ valeur).
  Testé (`test:code-vault-policy`, 16/16 d'après le LOT 3, qui l'a commité
  en rattrapage). **Aucun compte rendu `COFFRE-LOT1.md` n'a jamais été
  écrit** : trou de traçabilité du plan, constaté ici, non corrigé
  rétroactivement (reconstituer un compte rendu après coup ne prouverait
  rien de plus que ce que les LOT 3 et 6 ont déjà revérifié en le
  réutilisant).
- **LOT 2** — schéma chiffré (`code_vault_assignments`,
  `code_vault_private_rows`, `code_vault_access_events`), RLS forcée,
  aucun privilège `anon`/`authenticated`, contraintes de transition et
  d'immuabilité. Preuve PostgreSQL réelle (103 puis 104 migrations,
  requêtes `information_schema`/`pg_class`, scénarios en transaction
  annulée).
- **LOT 3** — attribution concurrente sûre, quota quotidien, expiration
  30 minutes, signalement défectueux, remplacement humain tracé
  (`api/_shared/code-vault-assignment.ts`). Preuve PostgreSQL réelle
  (`recipe:local-code-vault-assignment`, deux processus Node distincts,
  23 assertions). Le lot documente déjà, sans les combler, trois trous
  repris tels quels ci-dessous.
- **LOT 4** — `CodeVaultSecureDisplay.tsx`, composant seul, non monté.
  Preuve limitée à des vérifications statiques du code source (9/9) au
  moment du lot — aucun rendu réel, comblé ensuite par le LOT 6.
- **LOT 5** — `shared/code-vault-journeys.ts`, orchestration pure des cinq
  parcours (ENT inactif/actif, cantine, Koxo, messagerie académique),
  8/8 tests. Le lot dit lui-même : « aucune route HTTP, aucun appel réseau,
  aucune écriture en base » — un contrat d'orchestration, pas un parcours
  branché.
- **LOT 6** — recette adverse sur PostgreSQL réel (44 assertions, deux
  exécutions identiques) assemblant manuellement dans un script de test ce
  qu'une future route ferait (autorisation → attribution → remise), plus
  recette Chromium réelle du composant à 320/390/1440 px (16 assertions).
  Ce lot documente explicitement trois écarts de branchement (repris
  ci-dessous) et confirme par balayage qu'aucune valeur de code n'a fui
  dans une sortie capturée.

## Ce que ce LOT 7 ne cochera pas, et pourquoi

Le plan est explicite : « Ne cocher T064 et T069 que si elles le sont
vraiment. » Lecture du texte exact des deux tâches contre les preuves
ci-dessus :

- **T064** (« Concevoir et tester le coffre de codes Koxo, ENT et cantine :
  attribution unique, transaction concurrente, contrôle par rôle, affichage
  30 minutes, trois consultations par jour et journal sans valeur secrète »)
  — la conception et une bonne part des tests tiennent (LOT 1 à 3, recette
  adverse du LOT 6). Mais le texte promet un **journal sans valeur
  secrète**, et le LOT 3 comme le LOT 6 constatent tous les deux que
  `code_vault_access_events` **n'est alimenté par aucun code applicatif** :
  le LOT 6 y insère des lignes directement en SQL pour prouver que le
  schéma accepte un refus motivé, pas qu'un vrai chemin de refus les y
  écrit. Un journal qui n'existe que dans un script de recette n'est pas un
  journal testé. **Non cochée.**
- **T069** (« Construire avec données fictives les parcours ENT inactif et
  actif, cantine, Koxo et messagerie académique : preuve sur coordonnée
  officielle, composant sécurisé, aucun secret dans le modèle ou les
  journaux, et formulaire humain en cas d'échec ») — le mot est
  « construire », pas « concevoir ». Le LOT 5 déclare lui-même n'avoir posé
  aucune route, aucun appel réseau ; le LOT 6 confirme qu'aucune route HTTP
  réelle n'assemble encore LOT 1 + LOT 3 + LOT 4 + LOT 5. Il n'existe
  aujourd'hui aucune page, aucun formulaire, aucun bouton qu'un utilisateur
  pourrait suivre pour l'un de ces cinq parcours. **Non cochée.**

Aucune autre case de `tasks.md` n'est touchée par ce LOT 7.

## Preuves exécutées pendant ce LOT 7

- `node node_modules/typescript/bin/tsc --noEmit` → aucune erreur.
- `npx vite build` → succès (Windows), `dist/` produit sans erreur ;
  `npm run build` ne tourne pas dans ce shell (binaires natifs Windows de
  rollup absents), piège déjà noté dans `CLAUDE.md`.
- `npm run test:preview-security-gate` → code de sortie `0`, sortie
  complète (2340 lignes) relue par recherche de `fail [1-9]` / `not ok` /
  `AssertionError` : aucune occurrence.
- `npm run test:spec-integrity` → `635` tâches, `5` specs, inchangé depuis
  le LOT 6 (aucune tâche cochée par ce lot) : spec 002 à 228 tâches closes,
  72 ouvertes.
- `npm run test:migration-integrity` → `104` migrations, `104` versions
  uniques, `78` références vérifiées — inchangé.

Aucune de ces preuves n'est une nouvelle recette PostgreSQL ni navigateur :
ce lot est un compte rendu, pas une nouvelle exécution fonctionnelle. La
pile Supabase locale n'a pas été redémarrée pour ce lot.

## Ce qui est utilisable, simulé, à brancher

**Utilisable tel quel, si un futur lot l'importe sans le réécrire :**

- `shared/code-vault-policy.ts` — autorisation, cycle de vie, quota,
  expiration.
- `db/schema.ts` + migrations `20260905170000`/`20260905180000` — schéma
  chiffré déjà appliqué en local, prêt pour une route réelle.
- `api/_shared/code-vault-assignment.ts` — attribution/remise, testé
  concurrent.
- `shared/code-vault-journeys.ts` — décisions des cinq parcours.
- `src/components/CodeVaultSecureDisplay.tsx` — affichage, testé en
  Chromium réel isolément.

**Simulé seulement (prouvé en script de recette, jamais par un appel
applicatif réel) :**

- L'assemblage complet autorisation → attribution → remise → affichage : il
  n'existe que dans `scripts/test-local-code-vault-adversarial.mjs`.
- Le journal d'accès `code_vault_access_events` : les lignes existent en
  base uniquement parce que les scripts de recette les y insèrent
  directement.

**À brancher avant tout usage réel (aucun code n'existe encore pour ceci) :**

- Une route HTTP par parcours (ENT, cantine, Koxo, messagerie académique)
  qui enchaîne réellement `decideVaultAccess` →
  `getOrCreateVaultAssignment`/`recordVaultCodeDisplay` →
  `CodeVaultSecureDisplay`, et qui écrit dans
  `code_vault_access_events` à chaque décision, y compris un refus.
- Le branchement de `quota_exceeded` sur `form_fallback` (le type existe
  dans `code-vault-journeys.ts`, rien ne l'invoque).
- Une exigence de nouvelle preuve d'identité après l'expiration des
  30 minutes avant une nouvelle remise — `recordVaultCodeDisplay` ignore
  aujourd'hui `isVaultDisplayStillVisible`, constaté par la recette du
  LOT 6.
- La règle « ne journaliser que le message court d'une erreur PostgreSQL,
  jamais son `detail` » pour toute future route insérant dans
  `code_vault_private_rows` (le `detail` d'une violation `CHECK` répète la
  ligne refusée en clair — trouvé par le LOT 6, personne ne journalise
  cette erreur aujourd'hui donc pas de fuite actuelle, mais la règle doit
  être écrite avant qu'un appelant existe, pas après).
- Le lien entre `open_referral` et une vraie file de support
  (`support-agent-access.ts`) : aujourd'hui une décision pure, aucun
  ticket réel créé.

**Drapeaux :** aucun drapeau dédié n'existe pour le coffre de codes, dans un
sens comme dans l'autre — normal, puisque rien n'est monté sur aucune route
ni page. Ce n'est pas une fermeture volontaire par interrupteur, c'est
l'absence de tout point d'entrée.

## Ce qu'Adel doit trancher avant d'aller plus loin

1. **T064A — remise d'un code d'enfant à un parent.** `decideVaultAccess`
   refuse aujourd'hui structurellement (`parent_to_child_forbidden`,
   revérifié par la recette adverse du LOT 6). Le formulaire enrichi reste
   la seule voie tant qu'aucune décision de l'administration n'autorise
   autre chose. Rien à faire côté code avant cette décision.
2. **T063A — fournisseur OTP téléphone.** Aucun fournisseur n'existe dans ce
   dépôt (vérifié : aucune référence OTP téléphone en dehors du canal email
   déjà utilisé par `api/identity/device/request.ts`/`verify.ts`). Budget,
   consentements et quotas restent à définir avant tout code : le contrat
   du LOT 1/5 accepte déjà `phone` comme canal de preuve, mais aucun
   fournisseur ne peut l'exercer.
3. **Circuit d'import réel des codes.** Interdit par la règle de périmètre
   du plan tant que la recette du coffre et l'autorisation d'Adel ne sont
   pas données. Ce LOT 7 ne change rien à cette fermeture : aucun fichier
   de codes réels n'a été lu, importé ni référencé.

## Preuves manquantes, au sens strict

- Aucune preuve qu'une route HTTP réelle enchaîne les quatre briques pour
  un utilisateur : n'existe pas encore, donc pas testable.
- Aucune preuve que le journal d'accès reçoit une ligne à l'occasion d'un
  vrai refus applicatif (LOT 3 et LOT 6 : uniquement en SQL direct).
- Aucune preuve navigateur de bout en bout d'un des cinq parcours (LOT 5
  n'a aucune page, LOT 6 ne recette que le composant isolé).
- Aucune preuve sur un projet Supabase distant (interdit par `CLAUDE.md`,
  rappel volontaire, pas un oubli).

## Portée strictement respectée

Rien d'autre que ce compte rendu n'a été écrit par ce LOT 7 : aucune route,
aucun module, aucune migration, aucune case cochée ou décochée dans
`tasks.md`. Aucun drapeau ouvert, aucun envoi réel, aucune donnée réelle,
aucune lecture de `~/Documents/LyceeGest-DONNEES-PRIVEES`. Aucun `git push`.
Un seul commit local, comme les six lots précédents.
