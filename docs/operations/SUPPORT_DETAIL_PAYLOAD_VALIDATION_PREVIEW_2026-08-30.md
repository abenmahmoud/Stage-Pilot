# Contrat du détail d'une demande agent - preview

## Comportement livré

- Le détail d'une demande ne réutilise plus à tort les indicateurs propres à la
  file ; il exige sa description et son état d'identité.
- La demande, le périmètre agent, les contacts, messages, pièces jointes,
  rappels, revue de doublon et revue de routage sont validés avant affichage.
- Une réponse partielle ou mal typée est refusée et ne remplace jamais le détail
  sélectionné par des données incohérentes.

## Vérifications

- Le test source dédié est inclus dans la barrière de sécurité permanente.
- La recette navigateur ouvre un premier dossier valide puis reçoit un détail
  incomplet pour un second dossier à 320 x 720 et 1440 x 1000.
- La file reste disponible, l'ancien détail est retiré, le détail partiel n'est
  jamais affiché et une alerte explicite est annoncée.
- Aucun débordement horizontal ni crash JavaScript n'est observé.
- Toutes les données de recette sont fictives et restent sur le serveur local.
