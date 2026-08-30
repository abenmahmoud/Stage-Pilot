# Réponses JSON bornées dans le navigateur - preview

## Comportement livré

- Le lecteur commun des réponses API limite chaque réponse à 4 Mio par défaut.
- Une taille annoncée trop grande est refusée avant lecture ; un flux sans
  `Content-Length` est lu par morceaux puis annulé dès le premier octet en trop.
- Le flux éditorial déclare séparément un maximum de 16 Mio, calculé pour son
  contrat de 100 contenus et leurs médias bornés.
- Les corps invalides, démesurés ou non JSON ne sont jamais exposés dans les
  messages d'erreur publics.

## Vérifications

- Six tests unitaires couvrent succès, erreur bornée, HTML, primitive, taille
  annoncée, flux sans taille et plafond explicite.
- Le test éditorial permanent exige son plafond dédié et le contrôle est ajouté
  à `test:preview-security-gate`.
- Une recette Chromium injecte plus de 4 Mio dans « Mes demandes » : le paquet
  est refusé à 320 et 1 440 px, sans débordement ni erreur JavaScript.
- Aucun service réel, donnée réelle ou production n'a été utilisé ou modifié.
