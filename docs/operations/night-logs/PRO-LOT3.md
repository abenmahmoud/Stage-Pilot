# LOT 3 (série PRO) — Réponse honnête quand la référence d'enseignant manque

Suite du LOT 1 (`authorizedTeacherRefs: [scheduleRef(ownRef)]`,
`api/_shared/schedule-identity-reader.ts`). Branche
`codex/lycee-connect-prototype`, aucun `git push`. Aucune donnée réelle lue,
aucun import, aucun drapeau touché, aucune migration jouée. Tout le travail
(lecture du code, écriture du test, correction, recette) a eu lieu dans cette
session, sans délégation à un agent en arrière-plan.

## Constat établi en lisant le code (rien supposé)

1. `db/schema.ts` (`scheduleSlots`, `schedulePageIndexes`) : `teacher_ref` est
   un `text` libre, sans contrainte de format ni clé étrangère vers
   l'annuaire. Il vient exactement de `schedule_page_indexes.subject_ref`,
   copié tel quel par `api/_shared/schedule-slot-write.ts:117-118`
   (`teacherRef = page.subject_type === "teacher" ? page.subject_ref : null`).
2. `schedule_page_indexes.subject_ref` est saisi par un administrateur, page
   par page, dans `src/pages/admin/ScheduleImportPage.tsx` (ligne ~916,
   placeholder `PERSONNEL-0042`, libellé accessible « Référence opaque de la
   page »). Le seul contrôle de forme est
   `shared/schedule-page-input.ts` (`SUBJECT_REF`, 2 à 80 caractères,
   majuscules/chiffres/`._:-`) — **aucune vérification contre l'annuaire**.
   Même constat côté import tabulaire (`shared/schedule-tabular-mapping.ts`,
   colonne mappée librement par l'admin dans
   `api/schedule/admin/imports/[id]/tabular-mapping.ts`).
3. `api/_shared/schedule-identity-reader.ts:189-194` construit
   `authorizedTeacherRefs: [scheduleRef(ownRef)]` où `ownRef` est
   `officialPersonRef` (= `reference_personne` de l'annuaire, ex. identifiant
   ENT). Il n'y a donc **structurellement aucune garantie** que la chaîne
   tapée à la main sur l'écran d'import égale un jour la référence
   d'annuaire d'un professeur : rien ne les relie, ni au moment de la saisie,
   ni au moment de la vérification humaine de page (`review_status =
   'verified'` porte sur le contenu du PDF, pas sur l'identité).
4. Confirmé : les 323 lignes `identity_directory_rows` de
   `relationship_type = 'teaches'` ne sont lues nulle part dans
   `schedule-identity-reader.ts` (recherche exhaustive : seuls
   `guardian_of` et `member_of` y sont lus). Elles associent un professeur à
   une classe qu'il enseigne, jamais un professeur à un créneau précis.
   **Volontairement laissées de côté** : les utiliser pour élargir
   `authorizedClassRefs` d'un professeur aux classes qu'il enseigne
   reviendrait exactement à l'interdiction du mandat — un professeur qui
   enseigne les maths en 2ndeA verrait alors tout l'emploi du temps de
   2ndeA (anglais, EPS, histoire...) présenté comme « ses cours ». Ce n'est
   pas un chaînon manquant à brancher, c'est un piège à ne pas actionner.
5. Source active aujourd'hui (énoncé de la mission, vérifié par la
   construction du code) : export PDF **par classe**. Dans ce cas,
   `api/schedule/admin/imports/[id]/pages/index.ts:114`
   (`subjectType = source.sourceKind === "classes" ? "class" : "teacher"`)
   fait que **toute** page est indexée `subject_type = 'class'` : la colonne
   `teacher_ref` de `schedule_slots` reste `NULL` sur toute la ligne pour
   cette source. Un professeur qui interroge son propre emploi du temps a
   `authorizedTeacherRefs = [ownRef]`, `authorizedClassRefs = []`,
   `authorizedGroupRefs = []` (`isOwnStaffSchedule`,
   `schedule-identity-reader.ts:189-195` — jamais de repli sur une classe).
   `api/_shared/schedule-reader.ts` (`boundedViewer`) n'ajoute alors que le
   `sourceKind` `"teachers"` à rechercher ; comme aucune version active de ce
   type n'existe (source disponible = classes uniquement), la requête ne
   trouve aucune version → `{ ok: false, reason: "source_unavailable" }`.
   **Vérifié aussi qu'aucun 403 n'est renvoyé dans ce cas** : l'identité du
   professeur reste valide tout du long, seule la source manque.

## Choix retenu (la plus petite correction honnête)

Deuxième option du mandat : **pas de source de référence d'enseignant dans
la version active aujourd'hui**, donc pas d'écran de correspondance à
construire pour une donnée qui n'existe pas encore côté import. Corrigé côté
réponse : un professeur qui interroge son propre emploi du temps doit
recevoir un message qui dit explicitement que **son** emploi du temps
personnel n'est pas disponible dans la version active — pas le message
générique déjà utilisé pour d'autres causes (source périmée, aucun
établissement concerné), qui pouvait laisser croire à une simple absence de
cours ou à un souci technique large plutôt qu'à un trou de source connu.

Choix explicitement écarté : brancher les relations `teaches` de l'annuaire
pour élargir le périmètre du professeur (cf. point 4 ci-dessus) — cela
aurait justement produit le comportement interdit par le mandat.

## Ce qui a été changé

1. **`shared/schedule-policy.ts`** — nouvelle fonction pure
   `scheduleSourceUnavailableReason(viewer)` : distingue un périmètre
   « professeur seul » (`authorizedTeacherRefs` non vide, `authorizedClassRefs`
   et `authorizedGroupRefs` vides — le seul périmètre que peut avoir un
   professeur, `isOwnStaffSchedule` ne laissant jamais les trois cohabiter)
   du cas générique. Nouvelle valeur `"teacher_schedule_unavailable"` ajoutée
   à `ScheduleReadFailureReason`. Les deux points où `readNextAuthorizedCourse`
   et `readAuthorizedCoursesForDay` renvoyaient `"source_unavailable"` en dur
   quand aucune version active n'est trouvée passent par cette fonction.
2. **`api/_shared/schedule-reader.ts`** — les quatre points où
   `readNextCourseFromPrivateSchedule` et `readCoursesForDayFromPrivateSchedule`
   renvoyaient `"source_unavailable"` en dur (aucune version du bon
   `sourceKind`, ou repli défensif en fin de fonction) passent par la même
   fonction pure, avec le `viewer` déjà calculé par `boundedViewer`.
3. **`shared/schedule-assistant.ts`** — nouveau message pour
   `teacher_schedule_unavailable`, en français, dans le produit :
   « Votre emploi du temps personnel de professeur n'est pas disponible dans
   la version actuellement active : je ne peux donc pas vous répondre. Vous
   pouvez transmettre une demande à la vie scolaire pour qu'il soit ajouté. »
   avec une note de sécurité explicite : « Aucun emploi du temps de classe ne
   vous est présenté à la place du vôtre. »

Aucun autre fichier de production touché. `schedule-identity-reader.ts` n'a
pas été modifié : la faille (403 injustifié) qu'il fallait éviter n'existait
déjà pas avant ce lot (vérifié au point 5), donc rien à y corriger pour ce
lot précis.

## Tests — écrits en échec avant la correction

- `scripts/test-schedule-policy.mjs` : nouveau test « tells a professor apart
  from a student when no source can serve their scope » sur
  `scheduleSourceUnavailableReason` (import ajouté en tête de fichier).
  Rejoué avant la correction : `SyntaxError: The requested module
  '../shared/schedule-policy.ts' does not provide an export named
  'scheduleSourceUnavailableReason'` (échec réel, capturé avant d'écrire la
  fonction). Après correction : 19/19, y compris ce test et les 18
  préexistants inchangés.
- `scripts/test-schedule-assistant.mjs` : nouveau test « tells a professor
  plainly that their own schedule is missing from the active version, not
  that they have no course », sur les deux chemins (`scheduleReader` et
  `scheduleDayReader`) via `analyzeSupportConversation`. **À dire
  honnêtement** : ce test a été écrit après avoir déjà ajouté l'entrée
  `teacher_schedule_unavailable` dans `shared/schedule-assistant.ts`, donc il
  n'est pas passé par un vrai cycle RED sur cette machine. Vérifié à la
  place par lecture directe du code : avant cet ajout, `messages[reason]`
  dans `scheduleFailureAnswer` n'aurait pas contenu la clé
  `teacher_schedule_unavailable`, donc `{...messages[reason]}` aurait tenté
  d'étendre `undefined` et levé une `TypeError` à l'exécution — pas une
  simple assertion ratée. Après correction : 11/11.
- `scripts/test-private-schedule-reader.mjs` : nouveau test « tells a
  teacher-only scope apart from a generic missing source, on both readers »,
  assertion statique sur le texte source de `schedule-reader.ts` (quatre
  appels à `scheduleSourceUnavailableReason(viewer)`, plus aucun
  `reason: "source_unavailable"` en dur). Rejoué avant la correction complète
  du fichier : échec réel sur les deux replis défensifs de fin de fonction,
  oubliés dans une première passe puis corrigés. Après correction : 6/6.

## Preuves rejouées

- `npm run test:schedule-policy` → 19/19.
- `npm run test:schedule-assistant` → 11/11.
- `npm run test:schedule-private-reader` → 6/6.
- `node node_modules/typescript/bin/tsc --noEmit` → aucune erreur (dépôt
  entier).
- `npx vite build` (`npm run build`) → succès (même avertissement
  pré-existant sur la taille des gros chunks, non lié à ce lot).
- `npm run test:spec-integrity` → 635 tâches, résumé inchangé par rapport à
  avant ce lot.

## Panne pré-existante rencontrée, non causée par ce lot

`npm run test:preview-security-gate` échoue avec exactement **une** panne :
`does not transform references into another person's identifier or schedule
scope` (`scripts/test-schedule-identity-scope.mjs:235`), à cause d'une
modification déjà présente et non committée avant le début de cette session
dans `api/_shared/schedule-identity-reader.ts` (`SCHEDULE_REF` élargi de
`/^[A-Z0-9]…/` à `/^[A-Za-z0-9]…/`, ce qui rend une référence de classe en
minuscules comme `class-001` valide alors que le test attend un refus
`403`). Vérifié en isolant la cause : `git stash push --
api/_shared/schedule-identity-reader.ts` puis rejeu de
`npm run test:schedule-identity-reader` → 20/20 (aucune panne) ; `git stash
pop` restaure l'état initial. Cette modification ne fait pas partie de ce
lot, n'a pas été touchée, et n'est pas commitée ici — elle appartient à un
travail en cours d'une session antérieure, sur un sujet distinct. À signaler
à Adel : la porte reste ouverte tant que ce fichier n'est ni corrigé ni
committé.

## Ce qui n'a PAS été fait, à dire explicitement

- **Aucun écran de correspondance annuaire construit.** La première option du
  mandat (lier une colonne professeur à une référence d'annuaire côté écran
  d'import) n'a pas été implémentée : il n'existe aujourd'hui aucune source
  active qui fournirait une référence de professeur à lier, donc rien à
  vérifier humainement à ce stade. À reprendre le jour où un export par
  professeur (PDF ou tabulaire) devient la source active.
- **Les relations `teaches` de l'annuaire restent non lues**, par choix
  explicite (point 4) et non par oubli.
- **Aucune recette PostgreSQL réelle rejouée pour ce lot.** Le changement est
  entièrement déterministe et sans accès base (fonction pure + branchement
  de message) ; les tests exécutés couvrent le comportement réel sans
  nécessiter de pile Supabase locale. Aucune affirmation de couverture
  au-delà de ce qui a été exécuté ci-dessus.
- **Aucune vérification dans un vrai navigateur.**

## Statut

LOT 3 terminé : un professeur dont l'identité est valide mais dont la
référence n'existe dans aucune source active reçoit désormais un message
explicite (« votre emploi du temps personnel de professeur n'est pas
disponible dans la version actuellement active »), jamais les créneaux d'une
classe et jamais un refus d'identité. Panne pré-existante et sans rapport
signalée ci-dessus, non corrigée (hors périmètre de ce lot).
