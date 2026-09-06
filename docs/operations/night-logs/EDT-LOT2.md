# LOT 2 — L'agent répond vraiment

Plan : `docs/operations/PLAN_DONNEES_REELLES_2026-09-06.md`. Périmètre exécuté
strictement : LOT 2 seulement, dans la continuité du LOT 1 (déjà committé,
`424e607`). Branche `codex/lycee-connect-prototype`, aucun `git push`, aucune
donnée de `~/Documents/LyceeGest-DONNEES-PRIVEES` lue ni citée.

## Constat de départ (vérifié, pas supposé)

Avant ce lot, `requestsOwnNextCourse` (`shared/schedule-assistant.ts`)
détectait déjà une phrase de type « mon emploi du temps aujourd'hui » — mais
la traitait comme une demande de *prochain cours unique*, jamais comme une
demande de journée complète. `readNextAuthorizedCourse`
(`shared/schedule-policy.ts`) et son point d'appel privé
(`readNextCourseFromPrivateSchedule`, `api/_shared/schedule-reader.ts`) ne
savaient renvoyer qu'un seul créneau. Aucune fonction ne listait les cours
d'une journée. C'est exactement le trou que la demande explicite d'Adel
signale : « si `requestsOwnNextCourse` ne détecte que le prochain cours,
étends-le ».

## Ce qui a été construit

- `shared/schedule-policy.ts` — nouvelle fonction pure
  `readAuthorizedCoursesForDay`, à côté de `readNextAuthorizedCourse`
  (inchangée dans son comportement). Même politique d'autorisation
  (`isAuthorized`), même notion de version active/fraîche, même gestion des
  changements officiels (`selectChange`, y compris le refus en cas de
  conflit) — factorisée dans `applyChange`, partagée par les deux fonctions.
  Renvoie la liste triée des cours dont le créneau chevauche la fenêtre
  `[dayStart, dayEnd)` demandée. Une classe sans cours ce jour-là obtient
  `{ ok: true, courses: [] }` — une réponse honnête, pas un refus — tandis
  qu'une identité non vérifiée, une source absente, périmée, ou un conflit
  de changement produisent toujours un refus sûr (`identity_i3_required`,
  `source_unavailable`, `source_stale`, `conflicting_changes`), comme pour
  le prochain cours.
- `api/_shared/schedule-reader.ts` — `readCoursesForDayFromPrivateSchedule`,
  même filtrage institution/classe/groupe/professeur borné
  (`boundedRefs`/`MAX_SCOPE_REFS`, factorisé dans `boundedViewer` avec la
  fonction existante) que le lecteur du prochain cours, mais sur une fenêtre
  de journée (`lt(startsAt, dayEnd)` / `gt(endsAt, dayStart)`) au lieu d'un
  simple point dans le temps.
- `api/_shared/schedule-identity-reader.ts` —
  `readCoursesForDayForVerifiedIdentity`, qui passe par **exactement** la
  même résolution d'identité vérifiée (`resolveVerifiedScheduleScope`) que
  `readNextCourseForVerifiedIdentity` : même transaction en lecture seule
  isolée, même dérivation classe/groupes/professeur depuis l'annuaire, même
  refus 403 sans identité confirmée. Aucune logique d'autorisation nouvelle
  n'a été écrite pour la journée — elle réutilise celle déjà auditée du
  LOT `T042D2B`.
- `shared/schedule-assistant.ts` — `requestsOwnCoursesToday` (nouvelle
  détection, séparée de `requestsOwnNextCourse` : la phrase ambiguë « mon
  emploi du temps aujourd'hui » qui était auparavant classée dans la
  détection « prochain cours » est maintenant dans la détection « journée »,
  où elle a plus de sens) et `scheduleAssistantDayAnswer`, qui formate soit
  la liste des cours du jour (matière, horaire, salle, changement pris en
  compte), soit « aucun cours prévu » si la journée est vide, soit un refus
  sûr. Les messages de refus sont factorisés (`scheduleFailureAnswer`)
  entre le prochain cours et la journée pour ne pas dupliquer le texte.
- `api/_shared/support-agent.ts` — nouveau paramètre optionnel
  `scheduleDayReader` sur `analyzeSupportConversation`, branché avant la
  détection du prochain cours (aucun recouvrement possible entre les deux
  détections désormais).
- `api/support/assistant.ts` — branche `scheduleDayReader` sur
  `readCoursesForDayForVerifiedIdentity`, avec la même traduction
  401/403 → `identity_i3_required` que pour le prochain cours.

## Preuve obtenue (tests réels, données fictives)

- `npm run test:schedule-policy` (18 tests, dont 7 nouveaux) : identité I3
  requise, tous les cours autorisés d'une journée renvoyés triés, exclusion
  d'un créneau d'un autre jour, réponse `ok: true, courses: []` plutôt qu'un
  refus quand la classe n'a rien ce jour-là, exclusion d'un créneau non
  approuvé, refus source périmée/indisponible, application d'un changement
  officiel validé (salle), refus de changements contradictoires observés au
  même instant.
- `npm run test:schedule-private-reader` (5 tests, dont 1 nouveau) : le
  compte de filtres `institutionId` texte est passé de 2 à 4 (les deux
  fonctions filtrent désormais chacune deux fois par établissement) — vérifié
  et non contourné ; confirme aussi qu'aucune référence professeur ne fuit
  dans `courses`.
- `npm run test:schedule-identity-reader` (20 tests, dont 2 nouveaux) : le
  lecteur de journée passe par la même résolution d'identité vérifiée que le
  lecteur du prochain cours (même périmège dérivé, aucune donnée d'identité
  ou de contact transmise au lecteur privé) et rejette une identité non
  vérifiée avant tout appel au lecteur privé.
- `npm run test:schedule-assistant` (10 tests, dont 5 nouveaux), en appelant
  `analyzeSupportConversation` (le vrai point d'entrée de l'agent, pas un
  contournement) :
  - « Quels sont mes cours aujourd'hui ? » avec une identité I3 vérifiée →
    réponse avec les deux matières, horaires et salles, sans jamais
    mentionner « professeur ».
  - Journée vide → « Vous n'avez aucun cours prévu pour cette journée… »,
    pas un refus.
  - Sans identité vérifiée → demande de confirmation d'identité,
    `readyToCreate: true`, `action: "offer_case"`, le lecteur de journée
    n'est jamais appelé côté modèle IA (`usedAi: false`).
  - « Quels sont les cours de mon enfant aujourd'hui ? » → jamais transformé
    en consultation (compteur d'appels à 0), comme pour le prochain cours.
  - La route publique (`api/support/assistant.ts`) branche bien les deux
    lecteurs vérifiés et ne transmet jamais `targetPersonRef` (audit
    textuel du fichier réel, pas une supposition).

Le point « hors de sa classe, il ne voit rien » n'est pas une fonctionnalité
nouvelle à prouver séparément : la journée réutilise le même filtre
`isAuthorized` et la même dérivation de périmètre que le prochain cours
(déjà couverts par `test:schedule-identity-reader`), donc une classe non
autorisée obtient toujours une liste vide ou un refus, jamais les cours
d'une autre classe.

## Ce qui n'a PAS été fait, à dire explicitement

- **Aucune recette PostgreSQL locale réelle pour ce lot.** Le LOT 1 avait
  une recette PostgreSQL réelle parce qu'il ajoutait un nouveau point
  d'écriture ; ce lot ne touche à aucune écriture ni migration — il ajoute
  une lecture au-dessus de `schedule_slots`, déjà couvert par la recette
  PostgreSQL réelle antérieure (`T042D2`, mentionnée dans les tâches Spec
  Kit comme ayant « réussi puis laissé zéro résidu »). Les preuves de ce lot
  sont des tests Node réels sur données fictives avec le lecteur SQL
  simulé (pattern déjà utilisé par tous les tests `schedule-identity-*`
  existants), **pas** une preuve contre un vrai PostgreSQL. Si Adel veut une
  preuve PostgreSQL réelle spécifique à la lecture « journée », c'est un
  geste restant à faire, pas fait ici.
- **Bornes de journée en UTC, pas en heure de Paris.** `dayStart`/`dayEnd`
  sont calculés par découpage de date ISO (`toISOString().slice(0, 10)`),
  exactement comme le fait déjà `readCurrentPerson` dans
  `schedule-identity-reader.ts` pour « aujourd'hui ». Entre 00h00 et 02h00
  heure de Paris (heure d'été), la fenêtre de journée peut donc être
  légèrement décalée par rapport au calendrier local. C'est une imprécision
  héritée d'une convention déjà présente dans le code avant ce lot, pas
  introduite par lui — mais elle n'est pas corrigée non plus.
- **Aucune tâche Spec Kit cochée.** Aucune case de
  `specs/002-agent-etablissement-adaptatif/tasks.md` ne décrit précisément
  « cours du jour » : `T042D1A` et `T042D2C` (déjà cochées) couvrent la
  détection et le branchement du *prochain* cours. Ce lot les étend sans
  tâche dédiée existante à cocher ; en inventer une aurait faussé
  l'historique. `T042D` (case mère) reste ouverte, comme avant ce lot,
  parce que `T042D2D` (sélecteur d'enfant) reste ouverte et hors périmètre.

## Vérifications avant commit

- `node node_modules/typescript/bin/tsc --noEmit` : aucune erreur.
- `npx vite build` : succès (avertissement pré-existant sur la taille de
  certains chunks, non lié à ce lot).
- `npm run test:preview-security-gate` : succès complet, code de sortie 0,
  zéro échec.
- `npm run test:spec-integrity` : succès (635 tâches, résumé inchangé par
  rapport à avant ce lot).
- `npm run test:schedule-policy`, `npm run test:schedule-private-reader`,
  `npm run test:schedule-identity-reader`, `npm run test:schedule-assistant`
  : détaillés ci-dessus, tous passants. Aucun de ces quatre scripts n'est
  dans `test:preview-security-gate` (vérifié en lisant `package.json` avant
  de conclure) — ils ont donc été exécutés séparément, pas seulement
  implicitement par le gate.

## Statut

LOT 2 terminé et prouvé sur données fictives (tests Node réels, pas de
simulation manuelle). Reste ouvert, hors périmètre de ce lot : une recette
PostgreSQL réelle dédiée à la lecture « journée » si Adel la juge
nécessaire, la correction de la convention UTC/Paris pour les bornes de
journée, et `T042D2D` (sélecteur d'enfant côté parent), déjà identifiée
comme séparée avant ce lot.
