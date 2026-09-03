# État exact de la reprise éditoriale — 3 septembre 2026 (LOT 3)

Aucune action distante effectuée pour produire ce document : lecture du dépôt
uniquement (`content/legacy-site/coverage-baseline.md`,
`content/legacy-site/editorial-review.md`,
`docs/operations/LEGACY_IMPORT_PREVIEW_2026-08-28.md`,
`specs/004-reprise-site-officiel/tasks.md`, `vercel.json`), plus deux
contrôles locaux rejoués ce soir : `npm run test:legacy-routes` (2/2) et
`npm run test:legacy-coverage` (4/4), tous deux au vert. Ces deux commandes
ne comparent que des fichiers versionnés (`vercel.json`,
`content/legacy-site/inventory.json`, `coverage-baseline.md`) ; elles ne
lisent ni la base de preview distante `guichet-lycee-preview`, ni la
production. **PROUVÉ** : ce qui suit décrit l'état déclaré par le dépôt au
28-30 août 2026 (dernière preuve technique versionnée), pas un nouveau
contrôle de la base de preview réelle — impossible cette nuit sans action
distante, interdite par `CLAUDE.md`.

## Verrou global de publication (avant tout le reste)

**PROUVÉ** — `specs/004-reprise-site-officiel/tasks.md`, T007 : la
publication est bloquée tant que la reprise n'est pas marquée vérifiée par la
direction (action « Marquer comme vérifié », T006). Conséquence : **les 28
contenus sont non publiables aujourd'hui**, indépendamment de leur qualité
éditoriale, jusqu'à cette vérification humaine explicite par contenu. Le
tableau ci-dessous distingue donc deux niveaux : le blocage global (T007,
identique pour les 28) et les blocages techniques propres à 3 contenus qui
subsisteraient même après vérification.

## Les 28 contenus

Source : `content/legacy-site/coverage-baseline.md` (28/28, preuve du
30 août 2026) et `content/legacy-site/editorial-review.md` (constats par
contenu).

| Slug | Destination | Classement | État | Publiable |
| --- | --- | --- | --- | --- |
| `accueil-historique` | `/prototype` (source dans `/site/accueil-historique`) | à confirmer | Brouillon, `needsReview=true` | Non (T007 + décision direction sur les faits datés) |
| `1159-2` | `/site/1159-2` | archive | Brouillon, `needsReview=true` | Non (T007 + confirmation archivage) |
| `bac-general` | `/site/bac-general` | durable | Brouillon, `needsReview=true` | Non (T007 + relecture équipe pédagogique) |
| `bac-professionnel` | `/site/bac-professionnel` | durable | Brouillon, `needsReview=true` | Non (T007 + relecture équipe pédagogique) |
| `bac-technologique` | `/site/bac-technologique` | durable | Brouillon, `needsReview=true` | Non (T007 + relecture équipe pédagogique) |
| `bal-de-fin-dannee` | `/site/bal-de-fin-dannee` | archive | Brouillon, `needsReview=true` | Non (T007 + confirmation archivage) |
| `cap-etl` | `/site/cap-etl` | durable | Brouillon, `needsReview=true` | Non (T007 + intitulé officiel CAP AQE à confirmer) |
| `cdi` | `/site/cdi` | durable | Brouillon, `needsReview=true` | Non (T007 + horaires/services à confirmer) |
| `contact` | `/site/contact` | à confirmer | Brouillon, **corps vide** (`content.empty_body`, bloquant) | **Non — bloqué techniquement**, même après vérification |
| `exposition-loeuvre-dart-du-mois` | `/site/exposition-loeuvre-dart-du-mois` | archive | Brouillon, `needsReview=true` | Non (T007 + confirmation archivage) |
| `formations` | `/site/formations` | durable | Brouillon, `needsReview=true` | Non (T007 + relecture équipe pédagogique) |
| `hlp` | `/site/hlp` | durable | Brouillon, `needsReview=true` | Non (T007 + relecture équipe pédagogique) |
| `https-...-viewform` (mini-stages) | `/site/https-...-viewform` | à confirmer | Brouillon, `needsReview=true`, slug opaque signalé | Non (T007 + dates/responsable + décision sur le slug) |
| `llce` | `/site/llce` | durable | Brouillon, `needsReview=true` | Non (T007 + relecture équipe pédagogique) |
| `localisation` | `/site/localisation` | à confirmer | Brouillon, `needsReview=true` | Non (T007 + confirmation itinéraires) |
| `london-trip-review` | `/site/london-trip-review` | archive | Brouillon, **média PDF refusé (49,8 Mo)** | **Non — bloqué techniquement**, même après vérification |
| `maths` | `/site/maths` | durable | Brouillon, `needsReview=true` | Non (T007 + relecture équipe pédagogique) |
| `nouveau-site-lycee` | `/site/nouveau-site-lycee` | à confirmer | Brouillon, `needsReview=true` | Non (T007 + décision d'utilité) |
| `nsi` | `/site/nsi` | durable | Brouillon, `needsReview=true` | Non (T007 + relecture équipe pédagogique) |
| `planning-de-rentree-2024` | `/site/planning-de-rentree-2024` | archive | Brouillon, `needsReview=true`, année du titre à réaligner | Non (T007 + confirmation année + archivage) |
| `presentation-lycee` | `/site/presentation-lycee` | durable | Brouillon, `needsReview=true`, titre à corriger | Non (T007 + validation direction) |
| `presentations-clubs` | `/site/presentations-clubs` | durable | Brouillon, **lien HTTP non sécurisé + image locale cassée** (`links.insecure_http`, bloquant) | **Non — bloqué techniquement**, même après vérification |
| `se-connecter` | `/site/se-connecter` | à confirmer | Brouillon, `needsReview=true` | Non (T007 + confirmation liens officiels) |
| `specialites` | `/site/specialites` | durable | Brouillon, `needsReview=true` | Non (T007 + relecture équipe pédagogique) |
| `tournoi-de-football` | `/site/tournoi-de-football` | archive | Brouillon, `needsReview=true` | Non (T007 + confirmation archivage) |
| `un-atelier-pour-etre-plus-a-laise-a-loral` | `/site/un-atelier-pour-etre-plus-a-laise-a-loral` | archive | Brouillon, `needsReview=true` | Non (T007 + confirmation archivage) |
| `unss` | `/site/unss` | durable | Brouillon, `needsReview=true` | Non (T007 + horaires/documents à confirmer) |
| `vie-du-lycee` | `/site/vie-du-lycee` | durable | Brouillon, `needsReview=true`, titre à corriger | Non (T007 + validation direction) |

**Décompte** : 28/28 non publiables aujourd'hui. 3 le resteraient même après
la vérification T007 (`contact`, `presentations-clubs`,
`london-trip-review`) faute de correction du blocage technique. Les 25
autres deviennent publiables uniquement après vérification direction (T006)
et, pour les corrections « à corriger » listées dans
`editorial-review.md`, application effective de ces corrections avant mise
en ligne.

## Bloqueurs connus (détail)

1. **Page Contact vide** — `content.empty_body`, `editorial-review.md`
   ligne 95. Corps Markdown vide. Décision attendue : la direction rédige un
   nouveau contenu ou archive explicitement cette adresse ; aucune
   publication possible tant que l'un des deux choix n'est pas fait.
2. **Image locale cassée des clubs** — `presentations-clubs`,
   `links.insecure_http`, `editorial-review.md` ligne 194 :
   `http://localhost/wordpress/wp-content/uploads/2023/05/club.jpg`, une
   adresse locale du poste WordPress d'origine, jamais publiquement
   accessible. Confirmé aussi dans
   `docs/operations/LEGACY_IMPORT_PREVIEW_2026-08-28.md` (« Échecs isolés »,
   point 3). Décision attendue : la direction ou le service Vie du lycée
   fournit une image de remplacement hébergée en HTTPS ; sans quoi le lien
   cassé doit être retiré du brouillon.
3. **PDF du voyage à Londres, 49,8 Mo** — média WordPress `1168`,
   `Revue-Voyage-a-Londres-EURO-1.pdf`, au-delà de la limite de sécurité de
   10 Mo (`LEGACY_IMPORT_PREVIEW_2026-08-28.md`, « Échecs isolés », point 2).
   Seul média manquant rattaché à une page reprise (`london-trip-review`).
   Décision attendue : le service concerné fournit une version optimisée du
   PDF ou un lien officiel de remplacement ; sans cela la page reste
   publiable seulement sans ce document.
4. **Deux DOCX refusés** — médias WordPress `1222` et `1223`, deux variantes
   de `plaquette_aqe_2022.docx` : la source répond `text/plain` au lieu du
   type DOCX déclaré (`LEGACY_IMPORT_PREVIEW_2026-08-28.md`, « Échecs
   isolés », point 1). **Non rattachés à aucun des 28 contenus repris**
   (`coverage-baseline.md`, section Médias) : ils ne bloquent donc aucune
   des 28 pages du tableau ci-dessus, mais restent des fichiers manquants au
   dossier `cap-etl` (plaquette AQE) si la direction souhaite les
   réintégrer. Décision attendue : fournir une copie saine des deux fichiers
   ou confirmer qu'ils ne sont plus nécessaires.

## Corrections mécaniques déjà préparées (T017B) et leur état

**PROUVÉ** (`specs/004-reprise-site-officiel/tasks.md`, T017B ; confirmé
`specs/project-memory.md` ligne 649 : « `004/T017B` est terminée ») : le
code qui applique 21 corrections mécaniques réversibles sur 6 contenus
(typographie, titres, appels à l'action concaténés, libellés d'itinéraire,
titre d'adresse, image locale cassée) est écrit et testé. Ces corrections
s'appliquent **au prochain import explicite** — une action distincte,
déclenchée par la direction via l'espace contenus (`api/content/admin/
legacy-import.ts`), pas automatiquement.

**Nuance importante, non couverte par la case cochée** : rien dans le dépôt
ne prouve que cet import explicite a déjà été rejoué contre la branche de
preview réelle (`guichet-lycee-preview`) depuis l'écriture du code T017B. Le
dépôt documente le comportement attendu (source inchangée, brouillon
toujours `needsReview=true`, audit limité aux codes et compteurs) et des
tests unitaires du pipeline, mais pas une preuve d'exécution datée contre la
base de preview réelle. **SUPPOSÉ** : les 21 corrections ne sont pas
forcément déjà visibles sur les brouillons actuellement en ligne — à vérifier
par le propriétaire avant de s'appuyer dessus pour la relecture visuelle de
T018. Après cette passe (exécutée ou non), il resterait de toute façon 1
bloquant, 8 corrections importantes et 30 validations humaines ouvertes
(`coverage-baseline.md`, lignes 22-25).

T017C (correction des brouillons WordPress *déjà présents*, hors import) est
également marquée terminée dans le code, mais explicitement non exécutée :
« Migration et interrupteurs restent désactivés : aucune correction
distante n'est exécutée. »

## Les 27 redirections d'anciennes adresses et leur couverture

**PROUVÉ ce soir** : rejeu local de
`npm run test:legacy-routes` → 2/2 tests passés (normalisation de la barre
oblique finale ; une destination pour chaque ancienne page WordPress) et
`npm run test:legacy-coverage` → 4/4 tests passés (couverture exacte des 28
contenus, destination versionnée pour chaque ancienne adresse, décisions
éditoriales et média bloquant visibles, preuve technique non confondue avec
une validation).

`vercel.json` contient exactement 27 redirections permanentes vers `/site/
<slug>`, une par ancienne adresse hors accueil (les 28 contenus moins
`accueil-historique`, qui relève de la future bascule globale de domaine et
non d'une redirection de page). Une règle supplémentaire, non comptée dans
les 27, redirige `/category/:path*` vers `/?view=news`.

Preuve de couverture en ligne antérieure (non revérifiée cette nuit, aucune
action distante autorisée) : `docs/operations/LEGACY_IMPORT_PREVIEW_2026-08-28.md`
rapporte qu'après déploiement du commit `48547bd`, les 28 anciennes adresses
aboutissaient à la destination attendue sur la preview déployée, avec
normalisation de la forme historique à barre oblique finale. Cette preuve a
une date (28 août 2026) et une révision de code associées (`48547bd`) ; elle
n'a pas été rejouée en ligne cette nuit — seule la cohérence du fichier
`vercel.json` local avec l'inventaire a été revérifiée.

## Synthèse chiffrée

- Contenus inventoriés et repris en brouillon : **28/28**.
- Publiables aujourd'hui : **0/28** (verrou T007, vérification direction
  manquante).
- Bloqués techniquement même après vérification : **3/28**
  (`contact`, `presentations-clubs`, `london-trip-review`).
- Classement éditorial ouvert : 15 durables, 7 archives, 6 à confirmer
  (`coverage-baseline.md`).
- Redirections versionnées : **27/27** anciennes adresses hors accueil,
  revérifiées localement ce soir (6/6 tests entre les deux suites).
- Médias : 78/81 accessibles copiés ; 1 PDF refusé rattaché à un contenu
  (`london-trip-review`) ; 2 DOCX refusés non rattachés aux 28 contenus.
- Corrections mécaniques T017B : code terminé et testé ; **exécution contre
  la preview réelle non prouvée par le dépôt** — à confirmer par le
  propriétaire avant toute relecture visuelle finale (T018).

## Ce que le propriétaire doit trancher (récapitulatif)

- Contact : rédiger ou archiver.
- Présentations Clubs : fournir une image de remplacement en HTTPS ou
  retirer le lien.
- London Trip Review : fournir un PDF optimisé ou un lien de remplacement.
- Plaquette AQE (DOCX x2) : fournir une copie saine ou confirmer l'abandon.
- 15 contenus durables : faire valider par l'équipe pédagogique ou la
  direction concernée.
- 7 archives : confirmer l'archivage et l'absence de formulation « actuelle ».
- 6 contenus « à confirmer » (accueil, mini-stages, localisation, nouveau
  site lycée, se connecter, et le sous-cas Contact déjà cité) : confirmer
  faits, dates, responsables et liens.
- Vérifier si l'import explicite T017B a déjà été rejoué contre
  `guichet-lycee-preview` ; si non, le déclencher avant la relecture
  visuelle T018.
- Exécuter la comparaison visuelle et éditoriale T018, qui ne peut pas être
  déduite de ce document ni d'aucun contrôle automatique existant.
