# LOT 6 — Recette adverse de bout en bout

Plan : `docs/operations/PLAN_BRANCHEMENT_COFFRE_2026-09-06.md`, §LOT 6.
Portée stricte : une recette adverse de bout en bout, PostgreSQL local jetable,
qui assemble les **routes réelles** des LOT 3/4 (`handleEntInactifVaultRequest`,
`handleServiceDeliveryVaultRequest`), jamais `decideVaultAccess` appelée
directement. Aucune correction de code de LOT 1 à 5, aucune clôture de tâche
Spec Kit (LOT 7).

## Différence assumée avec la recette adverse du 5 septembre 2026

`scripts/test-local-code-vault-adversarial.mjs` (LOT 6 du plan du
5 septembre, non modifiée par ce lot) prouve les **briques** : elle appelle
`decideVaultAccess`, `getOrCreateVaultAssignment`, `recordVaultCodeDisplay`
directement. Le plan du 6 septembre est explicite : « cette fois l'assemblage
testé est celui de la route réelle, pas un script qui imite ce qu'une route
ferait ». `scripts/test-local-code-vault-branchement-adversarial.mjs`
(nouveau, ce lot) répète donc les mêmes garanties adverses (refus motivé,
parent → enfant, autre établissement) mais en les faisant transiter par les
fonctions assemblées `api/_shared/code-vault-ent-inactif-route.ts` (LOT 3) et
`api/_shared/code-vault-service-delivery-route.ts` (LOT 4), jamais par une
réimplémentation ni par la brique nue.

## Ce qui a été livré

- `scripts/test-local-code-vault-branchement-adversarial.mjs` — recette
  PostgreSQL réelle jetable, une seule transaction annulée en fin de script
  (savepoint pour le rejet volontaire), **32 assertions**, couvrant
  exactement les six garanties du texte du plan :
  1. **Un refus laisse une ligne motivée au journal — et parent → enfant
     reste refusé.** Un acteur `parent` visant `enfant-lot6-branche-01` via
     `handleServiceDeliveryVaultRequest` (parcours cantine) reçoit
     `{outcome: "denied", reason: "parent_to_child_forbidden"}`, sans champ
     `value` ; exactement une ligne `access_denied` motivée est écrite dans
     `code_vault_access_events` (acteur, profil, motif) ; aucune attribution
     n'est créée pour l'enfant. Les deux garanties du plan (« un refus laisse
     une ligne motivée » et « parent → enfant reste refusé ») sont prouvées
     par le **même** appel réel, parce que ce refus en est un exemple concret,
     pas un cas synthétique séparé.
  2. **Un membre d'un autre établissement ne voit rien.** Un acteur
     `service` de l'établissement B, visant l'établissement C via
     `handleServiceDeliveryVaultRequest` (parcours koxo, cible
     `institution_wide`), est refusé par `institution_mismatch` avant même
     la question du service ; une deuxième ligne motivée s'ajoute au journal
     de l'établissement C, et **zéro** ligne n'est jamais écrite sous
     l'établissement B lui-même — vérifié par une requête sur son propre
     `institution_id`, pas seulement par confiance dans le refus applicatif.
     Confirmation renforcée après annulation de la transaction, sur une
     connexion neuve : aucun rôle client (`anon`, `authenticated`, `public`)
     ne porte le moindre privilège sur les trois tables du coffre, quel que
     soit l'établissement visé — « ne voit rien » tient donc aussi au niveau
     du privilège de base, pas seulement de la décision applicative.
  3. **Une remise après expiration exige une nouvelle preuve.** Via
     `handleEntInactifVaultRequest` (parcours ENT inactif, self-service
     élève) : une première remise réussit (`outcome: "displayed"`, réponse
     limitée à `outcome`/`remainingDisplaysToday`/`revealedAt`, jamais de
     valeur) ; une tentative 60 minutes plus tard (fenêtre de 30 minutes
     dépassée) renvoie `{outcome: "step", action: {kind: "send_proof", ...}}`
     au lieu de re-remettre le code, sans incrémenter `display_count` ni
     avancer `revealed_at` — vérifié par relecture directe des colonnes.
  4. **Le quatrième affichage renvoie au formulaire.** Via
     `handleServiceDeliveryVaultRequest` (parcours **cantine**, distinct du
     parcours ENT inactif déjà recetté au LOT 3, pour prouver que la garantie
     tient sur les deux routes assemblées, pas seulement celle déjà
     recettée) : trois remises réussissent dans la fenêtre de 30 minutes,
     la quatrième bascule sur `{kind: "form_fallback", reasonCode:
     "cantine_daily_quota_exceeded"}`, sans incrémenter `display_count` une
     quatrième fois.
  5. **Une réponse d'erreur ne porte jamais de valeur, à la source réelle.**
     Sur l'attribution cantine créée par le scénario 4, `writeVaultCodeValue`
     (LOT 1, point d'écriture unique, non modifié) écrit réellement une
     valeur fictive chiffrée, relue et déchiffrée avec succès (round-trip
     complet — preuve qu'une vraie valeur a réellement transité, pas
     seulement une hypothèse) ; une deuxième écriture sur la **même**
     attribution (scénario réellement atteignable en production, contrairement
     au contournement par SQL brut du 5 septembre) est rejetée : l'erreur
     renvoyée par `writeVaultCodeValue` ne contient ni la première ni la
     seconde valeur fictive, et ne porte structurellement ni `cause` ni
     `detail` (garantie du LOT 2, revérifiée ici via le point d'écriture réel
     plutôt qu'une transaction fabriquée).
  6. **Balayage anti-fuite sur le scénario complet.** Un scan `ilike` sur les
     colonnes en texte libre de `code_vault_assignments` et
     `code_vault_access_events`, dans les deux établissements, confirme
     qu'aucun des deux marqueurs fictifs n'apparaît nulle part (« un
     journal ») ; `buildModelVisibleVaultFact` appliqué au refus parent →
     enfant confirme l'absence structurelle de champ `value` (« un contexte
     de modèle ») ; toute la sortie standard/erreur du script est capturée
     du tout premier import à la toute dernière ligne et balayée en fin
     d'exécution (« une trace ») — aucun des deux marqueurs n'y apparaît.
- `package.json` : une entrée ajoutée
  (`recipe:local-code-vault-branchement-adversarial`), au même emplacement
  que les recettes locales précédentes du coffre.

## Bug trouvé, pas un bug de ce lot : régression déjà connue reconfirmée

`writeVaultCodeValue` (LOT 1/2) rejette bien la deuxième écriture, mais son
message n'est plus `"duplicate key value violates unique constraint ..."`
depuis le LOT 2 (documenté par le LOT 4 comme régression préexistante de
`recipe:local-code-vault-write-point`, non corrigée à ce jour) : le message
réellement observé est le générique de la bibliothèque `drizzle`
(`"Failed query: insert into ..."`), et la vraie erreur Postgres (avec son
`constraint_name` et son `detail`) est reléguée dans un `error.cause` que
`sanitizePgError` ne lit jamais. Ce lot ne réaffirme donc **pas** le contenu
exact du message (ce serait rejouer le test déjà cassé), seulement la
garantie qui compte pour l'anti-fuite : ni la valeur ni `cause`/`detail` ne
sont jamais accessibles depuis l'erreur reçue par l'appelant. Correction hors
périmètre de ce lot (« un lot = une tâche Spec Kit ») ; à signaler explicitement
en LOT 7 aux côtés des deux régressions déjà notées par le LOT 4.

## Décisions de conception assumées

- Les scénarios « refus motivé » et « parent → enfant » sont **fusionnés en
  un seul appel réel** plutôt que dupliqués : un refus parent → enfant EST un
  refus motivé, les tester séparément aurait revérifié deux fois la même
  ligne de code pour deux phrases différentes du plan.
- Le scénario « quatrième affichage » utilise le parcours **cantine**
  (LOT 4), pas ENT inactif (déjà recetté par le LOT 3) : ce choix prouve que
  la garantie de quota tient sur l'assemblage factorisé
  `handleServiceDeliveryVaultRequest`, partagé par cantine et Koxo, pas
  seulement sur la route qui l'a introduite en premier.
- Le scénario « réponse d'erreur » réutilise le **point d'écriture réel**
  (`writeVaultCodeValue`) sur une attribution déjà créée par l'assemblage de
  ce script, plutôt qu'une insertion SQL brute contournant l'application
  (technique du 5 septembre) : plus proche d'un incident réellement
  atteignable (rejeu, double soumission), donc une preuve plus forte pour ce
  lot dont le mandat est « la route réelle », pas « la base nue ».
- Aucune tentative de contournement du chiffrement par SQL brut (scénario 8
  du 5 septembre) n'est reprise ici : ce risque (fuite de `detail` d'une
  violation `CHECK`) est déjà découvert, documenté et laissé en l'état par le
  plan du 5 septembre ; le répéter n'aurait rien ajouté à la preuve « route
  réelle » demandée par ce lot.

## Preuves réellement exécutées

Pile Supabase locale jetable (déjà démarrée au début de cette session),
jamais `--linked`, jamais `db push`, aucune URL distante :

- `npx supabase db reset` : les **108 migrations** du dépôt rejouées depuis
  zéro sans erreur (aucune migration ajoutée par ce lot).
- `npm run recipe:local-code-vault-branchement-adversarial` — exécuté deux
  fois de suite, **32 assertions** à chaque fois, résultat stable :
  `{"target":"127.0.0.1:54322","assertions":32,"rollbackVerified":true,"realData":false}`.
- Non-régression, réexécutées et au vert après ce lot :
  `npm run recipe:local-code-vault-ent-inactif-route` (23 assertions),
  `npm run recipe:local-code-vault-service-delivery-route` (31 assertions),
  `npm run recipe:local-code-vault-assignment` (29 assertions),
  `npm run test:code-vault-policy` (16), `npm run test:code-vault-delivery-policy`
  (5), `npm run test:code-vault-journeys` (8), `npm run test:code-vault-write-point`
  (7, sans base), `npm run test:code-vault-pg-error` (5),
  `npm run test:code-vault-ent-inactif-route` (6),
  `npm run test:code-vault-service-delivery-route` (14),
  `npm run test:code-vault-messagerie-academique-route` (8),
  `npm run test:code-vault-support-escalation` (4),
  `npm run test:code-vault-secure-display` (10),
  `npm run test:code-vault-ent-inactif-screen` (8),
  `npm run test:code-vault-ent-inactif-page` (6).
- Non-régression en échec, préexistante et non causée par ce lot (déjà
  signalée par le LOT 4, revérifiée ici sans modification) :
  `npm run recipe:local-code-vault-write-point`,
  `npm run recipe:local-code-vault-adversarial`.
- `node node_modules/typescript/bin/tsc --noEmit` — aucune erreur.
- `npx vite build` — succès (Windows), même avertissement préexistant de
  taille de chunk, sans rapport avec ce lot.
- `npm run test:preview-security-gate` — code de sortie 0, jusqu'à
  `test:migration-integrity` (108 migrations, aucun doublon).
- `npm run test:spec-integrity` — 5 specs, 635 tâches recensées, inchangé.

## Ce qui reste supposé, pas prouvé

- Aucune requête HTTP réelle contre `api/vault/{ent-inactif,cantine,koxo}.ts` :
  comme pour les LOT 3/4, la preuve porte sur les fonctions `handle*VaultRequest`
  appelées directement — c'est déjà la définition de « route réelle » retenue
  par ce plan (voir LOT 3), pas une nouvelle limite introduite par ce lot.
- La messagerie académique n'est pas incluse dans ce scénario adverse : elle
  ne remet jamais de code et n'a pas de refus d'accès de type `VaultActor`
  (voir LOT 4, `decideVaultAccess` ne s'applique pas à ce parcours) — aucune
  des six garanties du plan ne s'y applique.
- L'escalade support (`open_referral`, LOT 4) n'est pas exercée par ce
  scénario : aucune des cinq propriétés du plan §LOT 6 ne la nomme
  explicitement, et le LOT 4 l'a déjà recettée en base réelle.
- Le message exact de l'erreur de double écriture reste incorrect depuis le
  LOT 2 (voir section dédiée ci-dessus) — pas une fuite, mais une régression
  distincte à trancher en LOT 7.

## Portée délibérément non couverte par ce lot

- Aucune correction des deux régressions préexistantes déjà signalées par le
  LOT 4 (`recipe:local-code-vault-write-point`,
  `recipe:local-code-vault-adversarial`) — hors périmètre d'« un lot = une
  tâche Spec Kit ».
- Aucune clôture de tâche Spec Kit (T064, T069) — LOT 7.

## Périmètre respecté

Aucun import de personne réelle, aucun email envoyé, aucun drapeau activé.
Aucune mutation Vercel, Supabase distant, VPS, DNS. Toutes les recettes
tournent sur la pile Supabase locale jetable (`127.0.0.1:54322`), jamais
`--linked`, jamais `db push`, aucune URL distante. Aucune lecture de
`~/Documents/LyceeGest-DONNEES-PRIVEES`. Aucun `git push`. Travail
entièrement fait dans cette session, aucune délégation à un agent en
arrière-plan. Commit local unique pour ce lot, avec chemins explicites,
limité aux fichiers du LOT 6
(`scripts/test-local-code-vault-branchement-adversarial.mjs`, `package.json`,
ce compte rendu). Les fichiers non liés à ce lot déjà présents dans l'arbre
de travail avant cette session
(`docs/operations/PLAN_CONNAISSANCE_OB1_2026-09-05.md`, `nuit.ps1`,
`.nuit-coffre.lock`, `nuit-coffre.ps1`, et le plan
`PLAN_BRANCHEMENT_COFFRE_2026-09-06.md` lui-même) n'ont pas été modifiés par
ce lot et ne sont pas inclus dans ce commit.
