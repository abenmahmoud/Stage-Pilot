# Prise et récupération des travaux Webmail - 30 août 2026

## Prise

Le futur runner ouvre une transaction et appelle `claimCommunicationWebmailJobs`.
La requête sélectionne uniquement les travaux `pending` ou `retry` déjà dus,
liés à une version et une livraison, dans l'établissement configuré. Elle les
verrouille avec `FOR UPDATE SKIP LOCKED` puis les passe à `running`.

- 10 travaux par défaut ;
- 20 travaux au maximum ;
- ordre par échéance, création puis identifiant ;
- aucun contact, HMAC ou texte d'erreur dans le résultat.

## Récupération

Un travail `running` n'est considéré abandonné qu'après cinq minutes par défaut,
jamais avant deux minutes. Il reçoit le code fermé `worker_interrupted`, repart
après une minute et devient `dead` au cinquième échec. Cent lignes au maximum
sont récupérées par passage.

## Limites

Aucune route Cron ni exécution distante n'est activée. La recette de concurrence
sur la base de preview reste nécessaire avant raccordement.
