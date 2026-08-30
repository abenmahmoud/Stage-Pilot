# Protection contre les réponses obsolètes - preview

## Comportement livré

- Chaque chargement de file reçoit un numéro croissant côté navigateur.
- Seule la réponse du dernier chargement peut modifier liste, compteurs,
  pagination, accès, sélection ou erreur.
- Le détail vérifie que son numéro de dossier est encore sélectionné avant de
  modifier le panneau ou d'afficher une erreur.

## Vérifications

- Le test automatisé contrôle les gardes sur succès et erreurs.
- La recette Playwright retarde volontairement une ancienne file de 700 ms et
  l'ancien détail A de 800 ms, puis ouvre le dossier B et réinitialise la file.
- Après une seconde, seul le détail B reste visible, l'ancienne file est absente,
  `Toutes` reste actif, sans erreur ni débordement à 320 px.
