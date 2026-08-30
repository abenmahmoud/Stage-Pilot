# Client borné du worker Webmail - 30 août 2026

## Fonctionnement

Le client local reçoit un ordre déjà préparé et l'état transactionnel attendu.
Il revérifie la signature de l'ordre, appelle un transport injecté, revérifie le
reçu puis applique uniquement la politique de complétion. Aucun endpoint n'est
codé en dur et aucun appel réel n'est effectué par ce module.

## Limites

- 500 livraisons au maximum par lot ;
- 20 appels simultanés au maximum, 10 dans la simulation de 200 lignes ;
- délai compris entre 100 ms et 30 secondes, 10 secondes par défaut ;
- réponse limitée au seul champ `receiptToken` ;
- commande, reçu et état doivent porter les mêmes empreintes.

Les erreurs HTTP deviennent `authorization_failed`, `configuration_missing`,
`provider_rate_limited`, `provider_unavailable` ou `provider_rejected`. Une
coupure devient `network_error` ou `provider_timeout`. Aucun texte fournisseur
n'est conservé.

## Limites du lot

Le transport est fictif. Le raccordement au Webmail séparé, la transaction de
base et la recette de file sur la preview restent nécessaires.
