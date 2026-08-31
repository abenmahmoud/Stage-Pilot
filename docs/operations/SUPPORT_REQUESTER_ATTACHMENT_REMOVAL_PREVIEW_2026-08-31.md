# Retrait récupérable d'une pièce demandeur - preview

## Comportement livré

- Le bouton de retrait apparaît seulement pour une pièce créée par la session
  courante et dont l'état est `awaiting_upload`, `blocked`, `scan_error` ou
  `removal_pending`.
- Un document `quarantine` ou `clean` ne peut pas être retiré depuis l'espace
  public : le lycée peut déjà être en train de le contrôler ou de l'utiliser.
- Chaque retrait reçoit une clé UUID stable. Un rejeu exact retrouve le reçu de
  l'opération sans supprimer une seconde fois.
- Le serveur verrouille le dossier, marque la ligne `removal_pending`, supprime
  l'objet du stockage privé, puis supprime la ligne.
- Si le stockage refuse la suppression, la ligne revient à `scan_error` et le
  bouton permet un nouvel essai.
- L'interface valide le reçu, relit le dossier et exige l'absence de l'identifiant
  avant de libérer l'emplacement dans le compteur des cinq pièces.

## Confidentialité et concurrence

- Le retrait exige l'accès au dossier et la session opaque qui a créé la pièce.
- Les opérations concurrentes sont sérialisées par le verrou du dossier.
- `attachment.draft_removal_requested`, `attachment.draft_removed`,
  `attachment.draft_removal_reused` et `attachment.draft_removal_failed` ne
  contiennent ni nom de fichier, ni chemin, ni URL, ni jeton, ni contenu.
- La suppression ne crée aucun lien public et ne touche que le bucket déjà lié
  à la ligne autorisée.
- Ce lot ne modifie aucune base distante, n'ajoute aucune migration et n'utilise
  aucune donnée réelle.

## Vérification

- `npm run test:support-requester-attachment-removal`
- `npm run test:support-attachment-removal-confirmation`
- `npm run test:support-public-detail-payload`
- `npm run test:support-public-mutation-payloads`
- `npm run test:support-rate-limits`
- `npm run build`
- `npm run test:preview-security-gate`
- `npm audit --omit=dev`
