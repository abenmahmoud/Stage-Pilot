# LOT 3 — État exact de la reprise éditoriale

Date : 2026-09-03 (nuit), branche `codex/lycee-connect-prototype`.
Aucune action distante. Rien poussé. Aucun contenu inventé, aucune
publication.

## Résultat en un mot

**Inventaire livré.** Le document
`docs/operations/BASCULE_SITE_ETAT_EDITORIAL_2026-09-03.md` couvre les 28
contenus repris (slug, destination, état, publiable ou non), les bloqueurs
connus, l'état réel de T017B, les 27 redirections et, pour chaque contenu,
la décision humaine exacte attendue. **Constat central : les 28 contenus
sont non publiables aujourd'hui**, d'abord à cause du verrou de publication
T007 (vérification direction manquante pour les 28), et pour 3 d'entre eux
(`contact`, `presentations-clubs`, `london-trip-review`) à cause d'un
blocage technique qui subsisterait même après vérification.

## Méthode

Lecture du dépôt uniquement, comme demandé par le plan (« en lisant le dépôt
et non les cases cochées ») :
- `content/legacy-site/coverage-baseline.md` (matrice des 28 contenus,
  preuve du 30 août 2026) ;
- `content/legacy-site/editorial-review.md` (constats par contenu : 2
  bloquants, 20 corrections importantes, 31 validations humaines) ;
- `docs/operations/LEGACY_IMPORT_PREVIEW_2026-08-28.md` (échecs de médias,
  redirections, réparation des liens internes) ;
- `specs/004-reprise-site-officiel/tasks.md` (T007, T012, T016, T017,
  T017A/B/C, T018/A/B) ;
- `specs/project-memory.md`, grep ciblé sur `T017B` (ligne 649 : tâche
  terminée) ;
- `vercel.json` (27 redirections permanentes vers `/site/<slug>`).

Deux contrôles locaux rejoués ce soir pour ne pas se fier à une preuve
ancienne sans la revérifier :

```
npm run test:legacy-routes    → 2/2 tests passés
npm run test:legacy-coverage  → 4/4 tests passés
```

Ces deux commandes comparent uniquement des fichiers versionnés
(`vercel.json` et `content/legacy-site/inventory.json`) ; elles ne touchent
ni la base de preview distante `guichet-lycee-preview`, ni la production —
aucune action distante n'a été nécessaire ni tentée.

## Constats notables au-delà des cases cochées

- T017B est marquée terminée dans `tasks.md` et dans `project-memory.md`,
  mais cela ne prouve que l'écriture et le test du code de correction, pas
  son exécution contre la base de preview réelle. Rien dans le dépôt
  n'atteste qu'un import explicite a déjà été rejoué depuis l'écriture de ce
  code. C'est noté explicitement comme **SUPPOSÉ** (non prouvé) dans le
  document produit, pour que ce ne soit pas confondu avec une preuve
  d'exécution.
- T017C est également marquée terminée mais explicitement inactive :
  « Migration et interrupteurs restent désactivés : aucune correction
  distante n'est exécutée » — cohérent avec l'absence de tout drapeau activé
  cette nuit.
- Le verrou global T007 (publication bloquée tant que non vérifiée) rend les
  28 contenus non publiables indépendamment de leur qualité éditoriale ; ce
  n'est pas explicite dans la matrice de couverture existante et méritait
  d'être mis en avant avant toute lecture optimiste des « Sans écart
  bloquant connu » de `coverage-baseline.md`.
- Les deux DOCX refusés (`plaquette_aqe_2022.docx`, médias `1222`/`1223`) ne
  sont rattachés à aucun des 28 contenus repris : ils ne bloquent donc
  aucune des 28 pages, contrairement à une lecture rapide du plan qui
  pourrait laisser croire à un blocage direct.

## Fichier produit

`docs/operations/BASCULE_SITE_ETAT_EDITORIAL_2026-09-03.md`

## Distinction PROUVÉ / SUPPOSÉ / À FAIRE PAR LE PROPRIÉTAIRE

- **PROUVÉ** : les 28 contenus en brouillon, les 2 bloquants texte/lien, le
  média PDF refusé, les 27 redirections couvertes et revérifiées localement
  ce soir (6/6 tests), le verrou T007, la désactivation de T017C.
- **SUPPOSÉ** : l'exécution réelle de l'import explicite T017B sur la
  preview `guichet-lycee-preview` — la fonctionnalité existe et est testée,
  mais son exécution effective sur les brouillons réels n'est pas prouvée
  par le dépôt.
- **À FAIRE PAR LE PROPRIÉTAIRE** : les 8 décisions humaines listées en fin
  du document produit (Contact, image clubs, PDF Londres, DOCX AQE,
  validations durables/archives/à confirmer, vérification de l'exécution de
  T017B, comparaison visuelle T018).

## Portée non couverte par ce lot

Ce lot n'a pas exécuté T018 (comparaison visuelle et éditoriale) ni relancé
d'import réel — interdit par `CLAUDE.md` (aucune mutation Supabase distant)
et hors périmètre du LOT 3, qui est un inventaire, pas une correction.
