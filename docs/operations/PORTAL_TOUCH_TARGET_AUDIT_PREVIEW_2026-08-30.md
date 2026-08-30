# Audit responsive de l'accueil preview - 30 août 2026

## Recette navigateur

La branche preview a été ouverte dans le navigateur avec deux dimensions
explicites :

- mobile étroit : 320 x 800 px ;
- ordinateur : 1 440 x 900 px.

Dans les deux cas, `body.scrollWidth` et `documentElement.scrollWidth` restent
inférieurs à la largeur de la fenêtre, et aucun élément visible ne dépasse à
gauche ou à droite. À 320 px, le titre du lycée, le bouton `Besoin d'aide ?`, le
composeur de l'assistant et l'alternative formulaire apparaissent dans le
premier parcours de défilement. À 1 440 px, le menu latéral et les cinq vues
principales sont visibles sans recouvrement.

## Correction

Trois actions textuelles mesuraient seulement 17 à 18 px de haut :

- `Confidentialité et sécurité` ;
- `Tout afficher` ;
- `Ouvrir LyceeGest`.

Leur cible interactive possède maintenant une hauteur minimale de 40 px avec
un espacement vertical stable. Les libellés, couleurs et proportions visuelles
restent inchangés.

Le test `scripts/test-prototype-responsive-contract.mjs` protège les règles
mobiles critiques, ces cibles tactiles et la présence sémantique de l'assistant
et du formulaire.

## Extension aux vues publiques

La recette a ensuite couvert les vues `Services`, `Aide`, `Suivi`, `Lycée`,
`Actualités` et `Confidentialité` à 320 x 800 et 1 440 x 900 px. Le premier
passage a trouvé des cibles de 24 à 38 px dans les actions secondaires. Les
éléments suivants ont été portés à 40 px minimum :

- retour à l'accueil ;
- actions du catalogue des services ;
- action du bandeau de présentation du lycée ;
- onglets des rubriques du lycée ;
- liens pratiques de la vie du lycée ;
- fermeture d'une session de suivi sur appareil partagé ;
- recherche dans les demandes ;
- retour des articles publics et ajout de documents dans le formulaire.

Après correction, les six vues ne présentent plus ni débordement horizontal ni
cible visible sous 40 px à 320 px. L'accueil et les six vues restent sans
débordement à 1 440 px. La console du navigateur ne remonte ni erreur ni
avertissement pendant cette recette locale. Le contrôle de la preview Vercel
est effectué après le déploiement Git du lot.

## Limite honnête

Cette recette ne remplace pas le test des écrans agents authentifiés, du lecteur
d'écran ni de toute la navigation clavier. Elle ne ferme donc pas T048. Aucun
formulaire n'a été envoyé, aucune donnée n'a été saisie et aucun environnement
de production n'a été modifié.
