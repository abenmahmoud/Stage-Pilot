# LOT 1 — Brancher l'écran sur la route d'écriture

Plan : `docs/operations/PLAN_IMPORT_UTILISABLE_2026-09-07.md`. Périmètre
exécuté strictement : LOT 1 seulement. Branche `codex/lycee-connect-prototype`,
aucun `git push`, aucune donnée réelle, aucun drapeau activé.

## Constat de départ (vérifié, pas supposé)

Confirmé par lecture directe de `src/pages/admin/ScheduleImportPage.tsx` :
aucun appel à `api/schedule/admin/imports/[id]/pages/[pageId]/slots.ts`
n'existait dans le front. Le point d'écriture (LOT 1 du plan « données
réelles », `docs/operations/night-logs/EDT-LOT1.md`) était prouvé côté
PostgreSQL local mais totalement inatteignable par un administrateur : il
fallait un appel API manuel (`curl`) pour écrire un créneau.

Point confirmé dans `EDT-LOT1.md` : l'extraction automatique de texte PDF
reste hors périmètre (jugée non fiable le 29 août). Le point d'écriture
attend donc des créneaux **saisis à la main par un humain, page par page,
après vérification**. Ce lot construit cette saisie, pas une extraction.

## Ce qui a été construit

- `shared/schedule-slot-write-payload.ts` — validation stricte, côté front,
  de la réponse de `slots.ts` (`{ slots: [...] }`), sur le même modèle
  `exactRecord` que `shared/schedule-admin-payload.ts` : aucun champ en
  trop, aucun champ manquant, horaires ISO cohérents (fin après début),
  et vérification que chaque créneau renvoyé porte bien la référence de
  classe/professeur de la page appelée (jamais l'inverse : `classRef` et
  `teacherRef` mutuellement exclusifs).
- `src/pages/admin/ScheduleSlotEditor.tsx` — nouveau composant, isolé de
  `ScheduleImportPage.tsx` pour ne pas alourdir un fichier déjà volumineux.
  Tableau de lignes éditables (jour, heure de début, heure de fin, code
  matière, intitulé, salle, semaine, groupe), ajout/retrait de ligne,
  conversion en horodatage ISO UTC, appel POST vers la route d'écriture
  existante, puis affichage du rapport réel reçu du serveur (nombre de
  créneaux, horaires, matière, salle) — jamais un simple message de succès.
  Chaque envoi remplace intégralement les créneaux de la page (comportement
  du point d'écriture, rappelé à l'écran).
- `src/pages/admin/ScheduleImportPage.tsx` — pour chaque page **déjà
  vérifiée**, un bouton « Écrire les créneaux » ouvre l'éditeur ci-dessus.
  Un badge apparaît sur la ligne de la page une fois l'écriture faite
  (« N créneaux écrits »), et un résumé de session s'affiche en tête de
  la section Index des pages (« N créneaux écrits cette session, pour
  M pages »). Ce résumé ne reflète que les écritures faites dans la
  session du navigateur ouverte : aucune route `GET` de relecture des
  créneaux déjà écrits n'existe encore (pas dans le périmètre du LOT 1,
  qui ne fait que brancher l'écran sur la route d'écriture existante) —
  si l'admin recharge la page, les badges disparaissent même si les
  créneaux restent bien en base. **Non vérifié après rechargement complet
  du navigateur** : seul le flux en session a été testé (voir plus bas).
- `scripts/test-schedule-slot-write-payload.mjs` + script npm
  `test:schedule-slot-write-payload` — 9 tests unitaires du nouveau
  validateur (réponse valide classe et professeur, nombre de lignes
  incohérent, référence de classe ne correspondant pas à la page,
  `classRef`/`teacherRef` simultanés ou tous deux nuls, horaires inversés,
  champ en trop ou manquant, racine mal formée).

## Ce qui n'a pas été touché

- `approve.ts` n'exige toujours pas de créneaux écrits par page vérifiée
  (LOT 2 du plan, explicitement hors périmètre ici).
- Aucun format tabulaire (LOT 3) : la saisie reste manuelle, ligne par
  ligne, dans le navigateur.
- Aucune route serveur nouvelle : `slots.ts` et `writeScheduleSlots` sont
  inchangés, appelés tels quels.
- Aucune route de relecture des créneaux déjà écrits pour une page (limite
  documentée ci-dessus).

## Preuves obtenues

- `node node_modules/typescript/bin/tsc --noEmit` : aucune erreur.
- `npx vite build` : succès (nouveau chunk `ScheduleImportPage`, dépendance
  `ScheduleSlotEditor` intégrée sans erreur de résolution).
- `npm run test:schedule-slot-write-payload` : 9/9 tests passés.
- `npm run test:spec-integrity` : OK (5 specs, 635 tâches, inchangé).
- `npm run test:preview-security-gate` : code de sortie 0, 116 occurrences
  de « fail 0 » dans la sortie complète, aucune ligne d'échec — la chaîne
  s'est terminée sur `test:migration-integrity` (109 migrations, versions
  uniques), comme attendu.
- **Non fait, à noter explicitement** : pas de recette PostgreSQL locale
  réelle bout-en-bout depuis le navigateur (déposer un PDF fictif, vérifier
  une page, cliquer « Écrire les créneaux », relire la base). Seuls les
  contrôles statiques (types, build, tests unitaires, gate) ont tourné.
  Preuve manquante = **non vérifié** : le clic réel dans un navigateur
  contre une base locale n'a pas été rejoué dans cette session. C'est du
  ressort du LOT 4 du plan (« Recette réelle de bout en bout »).

## Statut

LOT 1 terminé au sens du plan : l'écran permet désormais à un administrateur
de déclencher l'écriture des créneaux sans ligne de commande, et affiche ce
qui a été écrit (compte et détail), pas seulement un message de succès.
Vérifié par les contrôles statiques listés ci-dessus, **pas par une recette
navigateur réelle** — à faire avant de considérer l'écran utilisable en
conditions réelles (LOT 4).
