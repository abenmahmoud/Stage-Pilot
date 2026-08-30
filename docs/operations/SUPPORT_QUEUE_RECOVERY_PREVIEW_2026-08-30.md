# Reprise manuelle de la file agent - preview

## Comportement livré

- Les pannes de file sont séparées des erreurs de détail, réponse, traduction ou
  pièce jointe.
- Une panne réseau ordinaire propose `Réessayer` sans recharger toute la page.
- Pendant le nouvel essai, le bouton est désactivé et indique `Nouvel essai…`.
- Les erreurs de connexion et de double vérification conservent uniquement leur
  parcours sécurisé ; le bouton ne contourne aucune protection.
- Les dossiers déjà chargés restent visibles pendant la panne et la reprise.

## Vérifications

- Le test automatisé contrôle la séparation des états et l'ordre des actions.
- La recette Playwright renvoie volontairement un premier `503`, puis une réponse
  valide après le clic. À 320 et 1440 px, deux tentatives exactement sont faites,
  le bouton est désactivé pendant la reprise, l'alerte disparaît après succès et
  aucun débordement ni exception applicative n'apparaît.
