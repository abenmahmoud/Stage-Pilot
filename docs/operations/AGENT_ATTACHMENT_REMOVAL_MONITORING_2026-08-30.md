# Supervision des retraits de brouillons agent

## Signal

L'écran `/admin/sante-demandes`, réservé à la direction et protégé par MFA,
affiche le nombre de retraits de brouillons qui nécessitent une reprise.

Le compteur inclut uniquement les pièces jointes :

- préparées par un agent ;
- encore sans message et sans libération au demandeur ;
- restées en `removal_pending`, ou revenues en `scan_error` avec le motif
  technique `storage_removal_failed` ;
- rattachées à l'établissement du compte direction connecté.

La réponse ne contient ni nom de fichier, ni chemin Storage, ni contenu, ni
référence de dossier, ni identité.

## Traitement

1. La direction constate un compteur non nul dans `Retraits à reprendre`.
2. L'agent propriétaire ouvre le dossier concerné depuis sa file habituelle.
3. L'interface affiche `Retrait à reprendre` et autorise une nouvelle tentative.
4. Le serveur refait les contrôles de compte, établissement, service,
   propriétaire et état avant toute suppression.

La supervision ne lance jamais de suppression automatique. Si l'agent ne peut
pas reprendre l'opération, l'incident doit être conservé pour l'analyse
technique ; aucune manipulation directe du bucket n'est prévue par l'interface.

## Vérification

`npm run test:support-operations` contrôle le cloisonnement du compteur, les
deux états surveillés, l'absence de publication et l'absence de données de
stockage dans la réponse.
