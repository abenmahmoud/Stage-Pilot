# Persistance de la complétion Webmail - 30 août 2026

## Transaction attendue

Le futur worker ouvre une transaction puis appelle
`persistCommunicationWebmailCompletion`. L'adaptateur :

1. verrouille le travail et la livraison du même établissement ;
2. recalcule la décision avec la commande et le reçu vérifiés ;
3. ajoute un événement idempotent sans texte fournisseur ;
4. met à jour la livraison si elle n'est pas déjà plus avancée ;
5. termine exactement le travail encore `running`.

Les écritures vérifient à nouveau l'identifiant, l'établissement, le statut, la
commande et l'idempotence. Une ligne absente ou concurrente fait échouer toute
la transaction.

## Données retournées

Le résultat contient uniquement `accepted`, `duplicate`, `deliveryStatus` et
`jobStatus`. Les HMAC restent côté serveur et aucune coordonnée n'est projetée.

## Limites

L'adaptateur n'ouvre pas lui-même de transaction et n'appelle aucun service. Le
worker de file, la migration de preview et la recette DB fictive restent à faire.
