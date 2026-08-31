# Reprise d'une pièce demandeur après redémarrage - preview

## Contrat livré

- Avant le premier appel réseau, le navigateur conserve une clé UUID et une
  empreinte SHA-256 des métadonnées du fichier dans IndexedDB.
- Après une fermeture complète, la personne sélectionne à nouveau le même
  fichier. L'application retrouve la même clé et reprend la réservation serveur
  au lieu de créer une seconde pièce.
- L'identifiant opaque de la pièce est ajouté à la mémoire locale uniquement
  après une réservation serveur validée.
- Un dépôt confirmé efface immédiatement l'opération. Un retrait confirmé efface
  toutes les opérations liées à la pièce.
- « Oublier les demandes » révoque la session publique et efface aussi toutes les
  opérations de dépôt de cet appareil.

## Confidentialité et limites

- Aucun binaire, nom de fichier, contenu, type de document libre, chemin Storage,
  jeton signé ou URL n'est conservé dans la mémoire de reprise.
- L'empreinte porte sur le numéro public, le nom normalisé, le type déclaré, la
  taille, la date locale et l'occurrence, mais seul son résultat SHA-256 est
  écrit.
- La conservation est limitée à sept jours et vingt opérations pour tout
  l'appareil. Les entrées invalides, expirées et excédentaires sont supprimées.
- Le numéro public ne donne aucun accès seul. Le cookie de session HttpOnly reste
  obligatoire côté serveur.
- Le navigateur ne peut pas conserver le contenu d'un `File` de manière sûre et
  portable : une nouvelle sélection par la personne reste donc nécessaire.

## Vérification

- `npm run test:support-device-memory`
- `npm run test:support-requester-upload-reservation`
- `npm run test:support-requester-attachment-removal`
- `npm run build`
- `npm run test:preview-security-gate`
- `npm audit --omit=dev`
