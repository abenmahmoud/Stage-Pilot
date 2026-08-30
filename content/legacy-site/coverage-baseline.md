# Matrice de couverture de l'ancien site

**Date de la preuve** : 2026-08-30

**Inventaire source** : `content/legacy-site/inventory.json`, généré le 2026-08-28

**Cible** : preview LyceeGest uniquement

Cette matrice rapproche chaque contenu WordPress inventorié de sa destination
prévue dans LyceeGest. Elle prouve la reprise technique et la conservation des
adresses, pas la qualité éditoriale. Les 28 contenus restent des brouillons à
relire et aucun ne peut être publié automatiquement.

| Slug inventorié | Titre | Classement | Brouillon preview | Destination prévue | Médias | Validation restante |
| --- | --- | --- | --- | --- | --- | --- |
| `accueil-historique` | Accueil | à confirmer | Oui | `/prototype` ; source conservée dans `/site/accueil-historique` | Sans écart bloquant connu | Direction requise |
| `1159-2` | Une deuxième édition de la semaine de la science | archive | Oui | `/site/1159-2` | Sans écart bloquant connu | Archivage à confirmer |
| `bac-general` | Bac général | durable | Oui | `/site/bac-general` | Sans écart bloquant connu | Équipe pédagogique requise |
| `bac-professionnel` | Bac professionnel | durable | Oui | `/site/bac-professionnel` | Sans écart bloquant connu | Équipe pédagogique requise |
| `bac-technologique` | Bac technologique | durable | Oui | `/site/bac-technologique` | Sans écart bloquant connu | Équipe pédagogique requise |
| `bal-de-fin-dannee` | Bal de fin d'année | archive | Oui | `/site/bal-de-fin-dannee` | Sans écart bloquant connu | Archivage à confirmer |
| `cap-etl` | CAP AQE | durable | Oui | `/site/cap-etl` | Sans écart bloquant connu | Intitulé officiel à confirmer |
| `cdi` | CDI | durable | Oui | `/site/cdi` | Sans écart bloquant connu | Horaires et services à confirmer |
| `contact` | Contact | à confirmer | Oui | `/site/contact` | Sans écart bloquant connu | Coordonnées à confirmer |
| `exposition-loeuvre-dart-du-mois` | Exposition l'œuvre d'art du mois | archive | Oui | `/site/exposition-loeuvre-dart-du-mois` | Sans écart bloquant connu | Archivage à confirmer |
| `formations` | Formations | durable | Oui | `/site/formations` | Sans écart bloquant connu | Équipe pédagogique requise |
| `hlp` | HLP | durable | Oui | `/site/hlp` | Sans écart bloquant connu | Équipe pédagogique requise |
| `https-docs-google-com-forms-d-e-1faipqlsety2swpyoogjbjt-qj2tz9z6fnhwk5if-valme6sup9ukayw-viewform` | Inscription mini-stages découverte | à confirmer | Oui | `/site/https-docs-google-com-forms-d-e-1faipqlsety2swpyoogjbjt-qj2tz9z6fnhwk5if-valme6sup9ukayw-viewform` | Sans écart bloquant connu | Dates et responsable requis |
| `llce` | LLCE | durable | Oui | `/site/llce` | Sans écart bloquant connu | Équipe pédagogique requise |
| `localisation` | Localisation | à confirmer | Oui | `/site/localisation` | Sans écart bloquant connu | Itinéraires à confirmer |
| `london-trip-review` | London Trip Review | archive | Oui | `/site/london-trip-review` | **Bloqué** : PDF de 49,8 Mo à optimiser ou remplacer | Fichier et archivage à confirmer |
| `maths` | Maths | durable | Oui | `/site/maths` | Sans écart bloquant connu | Équipe pédagogique requise |
| `nouveau-site-lycee` | Nouveau site lycée | à confirmer | Oui | `/site/nouveau-site-lycee` | Sans écart bloquant connu | Utilité à décider |
| `nsi` | NSI | durable | Oui | `/site/nsi` | Sans écart bloquant connu | Équipe pédagogique requise |
| `planning-de-rentree-2024` | Planning de rentrée - septembre 2025 | archive | Oui | `/site/planning-de-rentree-2024` | Sans écart bloquant connu | Archiver ; ne pas présenter comme actuel |
| `presentation-lycee` | Présentation Lycée | durable | Oui | `/site/presentation-lycee` | Sans écart bloquant connu | Direction requise |
| `presentations-clubs` | Présentations Clubs | durable | Oui | `/site/presentations-clubs` | Sans écart bloquant connu | Clubs et responsables à confirmer |
| `se-connecter` | Se connecter | à confirmer | Oui | `/site/se-connecter` | Sans écart bloquant connu | Liens officiels à confirmer |
| `specialites` | Spécialités | durable | Oui | `/site/specialites` | Sans écart bloquant connu | Équipe pédagogique requise |
| `tournoi-de-football` | Tournoi de Football | archive | Oui | `/site/tournoi-de-football` | Sans écart bloquant connu | Archivage à confirmer |
| `un-atelier-pour-etre-plus-a-laise-a-loral` | Un atelier pour être plus à l'aise à l'oral ! | archive | Oui | `/site/un-atelier-pour-etre-plus-a-laise-a-loral` | Sans écart bloquant connu | Archivage à confirmer |
| `unss` | UNSS | durable | Oui | `/site/unss` | Sans écart bloquant connu | Horaires et documents à confirmer |
| `vie-du-lycee` | Vie du Lycée | durable | Oui | `/site/vie-du-lycee` | Sans écart bloquant connu | Activités et responsables à confirmer |

## Lecture de l'état

- **Couverture technique** : 28 contenus sur 28 ont un brouillon de preview.
- **Parité de l'inventaire** : le contrôle public borné du 30 août 2026 retrouve
  28 contenus sur 28, sans ajout, retrait ou modification. La commande
  `npm run legacy:check-drift` permet de répéter cette preuve sans rien écrire.
- **Conservation des adresses** : les 27 anciennes adresses hors accueil ont une
  redirection versionnée ; l'accueil relève de la future bascule globale.
- **Décisions éditoriales** : 15 contenus durables, 7 archives et 6 contenus à
  confirmer restent soumis à validation humaine.
- **Médias** : 78 objets sur 81 accessibles ont été copiés. Le PDF du voyage à
  Londres est le seul média refusé rattaché à un contenu repris. Deux variantes
  DOCX refusées ne sont rattachées à aucun des 28 contenus.

## Condition de fermeture de T018

T018 reste ouverte jusqu'à une comparaison visuelle et éditoriale des 28 lignes
par la direction ou le service responsable. La validation doit contrôler le
français, les dates, les responsables, les fichiers, les liens et le rendu
mobile/ordinateur ; elle ne peut pas être déduite de cette matrice.

La preuve technique détaillée est conservée dans
`docs/operations/LEGACY_WORDPRESS_DRIFT_CHECK_2026-08-30.md`.
