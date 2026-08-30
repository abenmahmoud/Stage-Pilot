# Échange du lien magique validé dans le navigateur - preview

## Comportement livré

- La confirmation renvoyée par l'échange du lien magique est lue comme une
  donnée inconnue.
- Le suivi ne s'ouvre que si le numéro respecte exactement le format public
  `BC-AAAA-NNNNNN`.
- Le jeton à usage unique est retiré de l'URL après un succès comme après une
  réponse invalide, pour éviter sa conservation dans l'historique visible.

## Vérifications

- Le test dédié est intégré à la barrière de sécurité permanente.
- La recette Chromium renvoie volontairement un numéro contenant une balise
  HTML ; le numéro n'est ni rendu ni utilisé pour ouvrir le suivi.
- À 320 x 720 et 1440 x 1000, l'accueil reste stable, le jeton disparaît de
  l'URL et aucun débordement ou erreur JavaScript n'est observé.
- Aucun jeton réel, email, donnée privée ou environnement de production n'a été
  utilisé.
