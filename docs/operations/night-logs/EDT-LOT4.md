# LOT 4 — Recette adverse

Plan : `docs/operations/PLAN_DONNEES_REELLES_2026-09-06.md`, §LOT 4. Périmètre
exécuté strictement : LOT 4 seulement, dans la continuité des LOT 1, 2 et 3
(déjà committés : `424e607`, `4507fcb`, `6638361`). Branche
`codex/lycee-connect-prototype`, aucun `git push`, aucune donnée de
`~/Documents/LyceeGest-DONNEES-PRIVEES` lue ni citée. Tout le travail (lecture
du code, écriture du script, exécution des recettes, rédaction) a eu lieu dans
cette session, sans délégation à un agent en arrière-plan.

## Ce qui a été construit

`scripts/test-local-schedule-identity-adversarial.mjs` (nouveau), exposé par
`npm run recipe:local-schedule-identity-adversarial` (`package.json`).
Personnes, deux établissements et un emploi du temps entièrement fictifs, sur
PostgreSQL local réel (`127.0.0.1:54322`, pile Supabase locale déjà en cours
cette nuit). Appelle les **vraies** fonctions déjà auditées par les LOT 1 et
LOT 2 — `writeScheduleSlots` (`api/_shared/schedule-slot-write.ts`),
`readCoursesForDayForVerifiedIdentity` / `resolveVerifiedScheduleScope`
(`api/_shared/schedule-identity-reader.ts`) — avec de **vrais jetons Supabase
Auth locaux** (compte créé via l'API admin, connexion réelle, jeton d'accès
réel transmis en en-tête `Authorization`), pas des identités simulées. Les
transitions de statut d'une version d'emploi du temps (`processing` →
`review` → `approved` → `active` → `superseded` → `retired`) sont reproduites
dans le même ordre exact qu'exige le vrai déclencheur
`schedule_validate_source_promotion`, jamais raccourcies.

## Scénario et points prouvés (texte exact du plan)

Un élève (`STU1`), un parent rattaché à cet élève (`GRD1`), un deuxième élève
sans lien avec ce parent (`STU2`), et un membre d'un **second établissement**
fictif — quatre vrais comptes/identités, deux classes (3A/3B), deux groupes
(sciences/arts), une version d'emploi du temps avec quatre cours réels.

1. **Un élève ne voit que sa classe et ses groupes.** L'élève lit exactement
   les deux cours de sa classe et de son groupe (mathématiques, atelier
   sciences) ; jamais les cours de la classe 3B ni de l'atelier arts.
2. **Un parent ne voit que ses enfants rattachés.** Le parent, en désignant
   son enfant, obtient exactement les mêmes deux cours. En désignant le
   deuxième élève (sans relation `guardian_of` réelle en base), la vraie
   fonction refuse avec une `HttpError(403)` — pas une réponse vide qui
   laisserait deviner une existence.
3. **Un membre d'un autre établissement ne voit rien.** Un compte dont
   l'identité scolaire est rattachée à l'établissement B, interrogé alors que
   ce script entier est configuré (`SUPPORT_INSTITUTION_SLUG`) pour
   l'établissement A — exactement la configuration mono-établissement réelle
   d'un déploiement — reçoit `HttpError(403)` avant toute lecture de créneau.
4. **Une version d'import retirée n'est plus lue.** Une deuxième version est
   approuvée puis activée (ce qui bascule réellement la première en
   `superseded`, via la même séquence que `activate.ts`) : l'élève relit sa
   journée et obtient une réponse honnête (`ok: true, courses: []`), pas un
   refus — les cours de l'ancienne version ont disparu parce qu'elle n'est
   plus active, pas parce que la table a été vidée. La première version est
   ensuite **explicitement retirée** (mêmes conditions exactes que
   `api/schedule/admin/imports/[id]/retire.ts` et son déclencheur : motif de
   20 à 1 000 caractères, gouvernance de rétention `pending_dpo`) ; une
   ligne d'audit `retire` réelle est vérifiée en base ; la lecture reste
   inchangée après le retrait.
5. **Aucune coordonnée en clair n'est stockée ni renvoyée.** Vérifié à trois
   niveaux, pas seulement par confiance dans un commentaire de migration :
   - structurel — `information_schema.columns` interrogé en direct sur
     `identity_directory_rows`, `school_identities`, `schedule_slots` et
     `schedule_source_versions` : chaque colonne dont le nom contient
     « email » ou « phone » se termine par `_hash` (aucune colonne en clair
     n'existe, pas seulement « n'est pas utilisée ») ;
   - une coordonnée fictive (`coord-marker-<marqueur>@example.test`) n'est
     stockée que sous forme de hachage SHA-256, vérifié égal à la valeur
     attendue ;
   - balayage direct de huit tables (dont `schedule_audit`,
     `identity_directory_audit`, `identity_directory_imports`) castées en
     texte : zéro ligne ne contient la coordonnée en clair, nulle part ;
   - les objets `course` réellement renvoyés à l'élève et au parent n'ont
     **que** les six champs attendus (`subjectCode`, `subjectLabel`,
     `roomCode`, `startsAt`, `endsAt`, `state`) — aucun champ supplémentaire
     n'a pu s'y glisser.
6. **Aucun nom ne peut être cherché librement.** Le vrai validateur
   (`parseIdentityLookupInput`, `shared/identity-directory-lookup.ts`) rejette
   `searchType: "name"` avec le message attendu. Rejoué aussi séparément :
   `node scripts/test-identity-directory-lookup.mjs` → 23/23, preuve fraîche
   dans cette session (ce test couvre en plus le chiffrement bout en bout du
   canal de consultation, hors périmètre direct de ce LOT 4 mais réutilisé
   comme preuve complémentaire plutôt que dupliqué).
7. **Le balayage anti-fuite ne trouve ni coordonnée ni code, nulle part.**
   - Statique : le texte source réel de `shared/schedule-assistant.ts`,
     `api/_shared/schedule-identity-reader.ts`, `api/_shared/schedule-reader.ts`
     et `shared/schedule-policy.ts` ne contient aucune référence à un champ de
     hachage de coordonnée ni à un appel de modèle IA — la réponse d'emploi du
     temps est un calcul déterministe, jamais un passage par le contexte du
     modèle (cohérent avec `usedAi: false` déjà prouvé au LOT 2).
   - Dynamique : `console.log`/`console.error` interceptés du tout début à la
     toute fin du script ; la coordonnée fictive n'apparaît dans **aucune**
     ligne capturée.

## Panne rencontrée et corrigée avant de conclure

Le tout premier essai a échoué de façon intermittente sur
`readCoursesForDayForVerifiedIdentity` (`source_unavailable`) alors que la
version était bien active en base. Cause identifiée : décalage d'horloge
entre ce processus Node et le conteneur PostgreSQL local — la politique
(`shared/schedule-policy.ts`) refuse une version dont `activatedAt` est
postérieur à l'instant `now` transmis par l'appelant. Corrigé en construisant
`now` avec une marge de 15 secondes au-dessus de l'horloge du processus
(`readNow()`), pas en modifiant la politique elle-même. Rejoué **quatre fois
de suite** après correction : succès systématique (37 assertions à chaque
fois).

## Nettoyage et ce qui reste volontairement dans la pile locale

Chaque exécution supprime les comptes Supabase Auth créés pour l'élève, le
parent et le membre étranger, ainsi que toutes les lignes du répertoire
d'identité (`identity_directory_rows`, `school_relationships`,
`school_identities`, `identity_directory_imports`, `identity_directory_audit`)
propres à ses deux établissements fictifs.

**Ne peut pas être supprimé, par une vraie garantie déjà prouvée au LOT 1, pas
par un oubli** : `schedule_slots_guard_source` rend un créneau immuable — y
compris pour une suppression — dès que sa version atteint `active`,
`superseded` ou `retired`. Ce LOT 4 active délibérément deux versions pour
prouver le point 4 du plan ; les lignes `schedule_source_versions` /
`schedule_slots` / `schedule_page_indexes` / `schedule_page_assets` /
`schedule_audit` qui en résultent, les deux établissements fictifs qui les
portent, et le compte technique (`auth.users`) qui les a déposées (retenu par
une contrainte `on delete restrict` depuis `schedule_source_versions.uploaded_by`)
restent donc dans la pile locale après chaque exécution. Découvert pendant ce
lot : la première tentative de nettoyage utilisait une syntaxe SQL erronée
(`= any((${a}, ${b}))`, interprétée comme un n-uplet, pas un tableau) qui a
silencieusement échoué avant correction — corrigée en `in (${a}, ${b})`, puis
vérifiée par une requête directe sur `information_schema` après coup :
c'est cette vérification qui a révélé la vraie cause (l'immuabilité des
créneaux activés), pas une supposition. Résidu mesuré en fin de session :
18 établissements fictifs `edt-lot4-*` et leurs chaînes d'emploi du temps,
plus les comptes techniques associés — isolés par un marqueur aléatoire
unique par exécution, sans collision possible avec les données réelles ni
avec les autres lots de cette nuit. Sans conséquence pour un usage normal de
l'application (aucune route ne lit ces établissements fictifs), mais à garder
en tête si Adel exécute `supabase db reset` pour repartir d'une pile
totalement vierge.

## Preuves obtenues (réelles, pas simulées)

- `npm run recipe:local-schedule-identity-adversarial` : **37 assertions**,
  succès, rejoué cinq fois au total dans cette session (une fois pour
  diagnostiquer la panne d'horloge, quatre fois après correction, dont la
  toute dernière juste avant de conclure) — `{"target":"127.0.0.1:54322","assertions":37,"realData":false,"outcome":"pass"}`.
- `node scripts/test-identity-directory-lookup.mjs` → 23/23 (preuve
  complémentaire du point 6, rejouée fraîchement).
- `node node_modules/typescript/bin/tsc --noEmit` : aucune erreur (dépôt
  entier, y compris le nouveau script).
- `npx vite build` : succès (même avertissement pré-existant sur la taille de
  certains chunks, non lié à ce lot).
- `npm run test:preview-security-gate` : succès complet, code de sortie `0`.
- `npm run test:spec-integrity` : succès, 635 tâches, résumé inchangé par
  rapport à avant ce lot (ce lot ne touche aucune tâche Spec Kit existante).

## Ce qui n'a PAS été fait, à dire explicitement

- **Aucune vérification dans un vrai navigateur.** Ce lot porte sur la
  cloison des données côté serveur (lecteurs réels, PostgreSQL réel), pas sur
  le rendu d'un écran ; aucune page de l'admin emploi du temps n'a été
  ouverte dans Chromium ici.
- **Le canal de recherche sécurisée du répertoire (chiffrement RSA,
  file d'attente `pgmq`) n'a pas été rejoué en conditions réelles dans ce
  lot.** Le point 6 du plan (« aucun nom ne peut être cherché librement ») est
  prouvé au niveau du validateur d'entrée, qui est le seul point qui accepte
  ou refuse un `searchType` — le circuit chiffré complet a sa propre preuve
  dédiée (`scripts/test-identity-directory-lookup.mjs`, rejouée ici) et n'a
  pas été dupliqué.
- **Aucune tâche Spec Kit fermée.** Comme pour les LOT 1 à 3, ce plan
  opérationnel n'est rattaché à aucune tâche Spec Kit numérotée.

## Statut

LOT 4 terminé et prouvé par une recette PostgreSQL locale réelle avec de
vrais comptes Supabase Auth, rejouée cinq fois avec un succès systématique
après correction d'une panne d'horloge intermittente. Les sept points du plan
sont couverts avec preuve directe (requêtes SQL réelles, appels aux vraies
fonctions de lecture, refus HTTP réels) plutôt que par supposition. Reste
ouvert, hors périmètre de ce lot : LOT 5 (clôture honnête), non commencé ici.
