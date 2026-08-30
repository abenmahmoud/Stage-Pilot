# Recette navigateur de l'assistant public - 30 août 2026

## Environnement

- serveur Vite local uniquement ;
- navigateur Chrome automatisé ;
- largeurs 1 262 px et 390 px ;
- aucune donnée réelle, aucun envoi et aucune création de dossier distant.

## Résultats

- accueil non vide, sans erreur ni panneau Vite ;
- aucun débordement horizontal sur ordinateur ou téléphone ;
- sept images chargées après défilement ;
- question d'accueil transmise à l'assistant ;
- diagnostic ordinateur prêt en deux réponses, puis ouverture du formulaire
  final avec email, téléphone, langue et demande de rappel ;
- aucun clic sur `Envoyer au lycée`.

L'audit axe WCAG A/AA a trouvé un contraste insuffisant sur le sous-état
`Demande comprise`. Sa couleur a été assombrie et sa taille est passée de 8 à
10 px. La liste des parcours du héros expose aussi les rôles `list/listitem` au
lieu d'un libellé ARIA posé sur un `div` sans rôle. La recette est rejouée après
correction.
