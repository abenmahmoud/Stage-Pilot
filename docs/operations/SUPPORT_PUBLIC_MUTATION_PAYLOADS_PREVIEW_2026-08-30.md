# Confirmations des actions publiques validées - preview

## Comportement livré

- Un fichier n'est considéré comme reçu qu'après confirmation du même identifiant
  avec un état `quarantine` ou `clean`.
- Un message de suivi conserve la même clé après une coupure. Son reçu doit lier
  le numéro du dossier, l'identifiant, la date du message et l'événement
  `message.received` ; le même message entrant doit ensuite être relu avant de
  vider l'éditeur.
- Un rejeu avec la même clé mais un autre texte est refusé ; un rejeu identique
  retrouve le premier message au lieu d'en créer un second.
- La mémoire de l'appareil n'est effacée qu'après confirmation explicite
  `cleared: true` de la révocation serveur.
- Une réponse JSON vide ou partielle conserve l'état local et affiche une erreur
  claire.

## Vérifications

- Les tests unitaires et statiques dédiés sont intégrés à la barrière de sécurité
  permanente.
- La recette Chromium vérifie une fausse fermeture de session et un faux accusé
  de message ; l'accès et le texte saisi restent présents.
- Les deux scénarios passent à 320 x 720 et 1440 x 1000 sans débordement ni
  erreur JavaScript.
- Aucun message réel, fichier, session distante ou production n'a été modifié.
