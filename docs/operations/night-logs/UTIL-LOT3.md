# LOT 3 — Accepter un fichier tabulaire, pas seulement un PDF

Plan : `docs/operations/PLAN_IMPORT_UTILISABLE_2026-09-07.md`. Périmètre
exécuté strictement : LOT 3 seulement. Branche `codex/lycee-connect-prototype`,
aucun `git push`, aucune donnée réelle, aucun drapeau activé. Une migration a
été jouée (nécessaire, voir plus bas), uniquement sur la pile Supabase
locale jetable (`127.0.0.1:54322`, `npx supabase db reset`), jamais
`--linked`, jamais `db push`, jamais d'URL distante.

## Constat de départ (vérifié, pas supposé)

`db/schema.ts` et `supabase/migrations/20260829105141_create_schedule_import_foundation.sql`
figeaient `schedule_source_versions.source_format` à `'pdf_import'` et
`mime_type` à `'application/pdf'` par une contrainte `check` en base — pas
seulement une validation applicative. Le bucket de stockage privé
`schedule-ingest` n'acceptait que `application/pdf`
(`allowed_mime_types`). Aucun format tabulaire n'était accepté nulle part
dans la chaîne (dépôt, ver rous de stockage, worker, écran).

## Ce qui a été construit

### Base de données (migration réelle, jouée en local)

`supabase/migrations/20260907120000_add_schedule_tabular_import_format.sql` :
- Relâche `source_format` (`pdf_import` ou `tabular_import`) et `mime_type`
  (contrainte combinée : PDF ⇒ `application/pdf`, tabulaire ⇒ `text/csv` ou
  `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`).
- Ajoute le statut `mapping_pending` à `schedule_source_versions.status` :
  un fichier tabulaire propre (antivirus + lecture structurelle) ne peut
  pas recevoir de `page_count` avant qu'un administrateur ait choisi la
  correspondance des colonnes — ce nombre de pages (une page = une classe
  ou un professeur distinct trouvé dans le fichier) dépend justement de
  cette correspondance. Un PDF n'entre jamais dans cet état.
- Étend `allowed_mime_types` du bucket `schedule-ingest` aux deux formats
  tabulaires.
- Ajoute l'action d'audit `apply_tabular_mapping`.
- Crée `schedule_tabular_column_mappings` (institution + périmètre classes/
  professeurs ⇒ correspondance choisie), RLS activée et forcée, accès
  `service_role` uniquement — c'est ce qui préremplit le prochain import du
  même périmètre, comme demandé par le plan.

Jouée par `npx supabase db reset` (110 migrations rejouées depuis zéro sur
la pile locale jetable) — pas un `alter` isolé à l'aveugle.

### Lecture du fichier, sans deviner les en-têtes

`workers/schedule-tabular-parser.mjs` (+ `test-schedule-tabular-parser.mjs`,
14/14 tests, octets CSV et Excel réels construits en mémoire, jamais un
fichier réel) : lit la première feuille d'un CSV ou Excel, rend les
en-têtes strictement tels quels — contrairement à
`identity-directory-parser.mjs`, aucun renommage, aucun alias, aucun rejet
de colonne inconnue. Mêmes garanties de sécurité que l'annuaire d'identités
(bornes de lignes/colonnes, rejet des formules et macros, vérification de
signature de fichier).

### Correspondance de colonnes, choisie par un humain

`shared/schedule-tabular-mapping.ts` (+ `test-schedule-tabular-mapping.mjs`,
20 assertions) : module pur, partagé front/API.
- `parseScheduleTabularColumnMapping` : n'accepte une correspondance que si
  chaque champ obligatoire (classe/professeur, code matière, intitulé,
  date, heure de début, heure de fin) pointe vers un en-tête réellement
  présent dans le fichier, sans réutilisation d'un même en-tête pour deux
  champs. Aucune détection automatique.
- `applyScheduleTabularColumnMapping` : applique la correspondance validée
  aux lignes brutes, regroupe par classe/professeur (une page par groupe),
  rejette proprement les lignes individuellement invalides sans bloquer le
  reste du fichier, et produit exactement la forme déjà acceptée par
  `shared/schedule-slot-input.ts` — prouvé par un test qui fait passer la
  sortie de `applyScheduleTabularColumnMapping` dans
  `parseScheduleSlotBatchInput` sans aucune adaptation.

**Limite assumée et documentée** : une ligne = une occurrence datée
explicite (comme la saisie manuelle de `ScheduleSlotEditor.tsx`, LOT 1).
Le champ « jour » doit être une date `AAAA-MM-JJ` par ligne, pas un jour de
semaine récurrent : ce module n'invente aucune expansion hebdomadaire. Un
export hebdomadaire type (un jour de semaine + une heure, répété sur
l'année) ne passera pas tel quel — c'est une limite du modèle d'écriture
existant depuis le LOT 1, pas quelque chose que ce lot pouvait corriger
sans réécrire `schedule-slot-input.ts` et sa contrainte de 80 lignes par
envoi.

### Le même point d'écriture, jamais un second

`api/schedule/admin/imports/[id]/tabular-mapping.ts` (GET + POST, nouveau) :
- GET : relit les en-têtes déjà stockés par le worker
  (`validation_summary.tabularHeaders`) et la dernière correspondance
  enregistrée pour ce périmètre, pour préremplir l'écran.
- POST : valide la correspondance, retélécharge le fichier depuis le
  stockage privé (jamais confiance dans un calcul fait côté navigateur),
  le relit à l'identique, vérifie que les en-têtes n'ont pas changé depuis
  la lecture technique initiale, applique la correspondance, puis dans une
  seule transaction : enregistre la correspondance pour le prochain import,
  fait passer la version en `review` avec le bon `page_count`, crée une
  page `schedule_page_indexes` par groupe (statut `draft`, comme pour un
  PDF déposé manuellement). **Cette route n'écrit jamais dans
  `schedule_slots` elle-même** : elle renvoie les créneaux calculés par
  page, et c'est la route déjà existante et déjà prouvée en LOT 1/2
  (`pages/[pageId]/slots.ts` → `api/_shared/schedule-slot-write.ts`,
  inchangée) qui les écrit, après la même vérification humaine par page
  qu'un PDF.

**Bogue réel trouvé et corrigé par la recette PostgreSQL, pas par
relecture** : `schedule_page_indexes` porte un déclencheur
(`20260829113248_enforce_schedule_page_review_bounds.sql`) qui refuse toute
ligne tant que la version source n'est pas déjà `review`, avec un
`page_number` borné par son `page_count`. Le premier jet de la route et de
la recette créait les pages avant de faire passer le statut en `review` :
rejeté en base avec « Schedule page indexes are editable only during human
review ». Corrigé dans les deux (mettre à jour le statut et le
`page_count` d'abord, créer les pages ensuite) — exactement le genre
d'erreur qu'une recette PostgreSQL réelle attrape et qu'une lecture de code
seule aurait laissée passer.

### Écran (formulaire de dépôt + correspondance)

`src/pages/admin/ScheduleImportPage.tsx` :
- Sélecteur de format (PDF officiel / export tabulaire CSV ou Excel), qui
  adapte l'`accept` du sélecteur de fichier, le contrôle de validité et le
  type MIME envoyé.
- Nouvel état `mapping_pending` dans la légende de statut.
- Affiche `ScheduleTabularMappingPanel` (nouveau composant) pour un import
  en attente de correspondance : lit les colonnes réelles, propose un menu
  déroulant par champ cible (jamais de texte libre), empêche de réutiliser
  deux fois le même en-tête, applique la correspondance.
- Une fois appliquée, les pages créées apparaissent dans l'index des pages
  existant (même écran que le PDF) ; après vérification humaine de chaque
  page, un bouton dédié « Écrire les X créneaux du fichier » envoie les
  lignes précalculées à la route d'écriture déjà existante — sans passer
  par la saisie manuelle (`ScheduleSlotEditor`), qui reste disponible pour
  un PDF ou pour toute page sans données précalculées.

`shared/schedule-import-input.ts` et `shared/schedule-admin-payload.ts` ont
été étendus (format, types MIME tabulaires, extension de fichier calculée,
nom de fichier accepté au-delà de `.pdf`) avec compatibilité ascendante
explicitement testée (`sourceFormat` omis ⇒ `pdf_import`, comportement PDF
strictement inchangé).

### Worker

`workers/schedule-document-worker.mjs` : après l'antivirus, un fichier
tabulaire ne suit plus le découpage PDF (pas de « page » à isoler) : il est
lu par `parseScheduleTabularBytes`, et la version passe en
`mapping_pending` avec les en-têtes et le nombre de lignes en
`validation_summary`. Le circuit PDF (inspection, découpage en pages
privées, `review`) est strictement inchangé — vérifié par lecture et par
`npm run test:schedule-document-worker` (4/4, toujours vert).

## Ce qui n'a pas été touché

- `api/_shared/schedule-slot-write.ts` (le point d'écriture unique) :
  zéro ligne modifiée. C'est le point central du plan et il reste
  identique.
- `approve.ts` (LOT 2) : zéro ligne modifiée — sa porte s'applique sans
  adaptation à une version d'origine tabulaire, prouvé par la recette
  ci-dessous.
- `ScheduleSlotEditor.tsx` : inchangé, reste le chemin de saisie manuelle.

## Preuves obtenues

- `node node_modules/typescript/bin/tsc --noEmit` : aucune erreur.
- `npx vite build` : succès (avertissement préexistant sur la taille du
  chunk `xlsx`, sans rapport avec ce lot — cette dépendance est déjà
  utilisée par `IdentityDirectoryPage`).
- `node scripts/test-schedule-tabular-parser.mjs` : 14/14 (nouveau).
- `node --experimental-strip-types scripts/test-schedule-tabular-mapping.mjs` :
  20 assertions (nouveau).
- `npm run test:schedule-import-input` : 11/11 (6 existants inchangés + 5
  nouveaux pour le format tabulaire et la compatibilité ascendante).
- `npm run test:schedule-admin-payload` : 10/10 (8 existants inchangés + 2
  nouveaux : réservation tabulaire, statut `mapping_pending`).
- `npm run test:schedule-document-worker` : 4/4, inchangé.
- `npm run test:schedule-import-security` : 4 + 20 tests, inchangé.
- **`npm run recipe:local-schedule-tabular-mapping-adversarial` — preuve
  PostgreSQL locale réelle** (établissement, personnel et fichier
  entièrement fictifs) : 11 assertions passées. Prouve, en base réelle et
  pas seulement par hypothèse sur le comportement de la requête : la
  correspondance de colonnes produit deux pages distinctes pour deux
  classes distinctes trouvées dans un fichier fictif ; la version passe
  réellement en `review` avec le bon `page_count` ; les lignes calculées à
  partir du fichier traversent **sans aucune adaptation** le même
  `writeScheduleSlots` déjà prouvé en LOT 1/2 pour le PDF ; la porte
  d'approbation du LOT 2 (`findVerifiedPagesWithoutSlots`) détecte
  correctement une page tabulaire vérifiée mais encore vide, puis se lève
  après écriture. `rollbackVerified: true`, aucune trace de l'établissement
  fictif après la transaction. Cible `127.0.0.1:54322`, jamais
  `--linked`.
- Avant cette recette persistée, un script jetable (non conservé) a
  vérifié directement en base que : un PDF garde son rejet si le type MIME
  n'est pas `application/pdf` ; un import tabulaire CSV et un import
  tabulaire Excel sont acceptés ; un type MIME hors liste et un
  `source_format` inconnu sont rejetés ; le statut `mapping_pending` est
  accepté ; l'action d'audit `apply_tabular_mapping` est acceptée ; la
  table `schedule_tabular_column_mappings` accepte un enregistrement puis
  un remplacement (upsert) pour le même périmètre. 9 assertions, avec
  retour arrière vérifié.
- `npm run test:preview-security-gate` : code de sortie 0, 896 occurrences
  de `✔`, 0 `✖`, terminée sur `test:migration-integrity` (110 migrations,
  versions uniques) — aucune régression détectée sur l'ensemble de la
  chaîne existante.
- `npm run test:spec-integrity` : OK (5 specs, 635 tâches, inchangé).

## Non vérifié (à dire explicitement)

- **Aucune recette navigateur réelle** : le sélecteur de format, le panneau
  de correspondance de colonnes et le bouton « Écrire les créneaux du
  fichier » n'ont pas été cliqués dans un vrai navigateur contre une base
  locale. Vérifiés par lecture de code, `tsc` et `vite build` uniquement.
  C'est du ressort du LOT 4 du plan (recette réelle de bout en bout).
- **La route HTTP complète avec authentification Supabase n'a pas été
  rejouée** : la recette adverse teste la logique de transaction de
  `tabular-mapping.ts` (verrou, upsert, création des pages, passage en
  `review`) tirée directement de la route, pas le handler Vercel complet
  avec `requireScheduleManager` (JWT, appartenance à l'établissement, MFA)
  ni le téléchargement réel depuis Supabase Storage. Même niveau de preuve
  que les LOT 1 et LOT 2 de ce plan.
- **Le worker n'a pas été rejoué contre la file `pgmq` réelle pour un
  fichier tabulaire** : la branche tabulaire de
  `schedule-document-worker.mjs` (parse + `mapping_pending`) est vérifiée
  par lecture de code et par les tests unitaires du parseur, mais aucun
  test ne fait tourner le worker complet (antivirus réel inclus) sur un
  job de la file pour un CSV/Excel, contrairement à la branche PDF qui a sa
  propre recette (`test:local-real-clamav-scanner` notamment, non
  spécifique à ce lot).
- **Diversité réelle des fichiers Excel** : les fixtures de test sont
  construites par la bibliothèque `xlsx` elle-même, jamais un fichier
  produit par un vrai tableur (feuilles multiples volontairement ignorées
  au-delà de la première, formules complexes, encodages exotiques d'un
  export EDT réel).
- **Aucune expansion de récurrence hebdomadaire** : documenté ci-dessus
  comme une limite assumée du modèle d'écriture existant, pas un oubli à
  corriger silencieusement.

## Statut

LOT 3 terminé au sens du plan : un fichier tabulaire (CSV ou Excel) peut
être déposé, ses colonnes réelles sont présentées à l'écran sans aucune
devinette, l'administrateur fait lui-même correspondre classe/professeur,
matière, salle, jour, heures, et cette correspondance est enregistrée pour
le prochain import du même périmètre. L'écriture des créneaux passe par le
même point d'écriture et le même versionnage que le PDF, sans aucune
modification de ce point d'écriture — prouvé par une recette PostgreSQL
locale réelle qui a d'ailleurs révélé et fait corriger une contrainte de
base mal ordonnée. Non prouvé par un clic navigateur réel ni par la route
HTTP authentifiée complète, ni par un job de file d'attente réel pour le
worker — à couvrir par le LOT 4 (« Recette réelle de bout en bout »).
