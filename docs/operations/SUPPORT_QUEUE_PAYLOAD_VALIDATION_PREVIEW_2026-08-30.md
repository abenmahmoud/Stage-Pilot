# Contrat de réponse de la file agent - preview

## Comportement livré

- Une ligne de file et un détail complet ont des contrats distincts.
- Chaque ligne exige ses identifiants, libellés, états, dates, affectations et
  indicateurs dans le bon type.
- Tous les compteurs doivent être des entiers positifs ou nuls.
- Pagination, statistiques de service et droits agent sont vérifiés en entier.
- Une réponse invalide est refusée avant toute modification de la file visible.

## Vérifications

- Le test dédié est inclus dans la barrière de sécurité permanente.
- Une recette Playwright injecte une réponse partielle après une réponse valide.
- À 320 x 720 et 1440 x 1000, la file valide reste affichée, l'alerte explique
  le refus et l'action `Réessayer` est disponible.
- Aucun débordement horizontal ni crash JavaScript n'est observé.
- La recette utilise uniquement un dossier fictif et le serveur local de preview.
