# LOT 7 — Tests adverses obligatoires (plan de connaissance OB1, 2026-09-05)

Plan : `docs/operations/PLAN_CONNAISSANCE_OB1_2026-09-05.md`, section « LOT 7 »
et sa note d'état du 6 septembre 01 h 20 (« ce lot n'a PAS abouti »). Ce
compte rendu couvre exactement la reprise demandée par cette note, dans
**une seule session, sans délégation à un agent en arrière-plan**, comme
exigé.

## État de départ (rappel honnête)

Ce qui existait déjà réellement sur le disque avant cette session :
`scripts/test-knowledge-recall-adverse.mjs` (428 lignes, non suivi par git),
10/10 tests purs passants. Ce qui manquait, listé nommément par la note
d'état :

1. l'entrée `package.json` — absente ;
2. la recette PostgreSQL locale réelle pour les points 3, 5, 6 et 9 — absente ;
3. le point 7, qui se déclarait déjà lui-même « couverture partielle » ;
4. le manque fonctionnel du point 9 (idempotence absente pour une proposition
   issue d'une conversation) — non corrigé ;
5. le commit et ce compte rendu.

## 1. Entrée `package.json` (fait)

`test:knowledge-recall-adverse` et `recipe:local-knowledge-recall-adversarial`
ajoutés (`package.json`), branchés sur le fichier de tests purs existant et
sur la nouvelle recette locale (ci-dessous). Rejoués avec succès :

```
npm run test:knowledge-recall-adverse
  → tests 10, pass 10, fail 0
```

## 2. Recette PostgreSQL locale réelle (fait, nouveau fichier)

`scripts/test-local-knowledge-recall-adversarial.mjs` (475 lignes), même
convention que `scripts/test-local-knowledge-source-proposal-flow.mjs` (LOT 5) :
établissement, comptes et actualité entièrement fictifs, sur la pile Supabase
locale jetable (`postgresql://postgres:postgres@127.0.0.1:54322/postgres`,
codé en dur, n'hérite jamais de `DATABASE_URL`/`.env`). Quatre scénarios,
rejoués avec succès (`recipe:local-knowledge-recall-adversarial`,
**20 assertions, `outcome: "pass"`**) :

1. **Point 3** — une actualité seulement `validee` (jamais publiée) : la
   route `api/flash/proposals/[id]/knowledge.ts` refuse avec 409, et
   `select count(*) from knowledge_source_proposals where origin_flash_info_id = …`
   confirme **zéro ligne créée**.
2. **Point 9** — voir section dédiée ci-dessous.
3. **Point 5** — une source publiée, courante, requise par une compétence
   active, mais `provenance_status = 'disputed'` : absente du contexte réel
   construit par `loadPublicKnowledgeContext`. Un témoin (source équivalente
   `imported`, non contestée) est présent dans ce même contexte, ce qui
   prouve que l'absence vient bien de la contestation et non d'un autre défaut
   de câblage.
4. **Point 6** — deux sources publiées et courantes, l'une hors audience
   (service requis `intendance` absent de l'acteur, qui n'a que
   `vie_scolaire`), l'autre hors rôle (classification `internal` pour un
   acteur visiteur I0) : toutes deux absentes du contexte réel construit,
   chacune vérifiée avec l'acteur pertinent, le témoin public restant présent
   pour les deux acteurs.

`npx supabase db reset` rejoué en entier au début de cette session **et** de
nouveau après l'ajout de la nouvelle migration : **108 migrations, 108
versions uniques**, aucun échec. Incident secondaire réglé au passage : Docker
Desktop était documenté comme indisponible lors des sessions précédentes
(`CLAUDE.md`, « Bloquant » du 3 septembre) — il était disponible ce soir, et
l'intégralité des 108 migrations a été rejouée avec succès sur PostgreSQL réel
à trois reprises pendant cette session.

**Détail de procédure, à connaître pour toute reprise future** : les deux
routes appelées par cette recette (`requireKnowledgeManager`) exigent une
session `aal2` réelle, quel que soit l'appel — même contrainte que documentée
au LOT 5. `supabase/config.toml` a donc été basculé temporairement
(`auth.mfa.totp.enroll_enabled`/`verify_enabled` à `true`), la pile relancée
**sans `db reset`** (`supabase stop` puis `supabase start`, données
conservées), la recette rejouée, puis le fichier remis exactement à son état
d'origine — `git status --porcelain=v1 -- supabase/config.toml` confirmé vide
après coup. Même procédure que `OB1-LOT5.md`/`PUB-LOT4.md`.

## 3. Point 7 (couverture partielle, non comblée — hors périmètre assumé)

Le fichier de tests purs documente déjà lui-même, depuis avant cette session,
que seule l'intention `opening_hours` a un garde-fou déterministe quand
`publicKnowledgeContext.sources.length === 0` ; aucune question informationnelle
générale n'a d'équivalent, la prudence reposant alors uniquement sur une
instruction de prompt (jamais garantie par du code). Cette session n'a **pas**
comblé ce manque : la note d'état de reprise demandait de « compléter ou dire
précisément ce qui reste hors couverture », et le fichier le dit déjà
précisément (assertion qui échouerait si un second garde-fou apparaissait sans
mise à jour du commentaire). Ajouter un second garde-fou déterministe est un
changement de comportement du support agent, pas un test — hors périmètre d'un
lot de tests adverses, à trancher comme un lot à part.

## 4. Point 9 — manque fonctionnel corrigé

### Ce qui était démontré avant cette session

`api/flash/proposals/[id]/knowledge.ts` (proposition issue d'une actualité
publiée) garantit déjà l'idempotence : une seule proposition active à la fois
par actualité (`existingBlocks`). `api/knowledge/admin/proposals/index.ts`
(proposition « issue d'une discussion ») n'avait **aucune** garantie
équivalente : deux soumissions identiques créaient deux lignes distinctes.

### Correction apportée

Même motif que `flash_infos.idempotency_key_hash`
(`20260905110000_add_flash_proposal_idempotency.sql`) : le client fournit un
identifiant d'envoi dans l'en-tête `Idempotency-Key`, jamais dans le corps
(comparer le corps aurait échoué dès qu'un signal de vie privée retire le
texte proposé avant stockage — `proposedText` devient alors `NULL`).

- **Migration** `supabase/migrations/20260906040000_add_knowledge_source_proposal_conversation_idempotency.sql` :
  colonne `idempotency_key_hash` (nullable — toujours `NULL` pour une
  proposition `flash_publication`, qui a déjà sa propre garantie), contrainte
  de format (`^[0-9a-f]{64}$`), contrainte d'origine (non nul seulement pour
  `conversation`), index unique `(institution_id, idempotency_key_hash)` — un
  index unique simple suffit : Postgres ne compare jamais deux `NULL` comme
  égaux, donc les lignes `flash_publication` ne se bloquent jamais entre
  elles. Champ ajouté à la liste des colonnes immuables du déclencheur
  `knowledge_source_proposals_immutable_origin_guard` (LOT 5).
- **Schéma** (`db/schema.ts`) : colonne et index reflétés.
- **Route** (`api/knowledge/admin/proposals/index.ts`) : réutilise
  `idempotencyKey`/`sha256` déjà partagés (`api/_shared/support.ts`, même
  fonctions que celles dupliquées par `api/_shared/flash-idempotency.ts` pour
  flash) — pas de troisième copie. `onConflictDoNothing` sur
  `(institutionId, idempotencyKeyHash)` puis relecture de la ligne existante
  en cas de conflit (même transaction), avec vérification que le rejeu vient
  bien du même auteur (`proposedBy`), même garde que côté flash. La réponse
  gagne un champ `duplicate: boolean`. L'écriture d'audit
  (`agent_skill_audit`) n'a lieu que sur une création réelle, jamais sur un
  rejeu.

### Portée exacte, documentée pour ne pas être sur-affirmée

Ce n'est **pas** une déduplication par contenu. La garantie porte sur le
**même envoi rejoué** (même clé `Idempotency-Key`, même motif que
`api/flash/proposals/index.ts`) — un double-clic ou une requête réseau
rejouée ne crée jamais une seconde ligne. Une **nouvelle** soumission
délibérée avec un nouveau texte (ou le même texte, mais une nouvelle clé
d'envoi) sur la même conversation crée bien une seconde ligne : ce n'est pas
la garantie que le plan demandait de refuser. La recette
(`scripts/test-local-knowledge-recall-adversarial.mjs`, scénario point 9)
prouve explicitement les deux faces : même clé rejouée deux fois → une seule
ligne, même identifiant de proposition renvoyé (`duplicate: true`) ; nouvelle
clé → nouvelle ligne, nouvel identifiant.

### Test 9 du fichier pur, mis à jour en conséquence

`scripts/test-knowledge-recall-adverse.mjs`, test 9 : les anciennes
assertions documentant l'absence de garantie ont été remplacées par des
assertions positives (présence de `idempotencyKey(req)`, `onConflictDoNothing`
et de la relecture `.select()` dans la branche POST). Rejoué : toujours
10/10.

## 5. Non-régression vérifiée

- `scripts/test-local-knowledge-source-proposal-flow.mjs` (recette LOT 5)
  rejouée intégralement avec l'en-tête `Idempotency-Key` désormais requis
  pour son scénario 7 (seul appel affecté) : **28 assertions, `outcome:
  "pass"`**, aucune régression sur les scénarios 1 à 8 (flash → connaissance,
  aal2, révocation par correction, contraintes rejetées).
- `node node_modules/typescript/bin/tsc --noEmit` : aucune erreur.
- `npm run build` (`tsc --noEmit && vite build`) : succès, code 0 — `vite
  build` a bien tourné dans ce shell ce soir (contrairement au piège documenté
  dans `CLAUDE.md` pour une session antérieure).
- `npm run test:preview-security-gate` : code 0, aucun `fail [1-9]`, `not ok`,
  `✖` ni `Error:` sur la sortie complète.
- `npm run test:spec-integrity` : code 0, 635 tâches, 5 specs, inchangé dans
  sa structure.
- `npm run test:migration-integrity` : 108 migrations, 108 versions uniques.
- Suites ciblées supplémentaires, toutes code 0 : `test:knowledge-source-
  proposal-policy`, `test:knowledge-source-proposal-boundaries`,
  `test:knowledge-registry-security`, `test:knowledge-actor`,
  `test:knowledge-expiry`, `test:knowledge-freshness-schedule`,
  `test:knowledge-use-policy`, `test:knowledge-request-body-bounds`,
  `test:knowledge-registry-admin-payload`, `test:knowledge-registry-admin-
  action-payload`, `test:api-request-body-boundary-coverage`, `test:api-
  method-boundary-coverage`, `test:private-route-auth-coverage`, `test:no-
  body-command-security`.

## Limites restantes

- Le point 7 reste à couverture partielle, assumé et documenté (section 3
  ci-dessus) — pas un oubli, une décision de périmètre.
- L'idempotence du point 9 protège le rejeu d'un même envoi, pas la
  déduplication de contenu identique soumis délibérément deux fois sous deux
  enveloppes différentes — portée assumée, alignée sur le seul précédent du
  dépôt (flash).
- Cette recette n'a pas rejoué de preuve navigateur (Chromium) : aucune n'était
  demandée par ce lot, contrairement au domaine flash (LOT 8 de ce domaine-là).
- `.nuit.lock`, `nuit.ps1`, `docs/operations/PLAN_CONNAISSANCE_OB1_2026-09-05.md`
  (modifié) et `docs/operations/PLAN_BRANCHEMENT_COFFRE_2026-09-06.md` /
  `nuit-coffre.ps1` étaient déjà présents/modifiés avant cette session (autre
  travail en cours, hors périmètre strict du LOT 7) : **non touchés, non
  inclus dans le commit de ce lot**, conformément à la consigne de chemins
  explicites.

## Fichiers touchés par ce lot

- `supabase/migrations/20260906040000_add_knowledge_source_proposal_conversation_idempotency.sql` (nouveau)
- `db/schema.ts` (colonne + index)
- `api/knowledge/admin/proposals/index.ts` (idempotence)
- `scripts/test-knowledge-recall-adverse.mjs` (nouveau au dépôt git — déjà
  présent sur disque avant cette session ; test 9 mis à jour)
- `scripts/test-local-knowledge-recall-adversarial.mjs` (nouveau)
- `scripts/test-local-knowledge-source-proposal-flow.mjs` (en-tête d'envoi
  ajouté à un appel existant)
- `package.json` (deux entrées de script)
- `docs/operations/night-logs/OB1-LOT7.md` (ce fichier)

## Ordre recommandé pour la suite

1. LOT 8 (clôture honnête du plan de connaissance), qui existe déjà comme
   section du plan — vérifier s'il a déjà été exécuté ailleurs avant de le
   relancer.
2. Décider si le point 7 (garde-fou déterministe généralisé) mérite un lot
   dédié, et avec quelle portée exacte (quelles intentions, quel message).
3. Si une déduplication par **contenu** (et pas seulement par enveloppe) est
   un jour désirée pour les propositions de conversation, la trancher comme
   décision de conception explicite (quelle définition d'« identique » :
   texte exact, texte normalisé, fenêtre de temps ?) plutôt que de l'ajouter
   silencieusement.
