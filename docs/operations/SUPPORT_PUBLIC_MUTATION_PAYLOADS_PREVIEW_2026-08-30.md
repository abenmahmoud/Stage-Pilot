# Confirmations des actions publiques validées - preview

## Comportement livré

- Un fichier n'est considéré comme reçu qu'après confirmation du même identifiant
  avec un état `quarantine` ou `clean`.
- Un message de suivi ne vide l'éditeur qu'après réception d'un identifiant UUID,
  d'une date plausible et du drapeau d'idempotence.
- La mémoire de l'appareil n'est effacée qu'après confirmation explicite
  `cleared: true` de la révocation serveur.
- Une réponse JSON vide ou partielle conserve l'état local et affiche une erreur
  claire.

## Vérifications

- Le test statique dédié est intégré à la barrière de sécurité permanente.
- La recette Chromium vérifie une fausse fermeture de session et un faux accusé
  de message ; l'accès et le texte saisi restent présents.
- Les deux scénarios passent à 320 x 720 et 1440 x 1000 sans débordement ni
  erreur JavaScript.
- Aucun message réel, fichier, session distante ou production n'a été modifié.
