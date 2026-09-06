# LOT 5 — Clôture honnête

Plan : `docs/operations/PLAN_DONNEES_REELLES_2026-09-06.md`, §LOT 5. Périmètre
exécuté strictement : LOT 5 seulement — aucun code modifié, uniquement lecture
du dépôt tel qu'il est aujourd'hui et vérification des quatre commandes de
clôture exigées par le plan. Les LOT 1 à 4 sont déjà committés (`424e607`,
`4507fcb`, `6638361`, `b49b015`), ce lot ne les rouvre pas. Branche
`codex/lycee-connect-prototype`, aucun `git push`, aucune donnée de
`~/Documents/LyceeGest-DONNEES-PRIVEES` lue ni citée. Tout le travail (lecture,
exécution des vérifications, rédaction) a eu lieu dans cette session, sans
délégation à un agent en arrière-plan.

## Vérifications de clôture (exigées par le plan, exécutées dans cette session)

- `node node_modules/typescript/bin/tsc --noEmit` : aucune erreur.
- `npx vite build` : succès (`✓ built in 8.22s`), même avertissement
  pré-existant sur la taille de certains chunks (`xlsx`, `pdf`, `index`,
  `pdf.worker.min`), sans lien avec ce plan.
- `npm run test:preview-security-gate` : code de sortie `0`, zéro échec
  (vérifié explicitement par grep sur `ℹ fail [1-9]` après une exécution
  séparée capturée dans un journal — zéro occurrence).
- `npm run test:spec-integrity` : succès, `{"specs":5,"tasks":635,...}` —
  résumé identique à celui rapporté par les LOT 2, 3 et 4 : ce plan entier ne
  touche à aucune tâche Spec Kit numérotée, confirmé une nouvelle fois ici.

Les quatre commandes passent sur l'état actuel du dépôt, après les quatre lots
précédents, pas seulement au moment où chaque lot a été committé.

## Ce qui est réellement prouvé (à retenir tel quel)

- **LOT 1 — écriture des créneaux.** Point d'écriture unique
  (`writeScheduleSlots`) prouvé contre un vrai PostgreSQL local : refus d'une
  page non vérifiée, remplacement propre au renvoi, refus une fois la version
  `approved`, immutabilité réelle d'un créneau actif/retiré/superseded
  (`schedule_slots_guard_source`, testée par une tentative de suppression
  rejetée, pas supposée).
- **LOT 2 — réponse de l'agent, prochain cours et journée.** Prouvé par tests
  Node réels appelant le vrai point d'entrée (`analyzeSupportConversation`),
  sur un lecteur **simulé** (pattern déjà en usage ailleurs dans le dépôt),
  pas contre un vrai PostgreSQL dans ce lot précis.
- **LOT 3 — rapport d'import annuaire enrichi.** Compteurs par type de
  personne et différentiel de classes contre la version active, prouvés par
  tests Node réels et validation stricte des clés. Aucune recette PostgreSQL
  réelle dédiée, aucun rendu observé dans un navigateur.
- **LOT 4 — recette adverse.** La preuve la plus complète des quatre : vrai
  PostgreSQL local, vrais comptes et jetons Supabase Auth, vraies séquences de
  déclencheurs (`processing → review → approved → active → superseded →
  retired`), 37 assertions rejouées cinq fois avec succès systématique après
  correction d'une panne d'horloge. Couvre en particulier, avec de vraies
  données réelles en base (fictives mais réellement stockées) : cloisonnement
  élève/parent/classe/établissement, absence de coordonnée en clair
  (vérifiée au niveau du schéma, pas seulement du code), refus de la
  recherche libre par nom, absence de fuite dans les journaux capturés.
  Cette recette exerce en pratique `readCoursesForDayForVerifiedIdentity`
  contre un vrai PostgreSQL — elle comble donc partiellement, à l'occasion
  d'un scénario adverse et non d'une recette dédiée, le manque de preuve
  PostgreSQL réelle laissé ouvert par le LOT 2 pour la lecture « journée ».

## Ce qui n'est que simulé ou jamais vérifié (aucun des quatre lots ne le couvre)

- **Aucune vérification dans un vrai navigateur, dans aucun des quatre lots.**
  Ni l'écran d'import d'emploi du temps (`ScheduleImportPage.tsx`), ni le
  rapport d'annuaire enrichi (`IdentityDirectoryReport.tsx`), ni une
  conversation réelle avec l'agent dans l'interface, n'ont été ouverts dans
  Chromium ou un navigateur équivalent. Toutes les preuves sont des tests
  Node (simulés ou contre PostgreSQL réel) et des vérifications de
  compilation/build.
- **Toutes les données de tous les lots sont inventées.** Aucun nom, email,
  téléphone ou classe réel n'a été utilisé nulle part — conforme à
  l'interdiction du plan, mais cela veut dire qu'aucun volume, format ou cas
  particulier réel (homonymes, classes à effectif inhabituel, groupes
  irréguliers) n'a été rencontré.
- **La convention UTC/heure de Paris pour les bornes de journée** (LOT 2)
  n'a été ni corrigée ni testée aux heures de bascule (00h–02h, heure d'été) :
  héritée du code existant avant ce plan, toujours en l'état.

## Le trou qui reste ouvert, précis et bloquant pour un usage réel

**Aucun écran ne permet à un administrateur d'écrire un créneau.** Vérifié à
nouveau dans cette session : `src/pages/admin/ScheduleImportPage.tsx` ne
contient aucune référence à la route créée par le LOT 1
(`api/schedule/admin/imports/[id]/pages/[pageId]/slots.ts`) — confirmé par
recherche de texte, zéro occurrence. Le point d'écriture existe, il est
prouvé, mais **rien dans l'interface ne l'appelle**. Sans modification
supplémentaire (hors périmètre de ce plan), la seule façon de peupler
`schedule_slots` aujourd'hui est un appel HTTP authentifié direct à cette
route — pas un geste accessible à un administrateur non technicien depuis
l'écran d'import existant.

**`approve.ts` n'exige toujours pas que chaque page vérifiée porte des
créneaux écrits** — relu dans cette session, ligne par ligne : la condition
d'approbation reste « chaque page indexée est vérifiée »
(`schedulePageIndexes.reviewStatus = 'verified'`), jamais « chaque page
vérifiée a des lignes dans `schedule_slots` ». Une version peut donc encore
être approuvée puis activée sans qu'un seul cours existe pour une classe —
signalé dès le LOT 1, jamais traité depuis, toujours vrai aujourd'hui.

## Ce qu'Adel doit faire lui-même, dans l'ordre, pour passer au réel

Aucune de ces étapes n'a été faite par un lot de ce plan — elles impliquent
soit des décisions de produit, soit l'usage de vraies données couvertes par
l'interdiction de ce plan, soit une interface encore manquante.

1. **Décider** si `approve.ts` doit exiger des créneaux écrits par page
   vérifiée avant d'accepter une approbation, ou si une classe sans créneaux
   ce jour-là est un état valide à assumer (professeur sans cours, par
   exemple). Ce plan ne tranche pas ce choix ; il ne fait que le documenter.
2. **Faire brancher** (dans un lot ultérieur, pas par ce plan) l'écran
   `ScheduleImportPage.tsx` sur la route `slots.ts` du LOT 1, pour qu'un
   administrateur puisse saisir ou coller les créneaux d'une page vérifiée
   sans appel HTTP manuel.
3. **Importer le vrai répertoire** (annuaire) par l'interface
   d'administration existante (`api/identity/admin/imports/*`), avec
   validation humaine à chaque étape (dépôt, rapport, approbation,
   confirmation, activation) — ce circuit existait déjà avant ce plan et
   n'a pas été modifié par lui, hormis l'enrichissement du rapport (LOT 3).
4. **Importer le vrai emploi du temps** (PDF réel) par
   `api/schedule/admin/imports/*`, vérifier chaque page une par une par un
   humain (l'extraction automatique reste volontairement écartée depuis fin
   août, pas réintroduite ici), puis écrire les créneaux de chaque page
   vérifiée — via l'écran une fois branché (étape 2), ou par appel direct en
   attendant.
5. **Approuver puis activer** la version réelle par les écrans
   d'administration existants — le LOT 4 a prouvé qu'une seule version reste
   active à la fois et qu'une version retirée n'est plus lue, avec de vraies
   données fictives ; ce comportement n'a pas été rejoué avec de vraies
   données réelles.
6. **Vérifier une fois, dans un vrai navigateur, avec un seul compte réel
   déjà vérifié (I3)**, que l'agent répond correctement avant tout usage
   élargi — aucun lot de ce plan n'a ouvert de navigateur, cette étape reste
   entièrement à faire par Adel ou dans un lot dédié à la vérification
   visuelle.
7. **Optionnel, recommandé avant une confiance à grande échelle** : rejouer
   les vérifications structurelles du LOT 4 (`information_schema` sur les
   colonnes de coordonnées, balayage anti-fuite des journaux) une fois des
   données réelles en base, pas seulement sur les données fictives de ce
   plan.

## Ce qui reste fermé, sans changement par ce plan

- Aucun fichier de `~/Documents/LyceeGest-DONNEES-PRIVEES` n'a été lu, copié,
  résumé ni committé par aucun des cinq lots.
- Aucun drapeau de fonctionnalité n'existe pour ce circuit — recherché dans
  cette session (`SCHEDULE_*_ENABLED`, `VITE_SCHEDULE_*`) : aucune occurrence
  dans `src/` ni dans un fichier `.env*`. Rien à fermer, rien n'a été ouvert.
- Aucun `git push` n'a eu lieu à aucun moment des cinq lots ; la branche reste
  `codex/lycee-connect-prototype` uniquement.
- Aucun modèle externe payant n'a été utilisé.
- La recherche libre par nom reste refusée par le vrai validateur
  (`parseIdentityLookupInput`), inchangée depuis le LOT 4.
- Aucune tâche de `specs/*/tasks.md` n'a été cochée par ce plan, dans aucun
  des cinq lots — confirmé une dernière fois par `test:spec-integrity` dans
  ce lot (635 tâches, résumé inchangé).

## Statut

Plan `PLAN_DONNEES_REELLES_2026-09-06.md` clos avec les cinq lots réalisés.
Le trou initial du plan (« aucun code n'écrit dans `schedule_slots` ») est
fermé au niveau du code et prouvé contre un vrai PostgreSQL (LOT 1), mais
reste **inaccessible depuis l'interface d'administration** — un administrateur
ne peut pas encore s'en servir sans appel HTTP direct. C'est le point unique
qui empêche aujourd'hui un import réel de bout en bout par un humain non
technicien. Les six autres points du plan (réponse de l'agent, rapport
lisible, cloisonnement adverse) sont prouvés sur données fictives, avec un
niveau de preuve inégal détaillé ci-dessus (PostgreSQL réel pour les LOT 1 et
4, tests simulés pour les LOT 2 et 3). Aucune vérification dans un vrai
navigateur n'a eu lieu à aucun moment de ce plan.
