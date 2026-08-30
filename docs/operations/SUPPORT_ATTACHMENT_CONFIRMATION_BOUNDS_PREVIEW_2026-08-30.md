# Confirmation des pièces jointes bornée - preview

## Comportement livré

- La confirmation compare la taille réelle du fichier à la réservation avant
  toute copie en mémoire.
- Un fichier vide, surdimensionné ou dont la taille diffère de la réservation
  est classé `blocked` sans être chargé.
- Une seconde vérification porte sur le nombre d'octets après lecture pour ne
  jamais accepter une source incohérente.
- Les fichiers conformes restent placés en quarantaine jusqu'au passage du
  worker antivirus ; aucun fichier n'est rendu public par cette étape.

## Vérifications permanentes

- Le test couvre le refus avant lecture, l'écart de taille, la vérification
  après lecture et l'usage obligatoire du helper dans la route.
- Le test fait partie de `test:preview-security-gate`.
- Aucun fichier réel, stockage lié ou environnement de production n'est utilisé.
