# Réservation récupérable des pièces agent - preview

## Comportement livré

- Chaque fichier sélectionné reçoit une clé UUID conservée jusqu'à sa
  confirmation complète.
- Le serveur lie cette clé au dossier, à l'agent et à une empreinte SHA-256 des
  métadonnées déclarées. Une réutilisation discordante est refusée.
- Une coupure après création de la ligne ne produit pas de doublon : le rejeu
  retrouve la réservation et délivre un nouveau jeton privé temporaire.
- Un lot de plusieurs fichiers garde séparément les tentatives déjà terminées,
  réservées ou encore à créer. Les réponses perdues peuvent être reprises même
  lorsque les cinq emplacements sont occupés côté serveur.
- La confirmation utilise une transition atomique. Une course ne produit qu'un
  événement et qu'un travail antivirus.

## Confidentialité et limites

- Le stockage reste dans `support-quarantine`; aucun lien public n'est créé.
- Le jeton n'est jamais persisté dans la base, les événements ou Git.
- L'événement `attachment.draft_reserved` contient seulement l'identifiant
  opaque de la pièce, sa direction, son état et l'empreinte des métadonnées.
- Aucun nom de fichier, chemin, jeton ou contenu n'entre dans cet événement ;
  l'identifiant opaque de l'agent reste la preuve d'auteur nécessaire à l'audit.
- Ce lot n'ajoute aucune migration et n'utilise aucun fichier ou compte réel.

## Vérification

- `npm run test:support-agent-upload-reservation`
- `npm run test:support-agent-reply-attachments`
- `npm run build`
- `npm run test:preview-security-gate`
- `npm audit --omit=dev`
