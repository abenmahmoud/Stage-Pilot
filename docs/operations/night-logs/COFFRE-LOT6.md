# LOT 6 — Recette adverse sur PostgreSQL réel

Plan : `docs/operations/PLAN_COFFRE_CODES_2026-09-05.md`, §LOT 6. Portée
stricte : recette adverse assemblant les briques déjà livrées isolément
(LOT 1 `decideVaultAccess`, LOT 3 `api/_shared/code-vault-assignment.ts`),
avec des personnes et établissements entièrement inventés, sur PostgreSQL
réel jetable. Puis recette navigateur réelle du composant sécurisé (LOT 4) à
320, 390 et 1 440 px. Ce lot n'ajoute aucune route, aucune migration, aucune
règle métier nouvelle : il teste et documente l'assemblage existant.

## Ce qui a été livré

- `scripts/test-local-code-vault-adversarial.mjs` +
  `npm run recipe:local-code-vault-adversarial` (`--local-stack-only`
  obligatoire, cible codée en dur `127.0.0.1:54322`, n'hérite jamais de
  `DATABASE_URL`) : recette adverse en neuf scénarios, réutilisant sans
  réimplémenter `decideVaultAccess` (LOT 1), `getOrCreateVaultAssignment`,
  `recordVaultCodeDisplay`, `flagVaultCodeDefective` (LOT 3), et le worker de
  concurrence du LOT 3 (`code-vault-assignment-concurrency-worker.mjs`,
  réutilisé tel quel).
- `scripts/test-code-vault-secure-display-browser-recette.mjs` +
  `npm run recipe:local-code-vault-secure-display-browser`
  (`--local-browser-only` obligatoire) : recette Chromium réelle du
  composant `CodeVaultSecureDisplay` (LOT 4), servi par un module virtuel
  Vite (même technique que `scripts/serve-support-recovery-fixture.mjs`),
  sans route, sans backend, sans authentification — le composant reçoit une
  valeur et un horodatage fictifs en props, exactement comme le fera un
  appelant réel futur.
- `package.json` : deux nouvelles entrées, `recipe:local-code-vault-
  adversarial` et `recipe:local-code-vault-secure-display-browser`. Aucune
  autre entrée touchée.

## Preuves réellement exécutées

Pile Supabase locale jetable (Docker Desktop disponible aujourd'hui), jamais
`--linked`, jamais `db push`, aucune URL distante :

- `npx supabase start` puis `npx supabase db reset` : **104 migrations**
  rejouées depuis zéro sans erreur (aucune migration ajoutée par ce lot).
- `npm run recipe:local-code-vault-adversarial` — exécuté deux fois de
  suite, **44 assertions** à chaque fois, mêmes résultats :
  1. **Concurrence réelle, porte d'autorisation comprise** : `decideVaultAccess`
     vérifié `allowed` avant de lancer deux vrais processus Node séparés
     (deux connexions Postgres distinctes) sur le même quadruplet — les deux
     retournent le même `id`, `count(*) = 1`.
  2. **Quatrième affichage refusé** : 1er/2e/3e acceptés, 4e →
     `quota_exceeded`, compteur resté à 3 (pas d'incrémentation sur un
     refus). Le code source (`decideVaultDisplayQuota`, LOT 3) documente que
     « le formulaire enrichi prend le relais » au-delà du quota — voir écart
     ci-dessous sur le branchement réel de cette bascule.
  3. **Expiration à 30 minutes** : `isVaultDisplayStillVisible` vérifié
     `true` à +1 minute et `false` à +31 minutes sur un horodatage réel de
     remise stocké en base.
  4. **Code défectueux, aucune réattribution automatique** :
     `flagVaultCodeDefective` puis tentative d'affichage →
     `{ outcome: "defective" }`, compteur inchangé ;
     `canAutoReplaceDefectiveVaultCode()` structurellement `false` ; ET
     vérification par lecture de fichiers (pas de confiance) qu'aucun
     fichier de `api/` ou `workers/` — hors la définition elle-même — n'
     appelle `traceManualVaultCodeReplacement` : aucune route ne peut donc
     déclencher un remplacement, encore moins automatiquement.
  5. **Parent → enfant refusé** : `decideVaultAccess` → `parent_to_child_
     forbidden` ; événement `access_denied` inséré et relu dans
     `code_vault_access_events` ; confirmé qu'aucune attribution n'a été
     créée pour l'enfant visé par cette tentative ; confirmé que
     `ModelVisibleVaultFact` ne porte structurellement aucun champ `value`.
  6. **Professeur principal hors de ses classes validées** :
     `decideVaultAccess` → `professeur_principal_class_not_validated` pour
     une classe hors périmètre ; **contrôle positif** dans la même
     transaction : le même professeur principal, sur une classe qu'il valide
     réellement, est autorisé et le chemin complet (autorisation → attribution
     → remise) réussit — la frontière est exacte, pas une fermeture générale.
  7. **Membre d'un autre établissement, ne voit rien** :
     `decideVaultAccess` → `institution_mismatch` pour un acteur `service`
     d'un établissement fictif B ciblant l'établissement fictif C. Revérifié
     en plus au niveau du privilège de base (RLS bout en bout, comme annoncé
     en attente par le LOT 3) : `role_table_grants` confirme qu'`anon` et
     `authenticated` n'ont **aucun** privilège sur les trois tables du
     coffre, quelle que soit l'institution visée — la garantie ne dépend pas
     de la décision applicative seule.
  8. **Tentative de contournement du chiffrement** (adverse, hors liste
     initiale du plan mais découverte en construisant le balayage anti-fuite) :
     insertion directe d'une chaîne en clair dans `code_vault_private_rows.
     ciphertext` → rejetée par la contrainte de forme
     (`code_vault_private_rows_ciphertext_check`). Voir « écart trouvé »
     ci-dessous : le **message court** de l'erreur ne porte jamais la valeur,
     mais le **`detail`** renvoyé par PostgreSQL pour une violation `CHECK`
     inclut la ligne complète refusée.
  9. **Round-trip AES-256-GCM réel** sur une clé locale éphémère (jamais une
     clé de production) : valeur fictive chiffrée, stockée, relue, déchiffrée
     à l'identique ; le chiffré stocké ne contient jamais la valeur en
     clair ; balayage du contenu des colonnes texte libres
     (`defective_reason`, `refusal_reason`, `person_ref`, etc.) pour le
     marqueur fictif → 0 résultat.
  - Après annulation complète de la transaction (scénarios 2 à 9) :
    connexion de vérification séparée confirmant `count = 0` sur
    l'établissement fictif C — aucune trace laissée.
  - Balayage final : le marqueur de valeur fictive (`LOT6-VALEUR-FICTIVE-…`)
    n'apparaît dans **aucune** ligne de sortie capturée pendant toute
    l'exécution du script (`console.log`/`console.error` interceptés).
  - Rebalayage `information_schema.columns` (motif
    `value|plain|clair|code_value|secret`) sur les trois tables du coffre :
    **0 résultat**, RLS forcée confirmée sur les trois tables.
- `npm run recipe:local-code-vault-secure-display-browser` — exécuté deux
  fois de suite, **16 assertions** à chaque fois, Chromium réel (headless) :
  - valeur fictive rendue dans l'élément `<code>` non éditable attendu ;
  - titre de page et URL ne portent jamais la valeur ; aucun `<input>`,
    aucun lien `download`, aucun `<table>` ;
  - **compte à rebours réellement observé** (pas seulement présent dans le
    code source, contrairement au LOT 4) : format `mm:ss` vérifié, la
    lecture change réellement après 1,1 seconde d'attente ;
  - **copie presse-papier réellement exercée** dans Chromium (permissions
    accordées explicitement) : le presse-papier contient bien la valeur
    fictive après le clic, le texte visible du bouton passe à « Copié » ;
  - recette responsive 320/390/1 440 px : **aucun débordement horizontal**
    aux trois largeurs, cible tactile du bouton de copie à **40 px** exactement
    aux trois largeurs, captures d'écran enregistrées (non commitées,
    `.vercel/` est ignoré par git) et relues visuellement — rendu correct,
    pas de largeur fixe qui casse à 320 px ;
  - aucune erreur de console JavaScript pendant tout le scénario.
- `node node_modules/typescript/bin/tsc --noEmit` : aucune erreur.
- `npx vite build` : succès (Windows) — `npm run build` ne tourne pas dans ce
  shell (binaires natifs Windows de rollup absents), piège déjà noté dans
  `CLAUDE.md`.
- `npm run test:preview-security-gate` : code de sortie `0`, jusqu'à
  `test:migration-integrity` → `104` migrations, `104` versions uniques,
  `78` références vérifiées (inchangé, ce lot ne touche aucune migration).
- `npm run test:spec-integrity` : `5` specs, `635` tâches recensées, aucune
  anomalie.
- Non-régression : `test:code-vault-policy` (16/16), `test:code-vault-
  delivery-policy` (5/5), `test:code-vault-secure-display` (9/9),
  `test:code-vault-journeys` (8/8), `recipe:local-code-vault-assignment`
  (23 assertions) — tous encore verts après ce lot.

La pile locale a été arrêtée (`npx supabase stop`) après vérification.
Aucun fichier temporaire créé sur le disque par les deux scripts de ce lot
(le harnais navigateur sert un module virtuel Vite, jamais un fichier écrit
puis supprimé) ; les captures d'écran vivent sous `.vercel/code-vault-
recette/`, ignoré par git.

## Écarts trouvés (à consigner pour Adel, pas corrigés dans ce lot — hors
périmètre d'une recette)

1. **Aucune route n'exige de nouvelle vérification d'identité après
   l'expiration des 30 minutes avant une nouvelle remise.**
   `recordVaultCodeDisplay` (LOT 3) ne connaît que le quota quotidien (par
   date) et le statut défectueux ; il ignore complètement
   `isVaultDisplayStillVisible`. Prouvé dans ce lot : un jour calendaire
   plus tard (quota reparti à zéro), une attribution expirée depuis
   longtemps est remise à nouveau sans aucun signal de nouvelle preuve
   d'identité. Ce n'est pas un défaut du module LOT 3 (il ne prétend pas
   porter cette règle) : c'est l'absence de la route qui devrait la porter.
   Déjà pressenti par le compte rendu du LOT 3 ; ce lot le démontre
   explicitement par une recette exécutée, pas par une lecture de code.
2. **`quota_exceeded` n'est branché sur aucune bascule « formulaire
   enrichi ».** `shared/code-vault-journeys.ts` a bien un type
   `form_fallback`, mais rien dans le code ne fait le lien entre un
   quatrième affichage refusé et une invitation à passer par le formulaire :
   la phrase du plan (« le formulaire prend le relais ») décrit l'intention,
   documentée dans un commentaire de `code-vault-policy.ts`, mais aucune
   route ne la réalise encore.
3. **Le `detail` d'une violation de contrainte `CHECK` PostgreSQL contient la
   ligne refusée en clair**, y compris toute valeur qu'un appelant tenterait
   d'insérer directement dans `code_vault_private_rows.ciphertext` (par
   exemple par une erreur de contournement du chiffrement applicatif).
   Vérifié concrètement dans ce lot : le message court de l'erreur reste
   propre, mais son `detail` (`Failing row contains (...)`) répète le
   marqueur fictif en clair. Aujourd'hui, personne ne journalise cette
   erreur (aucun appelant applicatif n'existe encore pour cette table) donc
   il n'y a **pas de fuite actuelle**, mais toute future route qui
   insérerait dans `code_vault_private_rows` devra explicitement ne
   journaliser que le message court d'une erreur Postgres, jamais l'objet
   d'erreur complet ni son `detail`.

Ces trois écarts concernent le **branchement** (LOT 5 étendu ou LOT 7), pas
la validité des règles pures ou du schéma déjà recettés (LOT 1 à LOT 4) —
qui, eux, tiennent tous à l'épreuve adverse de ce lot.

## Ce qui reste supposé, pas prouvé

- **Aucune route HTTP réelle n'assemble encore LOT 1 + LOT 3 + LOT 4 + LOT 5.**
  Ce lot reproduit l'assemblage qu'une future route ferait (autorisation
  puis attribution puis remise), directement dans le script de recette : ce
  n'est toujours pas du code applicatif appelé par un écran. Les trois
  écarts ci-dessus resteront non vérifiables « en vrai » tant que cette
  route n'existe pas.
- **Le journal d'accès (`code_vault_access_events`) n'est alimenté par
  aucun code applicatif** : ce lot y insère des lignes directement en SQL
  pour prouver que le schéma accepte et restitue correctement un refus
  motivé, pas qu'un vrai chemin de refus les y écrit aujourd'hui.
- **La recette navigateur ne couvre que le rendu isolé du composant**, avec
  une valeur qui ne change jamais d'établissement ni de service réel. Le
  comportement de `onExpire` (callback appelé une seule fois à
  l'expiration) n'a pas été observé en conditions réelles dans ce lot — le
  rendre visible aurait demandé d'attendre 30 minutes réelles ou de truquer
  l'horloge du navigateur, ce que ce lot n'a pas fait (hors périmètre : la
  disparition à l'expiration est déjà couverte par les 9 assertions
  statiques du LOT 4 et par le calcul pur `isVaultDisplayStillVisible`,
  revérifié sur des horodatages réels dans la recette Postgres de ce lot).
- **Aucune donnée réelle, aucun email envoyé, aucun drapeau activé.** Aucune
  lecture de `~/Documents/LyceeGest-DONNEES-PRIVEES`.

## Périmètre respecté

Personnes, établissements et valeurs de code entièrement fictifs (marqueurs
générés par `randomUUID()`, jamais une valeur de service réel). Aucun
drapeau, aucun envoi, aucun déploiement. Aucune lecture de
`~/Documents/LyceeGest-DONNEES-PRIVEES`. Aucun `git push`. Un seul commit
local pour ce lot, limité aux deux scripts de recette et à l'entrée
`package.json` correspondante.
