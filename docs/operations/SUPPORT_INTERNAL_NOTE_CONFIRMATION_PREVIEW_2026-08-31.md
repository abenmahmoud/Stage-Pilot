# Confirmation des notes internes - preview

## Comportement livré

- La note reste dans l'éditeur tant que le serveur n'a pas fourni un reçu lié à
  l'événement `note.created` et que la console n'a pas relu le message interne.
- Une perte de réponse réseau conserve la clé de la tentative. Le nouvel essai
  retrouve la note existante au lieu d'en créer une seconde.
- Une clé déjà liée à un autre auteur ou à un autre texte est refusée.
- Le reçu contient seulement le numéro public, l'identifiant du message, les
  dates, le drapeau de rejeu et une corrélation opaque.

## Vérifications

- Le test dédié couvre reçu valide, reçu falsifié, rejeu ancien, liaison à
  l'auteur, au texte et à l'événement, puis relecture avant effacement.
- Le test est intégré à la barrière permanente de sécurité de la preview.
- Aucun compte, note réelle, migration, envoi ou environnement de production
  n'est utilisé.
