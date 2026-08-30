# Validation des filtres de file - preview

## Comportement livré

- Un statut vide conserve la vue complète ; un statut connu filtre la file.
- Tout statut non documenté reçoit une réponse `400 Statut invalide`.
- L'attribution accepte uniquement une valeur vide, `me` ou `none`.
- Toute autre attribution reçoit une réponse `400 Attribution invalide`.

Cette validation est exécutée après l'authentification agent et avant la
construction des filtres SQL. Elle n'élargit aucun droit et ne modifie aucune
donnée.

## Vérifications

- Le test dédié impose la présence et l'ordre des refus avant les filtres SQL.
- Les tests existants confirment que `me` et `none` gardent leur comportement.
- Le test est inclus dans la barrière de sécurité permanente de la preview.
