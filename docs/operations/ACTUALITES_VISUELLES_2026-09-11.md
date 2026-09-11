# Actualités illustrées et accès depuis l’accueil

Adel souhaite une petite photographie adaptée à chaque article, une présentation mobile soignée et deux entrées côte à côte sur l’accueil : aide à gauche, actualités à droite.

## Réalisation
- Accueil : « Besoin d’aide ? » et « À la une » côte à côte, y compris à 320 px, accès au chat et au flux existants.
- Six photographies d’illustration créées avec Image Gen : planning, ordinateurs, rencontres avec les parents, sport, orientation et élections. Palette sobre cohérente avec la charte du portail. Aucune personne réelle représentée. Prompts et provenance dans `public/news/CREDITS.md`.
- WebP de 960 px pour l’article (25 à 45 Ko), vignettes de 360 px (7 à 12 Ko), dimensions explicites, chargement différé des vignettes et fichiers locaux sans tiers.
- `NewsPhoto` privilégie la couverture ajoutée par l’éditeur, puis une autre image du contenu. Sans image utilisable, `newsIllustration` choisit une photographie par thème du titre ; thème inconnu : façade existante du lycée. Repli si une image échoue, sans boucle de chargement.
- Photo compacte en tête du flux, vignettes dans la liste, photo sur la page individuelle et dans l’aperçu d’administration. Mention d’illustration sur les visuels générés, textes alternatifs et titres lisibles sur plusieurs lignes.
- Les futurs brouillons de l’hebdo bénéficient automatiquement de cette présentation. L’éditeur peut remplacer le visuel en joignant sa propre photographie depuis « Fichiers et images ».

## Contrôles
Build TypeScript/Vite et `test:preview-security-gate` réussis. Revue React : état local limité aux images en échec, pas d’effet de synchronisation, clés stables, dimensions d’images explicites, composant commun et absence de nouvel appel IA à la lecture.

Recette Playwright Chromium, car Browser plugin not available. Parcours : accueil → aide → accueil → à la une → sélection d’un article → page individuelle. Données locales : huit brouillons utilisés uniquement comme fixtures de navigateur, sans publication. Tailles ciblées : 1440, 390 et 320 px. Sources et preuves hors Git dans `../Actualites_visuelles_2026-09-11/`.

Recette locale réussie sur les trois tailles : navigation aide/actualités, six thèmes pour les huit articles, images décodées, pages individuelles, absence de débordement, zéro erreur JavaScript ou console. Captures comparées à la référence et relues avec `view_image`. Intégrité Spec Kit réussie. L’aperçu administratif utilise le composant partagé et compile ; aucune session d’administration réelle n’a été utilisée pour une publication de test.

Référence visuelle : capture fournie par Adel et charte de l’accueil existante ; ajustement dans ce système sans refonte du cadre public. Les contrôles portent sur les couleurs, polices, marges, proportions des images, lisibilité des titres et boutons. Contenu factuel et dates des articles conservés.

La publication de ce lot concerne la présentation et les images. Aucun brouillon n’est publié par ces changements, aucun email ni push envoyé, aucune modification des comptes, des droits, de l’EDT ou de la radio.

## Publication vérifiée
Commit fonctionnel `9dea25de36aaccec20f53f69dd25bba61d027645`, déploiement READY `dpl_FoPgyqdwVJxeJLkwrb5dcuzXFM2j`, URL immuable `https://lyceegest-n7g5h7jv5-safe-scol.vercel.app`. Le domaine `https://lycee-blaise-cendrars-sevran.fr` pointe sur cette version. Retour arrière possible vers `https://lyceegest-gy2yuxi8i-safe-scol.vercel.app` (`6b4377e`).

La même recette passe sur l’URL immuable puis le domaine principal, en 1440, 390 et 320 px, sans simulation des API distantes : six articles réellement publiés, images chargées, accès aide/actualités et pages individuelles fonctionnels, aucune erreur JavaScript ou console, aucun débordement. Captures ordinateur et téléphone du domaine relues avec `view_image` : même charte, images compactes, CTA côte à côte, aucun texte factuel modifié. Preuves : dossiers nommés par le domaine dans `../Actualites_visuelles_2026-09-11/`.

Observation éditoriale séparée : une publication « Changement de spécialité… - copie » coexiste avec l’original. Signalée à Adel ; aucun archivage automatique. Limites de recette : Chromium sur trois tailles, pas de test physique Safari/iOS ni de modification d’article depuis une session administrateur réelle.
