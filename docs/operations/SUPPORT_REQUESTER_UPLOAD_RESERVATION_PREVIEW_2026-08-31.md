# Réservation récupérable des pièces demandeur - preview

## Comportement livré

- Chaque fichier reçoit une clé UUID conservée pendant sa tentative.
- Le serveur lie la clé au dossier, à la session et à une empreinte SHA-256 de
  toutes les métadonnées déclarées. Une réutilisation discordante est refusée.
- Une coupure après création de la ligne ne produit pas de doublon : le rejeu
  retrouve la réservation et délivre un nouveau jeton privé temporaire.
- Un lot partiellement réussi conserve les fichiers déjà confirmés et reprend
  seulement les autres. Cinq réservations déjà comptées restent récupérables.
- Une pièce peut être ajoutée depuis le suivi sans écrire un second message.
- La confirmation utilise une transition atomique ; une course ne produit qu'un
  événement et qu'un travail antivirus.
- L'état initial `awaiting_upload` est écrit explicitement et le schéma local
  correspond à la migration historique, afin de garder une reconstruction fiable.

## Confidentialité et limites

- Le stockage reste dans `support-quarantine`; aucun lien public n'est créé.
- Le jeton n'est jamais persisté dans la base, les événements ou Git.
- `attachment.draft_reserved` contient seulement l'identifiant opaque de la
  pièce, sa direction, son état et l'empreinte des métadonnées.
- Aucun nom de fichier, chemin, jeton ou contenu n'entre dans cet événement ;
  l'identifiant opaque de session reste la preuve d'accès nécessaire à l'audit.
- La reprise navigateur couvre la page encore ouverte. La reprise après
  fermeture complète du navigateur reste un lot séparé à concevoir avec une
  conservation locale bornée et sans donnée personnelle.
- Ce lot n'ajoute aucune migration et n'utilise aucun fichier ou compte réel.

## Vérification

- `npm run test:support-requester-upload-reservation`
- `npm run test:support-public-upload-reservation`
- `npm run test:support-public-mutation-payloads`
- `npm run build`
- `npm run test:preview-security-gate`
- `npm audit --omit=dev`
