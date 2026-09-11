# Charte du portail Blaise Cendrars

Référence validée par Adel : l’accueil du lycée, le 10 septembre 2026.
Le guide Chromebook, les articles, les services, les demandes et les espaces de connexion doivent être reconnaissables comme un seul site.

## Identité

- Nom public : **Lycée Blaise Cendrars**, complément **Lycée polyvalent · Sevran**.
- Portrait unique : `/blaise-cendrars-portrait.webp`. Conserver la photographie de l’accueil.
- LyceeGest désigne les outils métier, pas un établissement différent.
- Titres : Space Grotesk. Texte et commandes : DM Sans, avec repli système.
- Bleu d’action `#155eef`, bleu nuit `#193550`, texte `#132238`, texte secondaire `#586b82`, fond `#f4f7fb`, surfaces blanches, bordures `#dbe3ec`.
- Vert, orange et rouge réservés aux états qui ont un sens : validation, attention et erreur. Une rubrique ne reçoit pas une identité différente selon son sujet.

## Cadre commun

`src/components/PublicPortalShell.tsx` porte la navigation, le portrait, l’installation PWA, les informations flash publiées et le pied de page. Les pages lui fournissent leur contenu et leur rubrique active. L’état des conversations et les contrôles d’identité restent dans leurs composants métier.

Les variables `--school-*` sont définies dans `src/index.css`. Les ajustements du portail sont dans `src/styles/portal-charter.css`. `chromebook.css` ne définit que la disposition propre au guide et réutilise ces variables.

## Mise en page

- Arrondis de surface 14 px ; commandes 10 px ; bordures fines ; ombres discrètes.
- Espacements par multiples de 4 px. Marges latérales de 16 px sur téléphone.
- Texte principal de 15–16 px, mentions de 12–13 px. Titres de page de 26–42 px selon la surface.
- Un titre, une courte introduction, une action principale. Les liens complémentaires sont visuellement secondaires.
- Les dates de distribution sont séparées du guide annuel. Leur disparition dépend du calendrier existant, pas d’une modification manuelle du style.

## Téléphone et accessibilité

- En-tête compact : menu, identité, installation si disponible, espace professionnel.
- À la une et Webmail restent dans le menu. Barre inférieure constante : Accueil, Services, Aide, Suivi, Lycée.
- Cibles principales d’au moins 44 px ; champs de saisie de 16 px sur téléphone pour éviter le zoom automatique iOS.
- Focus clavier visible, menu refermable avec Échap et retour du focus, accordéons avec état accessible, préférence de réduction des animations respectée.
- Pas de défilement horizontal de la page. Les filtres du guide peuvent défiler horizontalement dans leur propre rangée.
- Le chat conserve son historique et sa zone de saisie. Aucune information personnelle n’est rendue publique pour faciliter la présentation.

## Évolutions

### Photographies des actualités — 11 septembre 2026

Les articles utilisent une photographie compacte en tête et une vignette dans la liste. La collection locale `public/news` conserve une lumière naturelle, des accents bleu nuit et des tables claires, sans texte intégré. Les images d’illustration sont identifiées comme telles. La couverture ajoutée par un éditeur reste prioritaire ; le thème du titre choisit sinon une illustration parmi six sujets, avec la façade du lycée comme repli. Les aperçus de l’administration utilisent le même composant. Sur téléphone : photographie de tête de 180 px maximum, titres sur plusieurs lignes, vignette de 80 px, boutons d’accueil « Besoin d’aide ? » à gauche et « À la une » à droite. Ne pas générer une image à chaque visite.

Toute nouvelle page publique réutilise `PublicPortalShell`. Ne pas recréer un en-tête, une barre mobile, un autre logo ou une nouvelle palette dans une page thématique. Vérifier le chemin accueil → page → aide → suivi sur ordinateur et téléphone avant publication.

### Calendrier public — 11 septembre 2026

Sur ordinateur : mois à gauche, rendez-vous illustrés à droite, marges sobres et cartes blanches. Sur téléphone : liste par défaut, choix Liste/Mois visible et titre lisible à 320 px. Le jour sélectionné est bleu ; les points signalent les dates publiées. Les miniatures reprennent les photos des actualités. L’accueil montre deux prochains rendez-vous et l’accès au calendrier. Les heures inconnues sont signalées ; ne pas créer un horaire pour remplir un vide. Un fichier agenda reste présenté comme une copie à importer.

### Accueil personnel — 11 septembre 2026

Le bloc « Pour moi, aujourd’hui » suit la photo avec une marge positive de 28 px. Deux colonnes dans une surface blanche sur ordinateur, emploi du temps puis demandes sur téléphone. Le bandeau final conduit au chat. Sans session, une invitation compacte ouvre le parcours d’identité existant ; aucun envoi de code à l’ouverture de la page. Les états indisponibles restent sobres et proposent une action utile. Les informations communes du calendrier sont visuellement séparées des données personnelles. Couleurs, typographies, navigation et commande radio restent celles du portail.
