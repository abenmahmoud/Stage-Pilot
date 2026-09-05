# LOT 5 — Recette, informations flash (5 septembre 2026)

Périmètre exécuté : uniquement le LOT 5 du plan
`docs/operations/NIGHT_PLAN_FLASH_2026-09-05.md`. Aucune ligne de LOT 1, 2, 3,
4 ou 6 touchée, aucun fichier d'écran (`FlashProposalPage.tsx`,
`FlashValidationPage.tsx`) modifié — ce lot ajoute un test de recette
indépendant, il ne change aucun code produit. `src/pages/prototype/lycee-connect.css`
non modifié (vérifié par `git status` avant et après : absent des fichiers
changés). `.nuit.lock` préexistant, laissé tel quel.

## Sources lues avant d'écrire une ligne

- `docs/operations/NIGHT_PLAN_FLASH_2026-09-05.md` en entier (règles communes
  + section « LOT 5 »).
- `specs/002-agent-etablissement-adaptatif/politique-operationnelle-agent-2026-2027.md`,
  section 13 en entier (`grep` ciblé sur `## 13\.`, pas le fichier complet).
- `specs/002-agent-etablissement-adaptatif/tasks.md`, tâches T071, T071A,
  T071B, T071C, T071D (`grep` sur `T071`).
- `specs/project-memory.md` **non lu en entier** (règle commune n°9) :
  `grep` ciblé sur « LOT 5 » et « flash recette » sans résultat pertinent —
  rien à en tirer pour ce lot.
- `docs/operations/night-logs/LOT4.md` en entier (compte rendu du lot
  précédent, en particulier sa section « Pour la suite (LOT 5 et LOT 6) », qui
  demande explicitement de rejouer les scénarios comme de vraies fixtures
  adverses contre le comportement bout en bout de l'écran, pas seulement
  contre les fonctions du LOT 2 isolément).
- `shared/flash-transitions.ts`, `shared/flash-version-diff.ts`,
  `shared/flash-audience-correction.ts`, `shared/flash-expiration.ts` (LOT 2)
  en entier.
- `src/pages/admin/FlashValidationPage.tsx` (LOT 4) en entier, y compris la
  fonction interne non exportée `analyzeProposal` (lignes ~267-289), pour
  rejouer exactement sa formule de décision plutôt que d'en inventer une
  approximation.
- `src/pages/admin/FlashProposalPage.tsx` (LOT 3), `scripts/test-flash-*.mjs`
  existants et `package.json` (section `scripts`) pour suivre le même motif
  d'enregistrement et de style de test.

## Ce qui a été livré

Un seul fichier de test neuf, aucun changement de code produit :

1. **`scripts/test-flash-recette-adverse.mjs`** (10 tests `node:test`,
   enregistré `npm run test:flash-recette-adverse`) :
   - Reproduit **exactement** la formule de `analyzeProposal` de
     `FlashValidationPage.tsx` (`isDecisive = gap.kind === "decisif" ||
     audienceChanged`) dans une fonction locale `analyzeProposalLikeScreen`,
     car cette fonction n'est pas exportée par l'écran. Un premier test
     (« preuve de wiring ») vérifie par expression régulière que le code
     source de l'écran contient bien cette formule mot pour mot, pour ne pas
     prouver un comportement que l'écran n'implémente pas réellement.
   - Rejoue les **huit scénarios exacts du plan de nuit**, avec des fixtures
     volontairement adverses (limites, entrées non triées/dupliquées, cas où
     l'intuition pourrait tromper) :
     1. Correction de forme sur une flash **urgente** → `gap.kind === "forme"`,
        `isDecisive === false`. Cas adverse : une importance élevée à elle
        seule ne doit pas transformer une reformulation en écart décisif.
     2. Changement d'heure seul sur une flash **importante** →
        `gap.kind === "decisif"`, `importanceChanged === false`,
        `normalizedTextChanged === true`.
     3. Audience réduite → `removed` contient exactement le groupe retiré,
        `correctionPossible === true`, et la constante de texte affichée
        (`"Cette information ne vous concerne plus."`) est vérifiée présente
        mot pour mot dans le code source de l'écran.
     4. Audience élargie → `added` contient exactement le groupe ajouté, et le
        gabarit de texte `` `Nouvelle information (pas une correction) :
        ${...title}` `` est vérifié présent dans le code source.
     5. Flash **normale** modifiée, **avec un public réellement différent**
        (cas adverse délibéré) → l'écran calcule bien `isDecisive === true`
        (le changement de public est décisif), mais
        `audienceTreatment.correctionPossible === false` et les trois
        ensembles restent vides : aucun ensemble fantôme qui laisserait
        croire qu'un envoi est possible. Le texte exact affiché
        (« La nouvelle version reste normale : seul le site est mis à jour,
        aucun envoi n'est possible. ») est vérifié présent.
     6. Passage **normale → urgente**, avec des listes d'audience
        volontairement non triées et dupliquées en entrée (cas adverse) →
        `added` contient bien tout le public, dédupliqué et trié,
        `correctionPossible === false`.
     7. Proposition expirée sans validation, avec deux cas limites adverses :
        égalité exacte entre `now` et `expiresAt` (comptée comme expirée, pas
        comme « encore en attente ») et une proposition **déjà validée** dont
        l'expiration est dépassée (ne doit **jamais** compter comme un
        échec — elle a déjà reçu une décision humaine). Un filtre sur une
        liste mixte de trois propositions confirme qu'une seule est retenue.
        Le message factuel exact et l'absence de mise en cause d'un valideur
        sont revérifiés indépendamment du test du LOT 4.
     8. Transitions illégales, avec quatre cas adverses distincts : retour en
        arrière (`publiee` → `validee`), état terminal sans transition
        sortante (`modifiee` → `publiee`), non-transition (`proposee` →
        `proposee`), et statut **corrompu/inconnu** des deux côtés
        (`"annulee"` en entrée ou en sortie) — pas seulement les violations
        du graphe légal, mais aussi une chaîne invalide simulant une donnée
        injectée ou corrompue.
   - **Vérification transverse demandée par le plan** : un balayage
     indépendant des six fichiers flash (les quatre modules du LOT 2, les deux
     écrans du LOT 3/4) confirme l'absence de tout code exécutable capable
     d'émettre un message ou d'appeler un service externe (`fetch(`,
     `supabase`, `axios`, `XMLHttpRequest`, `WebSocket`, `nodemailer`,
     `twilio`, `sendMail`, `sendGrid`, `.insert(`, `.from(`,
     `child_process`). Les commentaires sont retirés avant le balayage
     (`stripComments`) car `flash-transitions.ts` mentionne légitimement le
     nom du fichier de migration Supabase dans un commentaire documentant le
     double filet avec le trigger SQL — ce n'est pas un appel réseau, et un
     premier essai sans ce retrait a effectivement échoué sur ce faux
     positif avant correction (voir « Preuves réellement exécutées »).
2. **`package.json`** — deux scripts ajoutés : `test:flash-recette-adverse`
   (le fichier ci-dessus) et `test:flash-recette` (agrégat :
   `test:flash` + `test:flash-proposal-page` + `test:flash-validation-page` +
   `test:flash-recette-adverse`), même motif que `test:nominatif` déjà
   existant pour les envois nominatifs.

## Preuves réellement exécutées

Toutes les commandes ci-dessous ont été lancées dans cette session, pas
supposées :

1. `npm run test:flash-recette-adverse` — **premier essai en échec réel** :
   le test transverse a échoué sur `/supabase/i` matchant un commentaire de
   `shared/flash-transitions.ts` (mention légitime du nom de fichier de
   migration). Corrigé en retirant les commentaires avant le balayage
   (`stripComments`), puis **succès, 10/10 tests**. Ce faux positif et sa
   correction sont documentés ici plutôt que masqués.
2. `npm run test:flash-recette` (agrégat complet : LOT 2 + LOT 3 + LOT 4 +
   LOT 5) → **succès, 33/33 tests** (6 transitions + 7 diff + 8 audience + 6
   expiration + 7 proposition + 10 validation + 10 recette adverse — le detail
   exact des sous-totaux est visible dans la sortie de chaque script listé,
   inchangé pour LOT 2/3/4).
3. `npm run build` (`tsc --noEmit && vite build`) → **succès**, build terminé
   en 11.95 s. Aucun nouveau chunk (ce lot n'ajoute aucun composant React).
   Seul avertissement : chunks > 500 kB (`xlsx`, `index`), préexistant et
   documenté dans LOT 1 à LOT 4, sans rapport avec ce lot.
4. `npm run test:preview-security-gate` → **succès**, code de sortie 0 capturé
   explicitement (`REAL_EXIT_CODE=0`), suite complète exécutée jusqu'à
   `test:migration-integrity` inclus
   (`{"migrations":97,"uniqueVersions":97,"checkedReferences":77,...}`,
   inchangé — ce lot n'ajoute ni ne modifie aucune migration).
5. `git status --porcelain` avant de committer → confirme que seuls
   `package.json` (modifié) et `scripts/test-flash-recette-adverse.mjs`
   (nouveau) ont changé ; `src/pages/prototype/lycee-connect.css` absent de la
   liste ; `.nuit.lock` présent avant ce lot, non touché.

Aucune commande n'a échoué au final. Le seul échec rencontré (le faux positif
`/supabase/i` sur un commentaire) est un échec **de ce lot, corrigé pendant ce
lot**, pas un échec préexistant masqué.

## Ce qui est prouvé par une commande réellement exécutée

- Les huit scénarios adverses du plan produisent exactement le résultat
  attendu contre les fonctions pures du LOT 2 **composées selon la formule
  réelle de l'écran de validation** (`analyzeProposalLikeScreen`), pas
  seulement contre les fonctions prises isolément.
- La formule de décision (`isDecisive = gap.kind === "decisif" ||
  audienceChanged`) et les textes fixes affichés pour chaque cas (retiré,
  ajouté, normale-sans-correction, urgente-nouvelle-information, message
  factuel T071D, refus de transition) sont bien présents mot pour mot dans le
  code source de `FlashValidationPage.tsx` au moment de l'exécution du test —
  pas seulement supposés cohérents avec LOT 4.
- Aucun des six fichiers flash (LOT 2 + LOT 3 + LOT 4) ne contient, une fois
  les commentaires retirés, de code capable d'émettre un message ou d'appeler
  un service externe.
- `npm run build` et `npm run test:preview-security-gate` passent tous les
  deux avec ce lot appliqué, sans régression.

## Ce qui reste supposé, pas prouvé (hors périmètre de ce lot)

- **Aucun test de rendu réel dans un navigateur** (pas de Playwright
  installé, session non interactive sans outil de capture d'écran) : ce lot
  est une recette de **logique** (fonctions pures + présence exacte de texte
  dans le code source), pas une recette visuelle. Le comportement affiché à
  l'écran au clic n'a pas été observé dans un navigateur réel.
- **Le branchement réel sur les tables du LOT 1 reste entièrement à faire**,
  comme déjà noté dans LOT 3 et LOT 4 : ce lot ne lit ni n'écrit rien depuis
  `flash_info_versions` / `flash_info_audiences` /
  `flash_notification_dispatches`. « Migration non rejouée » ne s'applique
  pas directement ici puisqu'aucune migration n'a été touchée par ce lot, mais
  la question reste entièrement ouverte pour un lot de branchement futur.
- **La question du rôle « référent numérique ou DDFPT »** signalée dans LOT 4
  (protection de l'écran via `CONTENT_MANAGER_ROLES`, à confirmer avec Adel)
  n'est pas retranchée par ce lot : ce lot ne touche pas les rôles.
- Le comptage réel des échecs T071D (« rendre le compte de ces échecs
  consultable ») reste illustré par un jeu d'essai fixe dans l'écran, pas par
  un compteur agrégé sur des données réelles ; ce lot prouve seulement que la
  fonction de détection (`checkFlashProposalExpiration`/
  `selectExpiredFlashProposals`) se comporte correctement sur des cas limites
  adverses, pas que le compte affiché à l'écran reflète un état réel.

## Pour la suite (LOT 6, à lire avant de rédiger la clôture)

- Les huit scénarios du plan de nuit sont maintenant couverts par des preuves
  exécutées et adverses (`test:flash-recette-adverse`), pas seulement
  illustrées par un jeu d'essai d'écran (LOT 3/4) ou par les tests unitaires
  d'origine du LOT 2. LOT 6 peut citer `npm run test:flash-recette` comme
  preuve agrégée unique pour les LOT 2 à 5.
- Le point resté ouvert dans LOT 4 sur le rôle de validation
  (« référent numérique ou DDFPT » vs `CONTENT_MANAGER_ROLES`) reste entier et
  doit figurer dans la liste des décisions à prendre par Adel au réveil.
- Le branchement réel sur les tables du LOT 1 (lecture des propositions,
  écriture des décisions, comptage réel des échecs) reste à faire dans son
  intégralité — aucun lot de la nuit (1 à 5) ne le fait.
